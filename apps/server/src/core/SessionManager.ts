import { EventEmitter } from 'events'
import type { WebSocket } from 'ws'
import type { AgentStatus } from '@ai-cli/shared'
import type { CLIAdapter, StateCandidate } from '../adapters/base.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import stripAnsi from 'strip-ansi'
import pty from 'node-pty'
import { auditLog } from './audit.js'
import { SessionRecorder } from './recorder.js'
import { pinoLogger } from '../lib/logger.js'
import { SessionStore } from './sessionStore.js'

// [C2修复] 使用 execFile 替代 exec，避免命令注入
const execFileAsync = promisify(execFile)

const BACKPRESSURE_THRESHOLD = 1048576 // 1MB (ADR-017)
const THROTTLE_MS = 16
const STATE_FUSE_COOLDOWN_MS = 500 // state fusion debounce (ADR-008)
const SAFE_SESSION_ID = /^[a-zA-Z0-9_-]+$/
const ERROR_RECOVERY_INTERVAL_MS = 10_000

interface Session {
  sessionId: string
  ownerId: string   // [C1修复] 会话归属用户ID，用于权限校验
  adapter: CLIAdapter
  ptyProcess: pty.IPty
  status: AgentStatus
  termClients: Set<WebSocket>
  ctrlClients: Set<WebSocket>
  observeClients: Set<WebSocket>
  throttleTimer: NodeJS.Timeout | null
  outputBuffer: Buffer[]
  lastBroadcast: number
  recorder: SessionRecorder
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, Session>()
  private adapters: Map<string, CLIAdapter>
  private fuseTimers = new Map<string, NodeJS.Timeout>()
  private errorRecoveryTimer: NodeJS.Timeout | null = null
  private sessionStore: SessionStore

  constructor(adapters: Map<string, CLIAdapter>) {
    super()
    this.adapters = adapters
    this.sessionStore = new SessionStore()
    this.sessionStore.load()
    this.checkTmuxAvailable()
    this.reapOrphanSessions().catch((err) => {
      pinoLogger.error({ err }, 'Failed to reap orphan sessions')
    })
    this.startErrorRecoveryLoop()
  }

  private async checkTmuxAvailable(): Promise<void> {
    try {
      await execFileAsync('which', ['tmux'])
    } catch {
      pinoLogger.fatal('tmux is not installed or not in PATH. Session management requires tmux.')
      process.exit(1)
    }
  }

  private startErrorRecoveryLoop(): void {
    this.errorRecoveryTimer = setInterval(() => {
      for (const [sessionId, session] of this.sessions.entries()) {
        if (session.status === 'ERROR') {
          // [W9修复] 错误恢复加入日志记录，而非静默吞掉错误
          this.recoverFromError(sessionId).catch((err) => {
            pinoLogger.error({ err, sessionId }, 'Error recovery failed')
          })
        }
      }
    }, ERROR_RECOVERY_INTERVAL_MS)
  }

  async recoverFromError(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'ERROR') return

    const tmuxSessionName = `aicli-${sessionId}`
    try {
      // [C2修复] 使用 execFile 替代 exec
      await execFileAsync('tmux', ['has-session', '-t', tmuxSessionName])
      // tmux session is alive — reset to IDLE
      this.updateStatus(session, 'IDLE')
    } catch {
      // tmux session is dead — destroy
      this.destroySession(sessionId)
    }
  }

  createOrAttachSession(
    sessionId: string,
    cols: number,
    rows: number,
    adapterName: string,
    ownerId: string,   // [C1修复] 传入会话归属用户ID
  ): Session {
    const existing = this.sessions.get(sessionId)
    if (existing) return existing

    const adapter = this.adapters.get(adapterName)
    if (!adapter) {
      throw new Error(`Unknown adapter: ${adapterName}`)
    }

    if (!SAFE_SESSION_ID.test(sessionId)) {
      throw new Error(`Invalid sessionId: ${sessionId}`)
    }

    const tmuxSessionName = `aicli-${sessionId}`
    const ptyProcess = pty.spawn(
      'tmux',
      [
        'new-session',
        '-A',
        '-s',
        tmuxSessionName,
        '-x',
        String(cols),
        '-y',
        String(rows),
        adapter.startCommand,
      ],
      {},
    )

    const session: Session = {
      sessionId,
      ownerId,
      adapter,
      ptyProcess,
      status: 'IDLE',
      termClients: new Set(),
      ctrlClients: new Set(),
      observeClients: new Set(),
      throttleTimer: null,
      outputBuffer: [],
      lastBroadcast: 0,
      recorder: new SessionRecorder(),
    }

    ptyProcess.onData((data: string) => {
      this.onData(session, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      if (exitCode !== 0) {
        this.updateStatus(session, 'ERROR', `Process exited with code ${exitCode}`)
      } else {
        this.updateStatus(session, 'IDLE')
      }
    })

    this.sessions.set(sessionId, session)
    this.sessionStore.set(sessionId, {
      sessionId,
      adapterName,
      tmuxSessionName,
      status: 'IDLE',
      ownerId,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    })
    auditLog('SESSION_CREATE', undefined, { sessionId, adapter: adapterName })
    return session
  }

  private onData(session: Session, data: string): void {
    const buf = Buffer.from(data, 'utf-8')
    session.outputBuffer.push(buf)

    // Record output if recording is active
    if (session.recorder.isRecording()) {
      session.recorder.record(buf, Date.now())
    }

    if (!session.throttleTimer) {
      session.throttleTimer = setTimeout(() => {
        this.flushBuffer(session)
      }, THROTTLE_MS)
    }
  }

  private flushBuffer(session: Session): void {
    const chunks = session.outputBuffer
    session.outputBuffer = []
    session.throttleTimer = null

    if (chunks.length === 0) return

    const merged = Buffer.concat(chunks)

    // Broadcast to all termClients with backpressure control (ADR-017)
    for (const client of session.termClients) {
      if (client.readyState !== 1) continue
      if (client.bufferedAmount > BACKPRESSURE_THRESHOLD) {
        continue
      }
      client.send(merged)
    }

    // Also broadcast to observeClients (read-only)
    for (const client of session.observeClients) {
      if (client.readyState !== 1) continue
      if (client.bufferedAmount > BACKPRESSURE_THRESHOLD) {
        continue
      }
      client.send(merged)
    }

    session.lastBroadcast = Date.now()

    // Debounced state fusion
    const text = stripAnsi(merged.toString('utf-8'))
    const existingTimer = this.fuseTimers.get(session.sessionId)
    if (!existingTimer) {
      this.fuseTimers.set(session.sessionId, setTimeout(() => {
        this.fuseTimers.delete(session.sessionId)
        this.fuseState(session, text).catch(() => {})
      }, STATE_FUSE_COOLDOWN_MS))
    }
  }

  private async fuseState(session: Session, text: string): Promise<void> {
    const candidate = session.adapter.parseStreamData(text)
    if (!candidate || candidate.confidence <= 0.5) return

    const tmuxSessionName = `aicli-${session.sessionId}`
    try {
      // [C2修复] 使用 execFile 替代 exec
      const { stdout } = await execFileAsync(
        'tmux', ['capture-pane', '-p', '-t', tmuxSessionName],
      )
      const screenStatus = session.adapter.parseScreenSnapshot(stdout)

      if (screenStatus !== null) {
        this.updateStatus(session, screenStatus)
      } else {
        this.updateStatus(session, candidate.status)
      }
    } catch {
      this.updateStatus(session, candidate.status)
    }
  }

  private updateStatus(session: Session, newStatus: AgentStatus, message?: string): void {
    if (session.status === newStatus) return

    session.status = newStatus
    this.emit('statusChange', session.sessionId, newStatus)
    this.broadcastControl(session.sessionId, {
      type: 'STATUS_UPDATE',
      sessionId: session.sessionId,
      status: newStatus,
      ...(message ? { message } : {}),
    })

    // Persist status change
    const persisted = this.sessionStore.get(session.sessionId)
    if (persisted) {
      persisted.status = newStatus
      persisted.lastActive = new Date().toISOString()
      this.sessionStore.set(session.sessionId, persisted)
    }
  }

  attachClient(
    sessionId: string,
    termWs?: WebSocket,
    ctrlWs?: WebSocket,
  ): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)

    if (termWs) {
      session.termClients.add(termWs)

      const tmuxSessionName = `aicli-${sessionId}`
      // [C2修复] 使用 execFile 替代 exec
      execFileAsync('tmux', ['capture-pane', '-p', '-t', tmuxSessionName])
        .then(({ stdout }) => {
          if (stdout && termWs.readyState === 1) {
            termWs.send(stdout)
          }
        })
        .catch(() => {})
    }

    if (ctrlWs) {
      session.ctrlClients.add(ctrlWs)
      ctrlWs.send(
        JSON.stringify({
          type: 'STATUS_UPDATE',
          sessionId,
          status: session.status,
        }),
      )
    }
  }

  attachObserver(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)

    session.observeClients.add(ws)

    // Send current screen to observer
    const tmuxSessionName = `aicli-${sessionId}`
    // [C2修复] 使用 execFile 替代 exec
    execFileAsync('tmux', ['capture-pane', '-p', '-t', tmuxSessionName])
      .then(({ stdout }) => {
        if (stdout && ws.readyState === 1) {
          ws.send(stdout)
        }
      })
      .catch(() => {})
  }

  detachObserver(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.observeClients.delete(ws)
  }

  detachClient(
    sessionId: string,
    termWs?: WebSocket,
    ctrlWs?: WebSocket,
  ): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    if (termWs) session.termClients.delete(termWs)
    if (ctrlWs) session.ctrlClients.delete(ctrlWs)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    session.ptyProcess.resize(cols, rows)
  }

  sendInput(sessionId: string, data: string | Buffer): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    session.ptyProcess.write(
      typeof data === 'string' ? data : data.toString('utf-8'),
    )
  }

  sendQuickAction(sessionId: string, payload: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    session.ptyProcess.write(payload)
  }

  broadcastControl(sessionId: string, message: object): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const payload = JSON.stringify(message)
    for (const client of session.ctrlClients) {
      if (client.readyState === 1) {
        client.send(payload)
      }
    }
  }

  async reapOrphanSessions(): Promise<void> {
    try {
      // [C2修复] 使用 execFile 替代 exec，避免命令注入
      const { stdout } = await execFileAsync(
        'tmux', ['list-sessions', '-F', '#{session_name}'],
      )
      const allTmuxSessions = stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

      // Restore persisted sessions whose tmux sessions are still alive
      for (const [sessionId, persisted] of this.sessionStore.entries()) {
        if (this.sessions.has(sessionId)) continue
        const tmuxName = persisted.tmuxSessionName
        if (allTmuxSessions.includes(tmuxName)) {
          const adapter = this.adapters.get(persisted.adapterName)
          if (!adapter) continue
          pinoLogger.info({ sessionId }, 'Restoring persisted session')
          try {
            this.createOrAttachSession(sessionId, 80, 24, persisted.adapterName, persisted.ownerId || '')
          } catch (err) {
            pinoLogger.warn({ err, sessionId }, 'Failed to restore persisted session')
          }
        } else {
          // tmux session is gone — clean up persisted entry
          this.sessionStore.delete(sessionId)
        }
      }

      // Reap tmux sessions that have no in-memory counterpart after restoration
      const orphanSessions = allTmuxSessions.filter((name) => {
        if (!name.startsWith('aicli-')) return false
        const sessionId = name.slice('aicli-'.length)
        return !this.sessions.has(sessionId)
      })

      for (const name of orphanSessions) {
        // [C2修复] 使用 execFile 替代 exec，对 tmux session name 参数化传递
        // name 来自 tmux list-sessions 输出，已通过 SAFE_SESSION_ID 正则校验
        await execFileAsync('tmux', ['kill-session', '-t', name])
      }

      if (orphanSessions.length > 0) {
        pinoLogger.info({ count: orphanSessions.length }, 'Reaped orphan tmux session(s)')
      }
    } catch {
      // tmux list-sessions fails when no sessions exist — that's fine
    }
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const fuseTimer = this.fuseTimers.get(sessionId)
    if (fuseTimer) {
      clearTimeout(fuseTimer)
      this.fuseTimers.delete(sessionId)
    }

    for (const ws of session.termClients) {
      ws.close()
    }
    for (const ws of session.ctrlClients) {
      ws.close()
    }
    for (const ws of session.observeClients) {
      ws.close()
    }

    try {
      session.ptyProcess.kill()
    } catch {
      // Process may already be dead
    }

    this.sessions.delete(sessionId)
    this.sessionStore.delete(sessionId)
    auditLog('SESSION_DESTROY', undefined, { sessionId })
  }

  getSessionIds(): string[] {
    return [...this.sessions.keys()]
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  // [C1修复] 获取会话归属用户ID
  getOwner(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.ownerId ?? null
  }

  getAdapterForSession(sessionId: string): CLIAdapter | undefined {
    return this.sessions.get(sessionId)?.adapter
  }

  startRecording(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    session.recorder.start()
  }

  stopRecording(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    session.recorder.stop()
  }

  getRecording(sessionId: string, startTime?: number, endTime?: number) {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    return session.recorder.getPlayback(startTime, endTime)
  }

  getRecordingStatus(sessionId: string) {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    return {
      recording: session.recorder.isRecording(),
      duration: session.recorder.getDuration(),
    }
  }

  destroy(): void {
    if (this.errorRecoveryTimer) {
      clearInterval(this.errorRecoveryTimer)
      this.errorRecoveryTimer = null
    }

    // Destroy all active sessions (S10 fix)
    for (const sessionId of [...this.sessions.keys()]) {
      this.destroySession(sessionId)
    }

    // Clear all fuse timers
    for (const timer of this.fuseTimers.values()) {
      clearTimeout(timer)
    }
    this.fuseTimers.clear()
  }
}
