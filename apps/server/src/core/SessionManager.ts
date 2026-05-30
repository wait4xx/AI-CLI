import { EventEmitter } from 'events'
import type { WebSocket } from 'ws'
import type { AgentStatus } from '@ai-cli/shared'
import { TERM_COLS_MIN, TERM_COLS_MAX, TERM_ROWS_MIN, TERM_ROWS_MAX } from '@ai-cli/shared'
import type { CLIAdapter } from '../adapters/base.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import stripAnsi from 'strip-ansi'
import pty from 'node-pty'
import { auditLog } from './audit.js'
import { SessionRecorder } from './recorder.js'
import { pinoLogger } from '../lib/logger.js'
import { SessionStore } from './sessionStore.js'
import { getConfig } from '../lib/config.js'

// [C2修复] 使用 execFile 替代 exec，避免命令注入
const execFileAsync = promisify(execFile)

// ─── Timing & thresholds ───
const BACKPRESSURE_THRESHOLD = 1048576 // 1MB – skip WS send when bufferedAmount exceeds this (ADR-017)
const THROTTLE_MS = 16 // ~1 frame at 60fps – debounce PTY output broadcast
const STATE_FUSE_COOLDOWN_MS = 500 // state fusion debounce window (ADR-008)
const ERROR_RECOVERY_INTERVAL_MS = 10_000 // interval between ERROR→IDLE recovery sweeps
const FUSE_CLEANUP_INTERVAL_MS = 60_000 // interval to sweep stale fuseTimers for destroyed sessions
const STATE_FUSE_MIN_CONFIDENCE = 0.5 // minimum adapter confidence to accept a state candidate

// ─── Defaults & validation ───
const SAFE_SESSION_ID = /^[a-zA-Z0-9_-]+$/
const DEFAULT_COLS = 80 // fallback terminal columns when restoring orphan sessions
const DEFAULT_ROWS = 24 // fallback terminal rows when restoring orphan sessions

interface Session {
  sessionId: string
  ownerId: string // [C1修复] 会话归属用户ID，用于权限校验
  adapterName: string
  adapter: CLIAdapter
  ptyProcess: pty.IPty
  tmuxSessionName: string // actual tmux session name (aicli-* or external name)
  status: AgentStatus
  termClients: Set<WebSocket>
  ctrlClients: Set<WebSocket>
  observeClients: Set<WebSocket>
  throttleTimer: NodeJS.Timeout | null
  outputBuffer: Buffer[]
  lastBroadcast: number
  recorder: SessionRecorder
}

/**
 * SessionManager — manages PTY sessions backed by tmux.
 *
 * Handles session lifecycle (create/attach/destroy), output throttling,
 * backpressure-aware broadcast, state fusion, and orphan reaping.
 */
export class SessionManager extends EventEmitter {
  private sessions = new Map<string, Session>()
  private adapters: Map<string, CLIAdapter>
  private fuseTimers = new Map<string, NodeJS.Timeout>()
  private fuseTexts = new Map<string, string>() // [R8] latest text for debounced state fusion
  private errorRecoveryTimer: NodeJS.Timeout | null = null
  private fuseCleanupTimer: NodeJS.Timeout | null = null // [R4修复] 保存引用以便 destroy() 清理
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
    this.startFuseTimerCleanup()
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
      // [V3-9修复] 快照 keys 避免迭代中 destroySession 修改 Map 导致并发修改异常
      const errorSessionIds = [...this.sessions.entries()]
        .filter(([, session]) => session.status === 'ERROR')
        .map(([sessionId]) => sessionId)

      for (const sessionId of errorSessionIds) {
        // [W9修复] 错误恢复加入日志记录，而非静默吞掉错误
        this.recoverFromError(sessionId).catch((err) => {
          pinoLogger.error({ err, sessionId }, 'Error recovery failed')
        })
      }
    }, ERROR_RECOVERY_INTERVAL_MS)
  }

  /**
   * Attempt to recover a session whose PTY is in ERROR state.
   * If the underlying tmux session is still alive, resets to IDLE; otherwise destroys.
   *
   * @param sessionId - The session identifier to recover
   */
  async recoverFromError(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session || session.status !== 'ERROR') return

    try {
      // [C2修复] 使用 execFile 替代 exec
      await execFileAsync('tmux', ['has-session', '-t', session.tmuxSessionName])
      // tmux session is alive — reset to IDLE
      this.updateStatus(session, 'IDLE')
    } catch {
      // tmux session is dead — destroy
      this.destroySession(sessionId)
    }
  }

  /**
   * Create a new session or return an existing one with the same id.
   *
   * @param sessionId - Unique session identifier (alphanumeric, dash, underscore)
   * @param cols - Initial terminal columns
   * @param rows - Initial terminal rows
   * @param adapterName - Name of the CLI adapter to use
   * @param ownerId - User ID that owns this session (for permission checks)
   * @returns The created or existing Session
   * @throws If adapterName is unknown or sessionId is invalid
   */
  createOrAttachSession(
    sessionId: string,
    cols: number,
    rows: number,
    adapterName: string,
    ownerId: string, // [C1修复] 传入会话归属用户ID
    attachToTmux?: string, // If provided, attach to existing tmux session
    cwd?: string, // Working directory for new sessions (falls back to PROJECT_ROOT)
  ): Session {
    // [V3-2] Validate sessionId first — defense in depth
    if (!SAFE_SESSION_ID.test(sessionId)) {
      throw new Error(`Invalid sessionId: ${sessionId}`)
    }

    const existing = this.sessions.get(sessionId)
    if (existing) {
      // Resize to match current terminal dimensions when reattaching
      try {
        existing.ptyProcess.resize(cols, rows)
      } catch {
        /* ignore */
      }
      return existing
    }

    const adapter = this.adapters.get(adapterName)
    if (!adapter) {
      throw new Error(`Unknown adapter: ${adapterName}`)
    }

    // [R9] Defense-in-depth: validate cols/rows at creation point (not just WSGateway)
    // Uses shared constants from @ai-cli/shared to avoid DRY violation
    if (
      !Number.isFinite(cols) ||
      !Number.isFinite(rows) ||
      cols < TERM_COLS_MIN ||
      cols > TERM_COLS_MAX ||
      rows < TERM_ROWS_MIN ||
      rows > TERM_ROWS_MAX
    ) {
      throw new Error(
        `Invalid terminal dimensions: ${cols}x${rows} (allowed: ${TERM_COLS_MIN}-${TERM_COLS_MAX}x${TERM_ROWS_MIN}-${TERM_ROWS_MAX})`,
      )
    }

    let tmuxSessionName: string
    let ptyProcess: pty.IPty

    if (attachToTmux) {
      // Attach to existing tmux session
      tmuxSessionName = attachToTmux
      ptyProcess = pty.spawn('tmux', ['attach', '-t', attachToTmux], {})
    } else {
      // Create new tmux session
      tmuxSessionName = `aicli-${sessionId}`
      ptyProcess = pty.spawn(
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
          '-c',
          cwd || getConfig().PROJECT_ROOT,
          adapter.startCommand,
        ],
        {},
      )
    }

    const session: Session = {
      sessionId,
      ownerId,
      adapterName,
      adapter,
      ptyProcess,
      tmuxSessionName,
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
        // [M2修复] 背压超阈值时通知客户端
        this.sendBackpressureWarning(session)
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

    // Debounced state fusion — [R8] store latest text so timer fires with current data
    const text = stripAnsi(merged.toString('utf-8'))
    this.fuseTexts.set(session.sessionId, text)
    if (!this.fuseTimers.has(session.sessionId)) {
      this.fuseTimers.set(
        session.sessionId,
        setTimeout(() => {
          this.fuseTimers.delete(session.sessionId)
          const latest = this.fuseTexts.get(session.sessionId) || text
          this.fuseTexts.delete(session.sessionId)
          this.fuseState(session, latest).catch(() => {
            /* ignore — fuseState has its own error handling */
          })
        }, STATE_FUSE_COOLDOWN_MS),
      )
    }
  }

  private async fuseState(session: Session, text: string): Promise<void> {
    const candidate = session.adapter.parseStreamData(text)
    if (!candidate || candidate.confidence <= STATE_FUSE_MIN_CONFIDENCE) return

    try {
      // [C2修复] 使用 execFile 替代 exec
      const { stdout } = await execFileAsync('tmux', [
        'capture-pane',
        '-p',
        '-t',
        session.tmuxSessionName,
      ])
      const screenStatus = session.adapter.parseScreenSnapshot(stdout)

      if (screenStatus !== null) {
        this.updateStatus(session, screenStatus)
      } else {
        this.updateStatus(session, candidate.status)
      }
    } catch {
      // tmux capture-pane failed (e.g. session died) — fallback to stream-based status
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

  /**
   * Attach a terminal and/or control WebSocket to an existing session.
   *
   * @param sessionId - Target session id
   * @param termWs - Optional terminal WebSocket to receive PTY output
   * @param ctrlWs - Optional control WebSocket to receive status updates
   * @throws If the session does not exist
   */
  attachClient(sessionId: string, termWs?: WebSocket, ctrlWs?: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)

    if (termWs) {
      session.termClients.add(termWs)

      // [C2修复] 使用 execFile 替代 exec
      execFileAsync('tmux', ['capture-pane', '-p', '-e', '-t', session.tmuxSessionName])
        .then(({ stdout }) => {
          if (stdout && termWs.readyState === 1) {
            // Clear screen + cursor home, then write captured content
            termWs.send(Buffer.from('\x1b[2J\x1b[H' + stdout))
          }
        })
        .catch(() => {
          /* intentionally ignored — stdout flush is best-effort */
        })
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

  /**
   * Attach a read-only observer WebSocket to a session.
   *
   * @param sessionId - Target session id
   * @param ws - Observer WebSocket
   * @throws If the session does not exist
   */
  attachObserver(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)

    session.observeClients.add(ws)

    // Send current screen to observer
    // [C2修复] 使用 execFile 替代 exec
    execFileAsync('tmux', ['capture-pane', '-p', '-e', '-t', session.tmuxSessionName])
      .then(({ stdout }) => {
        if (stdout && ws.readyState === 1) {
          ws.send(Buffer.from('\x1b[2J\x1b[H' + stdout))
        }
      })
      .catch(() => {
        /* best-effort tmux capture — may fail if session ended */
      })
  }

  /**
   * Detach an observer WebSocket from a session.
   *
   * @param sessionId - Target session id
   * @param ws - Observer WebSocket to remove
   */
  detachObserver(sessionId: string, ws: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.observeClients.delete(ws)
  }

  /**
   * Detach terminal and/or control WebSockets from a session.
   *
   * @param sessionId - Target session id
   * @param termWs - Terminal WebSocket to detach
   * @param ctrlWs - Control WebSocket to detach
   */
  detachClient(sessionId: string, termWs?: WebSocket, ctrlWs?: WebSocket): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    if (termWs) session.termClients.delete(termWs)
    if (ctrlWs) session.ctrlClients.delete(ctrlWs)
  }

  /**
   * Resize the PTY of a session.
   *
   * @param sessionId - Target session id
   * @param cols - New column count
   * @param rows - New row count
   * @throws If the session does not exist
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    session.ptyProcess.resize(cols, rows)
  }

  /**
   * Send keyboard input to a session's PTY.
   *
   * @param sessionId - Target session id
   * @param data - Input data (string or Buffer)
   * @throws If the session does not exist
   */
  sendInput(sessionId: string, data: string | Buffer): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    session.ptyProcess.write(typeof data === 'string' ? data : data.toString('utf-8'))
  }

  /**
   * Send a quick-action payload to a session's PTY.
   *
   * @param sessionId - Target session id
   * @param payload - Raw payload string to write
   * @throws If the session does not exist
   */
  sendQuickAction(sessionId: string, payload: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    session.ptyProcess.write(payload)
  }

  /**
   * Broadcast a JSON message to all control clients of a session.
   *
   * @param sessionId - Target session id
   * @param message - Object to JSON-serialize and send
   */
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

  /**
   * Reap orphan tmux sessions that have no in-memory counterpart.
   * Also restores persisted sessions whose tmux processes are still alive.
   */
  async reapOrphanSessions(): Promise<void> {
    try {
      // [C2修复] 使用 execFile 替代 exec，避免命令注入
      const { stdout } = await execFileAsync('tmux', ['list-sessions', '-F', '#{session_name}'])
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
          // External tmux sessions (non-aicli-*) need attachToTmux to re-attach
          const isExternal = tmuxName !== `aicli-${sessionId}`
          const attachToTmux = isExternal ? tmuxName : undefined
          pinoLogger.info({ sessionId, tmuxName, isExternal }, 'Restoring persisted session')
          try {
            this.createOrAttachSession(
              sessionId,
              DEFAULT_COLS,
              DEFAULT_ROWS,
              persisted.adapterName,
              persisted.ownerId || '',
              attachToTmux,
            )
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

  // [M11修复] 定期清理孤立 fuseTimer
  // [V3-10修复] 快照 entries 避免迭代中 delete 修改 Map 导致并发修改异常
  private startFuseTimerCleanup(): void {
    this.fuseCleanupTimer = setInterval(() => {
      const staleEntries = [...this.fuseTimers.entries()].filter(
        ([sessionId]) => !this.sessions.has(sessionId),
      )

      for (const [sessionId, timer] of staleEntries) {
        clearTimeout(timer)
        this.fuseTimers.delete(sessionId)
        this.fuseTexts.delete(sessionId)
      }
    }, FUSE_CLEANUP_INTERVAL_MS)
  }

  /**
   * Destroy a session: notify clients, close WebSockets, kill PTY, and clean up.
   *
   * @param sessionId - Target session id
   */
  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    // [M15修复] 关闭前先发送 ERROR 通知客户端
    this.broadcastControl(sessionId, {
      type: 'ERROR',
      message: 'Session is being destroyed',
    })

    const fuseTimer = this.fuseTimers.get(sessionId)
    if (fuseTimer) {
      clearTimeout(fuseTimer)
      this.fuseTimers.delete(sessionId)
    }
    this.fuseTexts.delete(sessionId)

    // [N4修复] 关闭 Terminal channel 前发送 ERROR 消息，告知关闭原因
    const termErrorMsg = JSON.stringify({ type: 'ERROR', message: 'Session destroyed' })
    for (const ws of session.termClients) {
      if (ws.readyState === 1) {
        ws.send(termErrorMsg)
      }
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

  /**
   * Get the current working directory of a session's tmux pane.
   * Returns the path relative to PROJECT_ROOT, or empty string if outside root.
   *
   * @param sessionId - Target session id
   * @returns Relative path from PROJECT_ROOT
   */
  async getCwd(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)
    try {
      const { stdout } = await execFileAsync('tmux', [
        'display-message',
        '-p',
        '-t',
        session.tmuxSessionName,
        '#{pane_current_path}',
      ])
      const absPath = stdout.trim()
      if (!absPath) return ''
      return absPath
    } catch {
      return ''
    }
  }

  /**
   * List all active sessions with details (for frontend restore).
   */
  listSessions(): Array<{
    sessionId: string
    status: AgentStatus
    tmuxSessionName: string
    adapterName: string
  }> {
    return [...this.sessions.values()].map((s) => ({
      sessionId: s.sessionId,
      status: s.status,
      tmuxSessionName: s.tmuxSessionName,
      adapterName: s.adapterName,
    }))
  }

  /**
   * Get all active session ids.
   *
   * @returns Array of session id strings
   */
  getSessionIds(): string[] {
    return [...this.sessions.keys()]
  }

  /**
   * List available tmux sessions not currently managed by this SessionManager.
   * Returns name, window count, and attached client count for each session.
   */
  async listAvailableTmuxSessions(): Promise<
    Array<{ name: string; windows: number; attached: number }>
  > {
    try {
      const { stdout } = await execFileAsync('tmux', [
        'list-sessions',
        '-F',
        '#{session_name}:#{session_windows}:#{session_attached}',
      ])
      const managedNames = new Set([...this.sessions.values()].map((s) => s.tmuxSessionName))
      return stdout
        .split('\n')
        .map((line) => {
          const [name, windows, attached] = line.trim().split(':')
          return { name, windows: Number(windows) || 0, attached: Number(attached) || 0 }
        })
        .filter((s) => s.name && !managedNames.has(s.name))
    } catch {
      return []
    }
  }

  /**
   * List ALL tmux sessions with full details (managed + external).
   */
  async listAllTmuxSessions(): Promise<
    Array<{
      name: string
      windows: number
      attached: number
      created: string
      isManaged: boolean
      adapterName?: string
    }>
  > {
    try {
      const { stdout } = await execFileAsync('tmux', [
        'list-sessions',
        '-F',
        '#{session_name}:#{session_windows}:#{session_attached}:#{session_created_string}',
      ])
      const managedMap = new Map<string, string>()
      for (const s of this.sessions.values()) {
        managedMap.set(s.tmuxSessionName, s.adapterName)
      }
      return stdout
        .split('\n')
        .map((line) => {
          const parts = line.trim().split(':')
          if (parts.length < 3 || !parts[0]) return null
          const name = parts[0]
          const isManaged = managedMap.has(name)
          return {
            name,
            windows: Number(parts[1]) || 0,
            attached: Number(parts[2]) || 0,
            created: parts.slice(3).join(':') || '',
            isManaged,
            adapterName: isManaged ? managedMap.get(name) : undefined,
          }
        })
        .filter((s): s is NonNullable<typeof s> => s !== null)
    } catch {
      return []
    }
  }

  /**
   * Kill a tmux session. For managed sessions, also cleans up in-memory state.
   */
  async killTmuxSession(name: string, userId: string): Promise<void> {
    const managedEntry = [...this.sessions.entries()].find(([, s]) => s.tmuxSessionName === name)
    if (managedEntry) {
      const [sessionId, session] = managedEntry
      if (session.ownerId !== userId) {
        throw new Error('Permission denied')
      }
      this.destroySession(sessionId)
    } else {
      await execFileAsync('tmux', ['kill-session', '-t', name])
    }
    auditLog('TMUX_KILL', undefined, { name, managed: !!managedEntry })
  }

  /**
   * Rename a tmux session. For managed sessions, updates internal tracking.
   */
  async renameTmuxSession(oldName: string, newName: string, userId: string): Promise<void> {
    if (!SAFE_SESSION_ID.test(newName)) {
      throw new Error(`Invalid session name: ${newName}`)
    }
    const managedEntry = [...this.sessions.entries()].find(([, s]) => s.tmuxSessionName === oldName)
    if (managedEntry) {
      const [sessionId, session] = managedEntry
      if (session.ownerId !== userId) {
        throw new Error('Permission denied')
      }
      await execFileAsync('tmux', ['rename-session', '-t', oldName, newName])
      session.tmuxSessionName = newName
      const persisted = this.sessionStore.get(sessionId)
      if (persisted) {
        persisted.tmuxSessionName = newName
        this.sessionStore.set(sessionId, persisted)
      }
    } else {
      await execFileAsync('tmux', ['rename-session', '-t', oldName, newName])
    }
    auditLog('TMUX_RENAME', undefined, { oldName, newName, managed: !!managedEntry })
  }

  /**
   * Check whether a session exists.
   *
   * @param sessionId - Session id to check
   * @returns true if the session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  /**
   * Get the owner (user id) of a session.
   *
   * @param sessionId - Target session id
   * @returns Owner user id, or null if session not found
   */
  // [C1修复] 获取会话归属用户ID
  getOwner(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.ownerId ?? null
  }

  /**
   * Get the CLI adapter bound to a session.
   *
   * @param sessionId - Target session id
   * @returns The CLIAdapter, or undefined if session not found
   */
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

  // [M2修复] 背压超阈值时通知客户端
  private sendBackpressureWarning(session: Session): void {
    this.broadcastControl(session.sessionId, {
      type: 'STATUS_UPDATE',
      sessionId: session.sessionId,
      status: session.status,
      message: 'Backpressure detected, data is being dropped',
    })
  }

  /**
   * Destroy all sessions and clean up timers. Call on server shutdown.
   */
  destroy(): void {
    if (this.errorRecoveryTimer) {
      clearInterval(this.errorRecoveryTimer)
      this.errorRecoveryTimer = null
    }

    // Destroy all active sessions (S10 fix)
    for (const sessionId of [...this.sessions.keys()]) {
      this.destroySession(sessionId)
    }

    // [R4修复] 清理 fuse timer cleanup interval
    if (this.fuseCleanupTimer) {
      clearInterval(this.fuseCleanupTimer)
      this.fuseCleanupTimer = null
    }

    // Clear all fuse timers
    for (const timer of this.fuseTimers.values()) {
      clearTimeout(timer)
    }
    this.fuseTimers.clear()
    this.fuseTexts.clear()

    // Flush any pending session store writes
    this.sessionStore.flush()
  }
}
