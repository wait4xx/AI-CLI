import { EventEmitter } from 'events'
import type { WebSocket } from 'ws'
import type { AgentStatus } from '@ai-cli/shared'
import type { CLIAdapter, StateCandidate } from '../adapters/base.js'
import { exec } from 'child_process'
import { promisify } from 'util'
import stripAnsi from 'strip-ansi'
import pty from 'node-pty'

const execAsync = promisify(exec)

const BACKPRESSURE_THRESHOLD = 1048576 // 1MB (ADR-017)
const THROTTLE_MS = 16
const STATE_FUSE_COOLDOWN_MS = 500 // state fusion debounce (ADR-008)
const SAFE_SESSION_ID = /^[a-zA-Z0-9_-]+$/

interface Session {
  sessionId: string
  adapter: CLIAdapter
  ptyProcess: pty.IPty
  status: AgentStatus
  termClients: Set<WebSocket>
  ctrlClients: Set<WebSocket>
  throttleTimer: NodeJS.Timeout | null
  outputBuffer: Buffer[]
  lastBroadcast: number
}

export class SessionManager extends EventEmitter {
  private sessions = new Map<string, Session>()
  private adapters: Map<string, CLIAdapter>
  private fuseTimers = new Map<string, NodeJS.Timeout>()

  constructor(adapters: Map<string, CLIAdapter>) {
    super()
    this.adapters = adapters
    this.checkTmuxAvailable()
    this.reapOrphanSessions().catch((err) => {
      console.error('Failed to reap orphan sessions:', err.message)
    })
  }

  private async checkTmuxAvailable(): Promise<void> {
    try {
      await execAsync('which tmux')
    } catch {
      console.error('FATAL: tmux is not installed or not in PATH. Session management requires tmux.')
      process.exit(1)
    }
  }

  createOrAttachSession(
    sessionId: string,
    cols: number,
    rows: number,
    adapterName: string,
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
      adapter,
      ptyProcess,
      status: 'IDLE',
      termClients: new Set(),
      ctrlClients: new Set(),
      throttleTimer: null,
      outputBuffer: [],
      lastBroadcast: 0,
    }

    ptyProcess.onData((data: string) => {
      this.onData(session, data)
    })

    ptyProcess.onExit(({ exitCode }) => {
      // 信号3: exit code ≠ 0 → 强制 ERROR (ADR-008)
      if (exitCode !== 0) {
        this.updateStatus(session, 'ERROR', `Process exited with code ${exitCode}`)
      } else {
        this.updateStatus(session, 'IDLE')
      }
    })

    this.sessions.set(sessionId, session)
    return session
  }

  private onData(session: Session, data: string): void {
    session.outputBuffer.push(Buffer.from(data, 'utf-8'))

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

    // 广播给所有 termClients，含背压控制 (ADR-017)
    for (const client of session.termClients) {
      if (client.readyState !== 1) continue // WebSocket.OPEN = 1
      if (client.bufferedAmount > BACKPRESSURE_THRESHOLD) {
        continue // 丢弃当前帧，终端画面是覆盖式的
      }
      client.send(merged)
    }

    session.lastBroadcast = Date.now()

    // Debounced state fusion — avoid capture-pane storm (ADR-008)
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
    // 信号1: 流式正则
    const candidate = session.adapter.parseStreamData(text)
    if (!candidate || candidate.confidence <= 0.5) return

    // 信号2: 按需 capture-pane 二次确认 (ADR-012, ADR-016)
    const tmuxSessionName = `aicli-${session.sessionId}`
    try {
      const { stdout } = await execAsync(
        `tmux capture-pane -p -t ${tmuxSessionName}`,
      )
      const screenStatus = session.adapter.parseScreenSnapshot(stdout)

      if (screenStatus !== null) {
        // 以 screenStatus 为准（高可信度）
        this.updateStatus(session, screenStatus)
      } else {
        // screen 未匹配到确定状态，但 candidate 有一定置信度
        this.updateStatus(session, candidate.status)
      }
    } catch {
      // capture-pane 失败（tmux session 可能已销毁），信任 candidate
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

      // 发送当前屏幕内容以恢复终端画面
      const tmuxSessionName = `aicli-${sessionId}`
      execAsync(`tmux capture-pane -p -t ${tmuxSessionName}`)
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

  detachClient(
    sessionId: string,
    termWs?: WebSocket,
    ctrlWs?: WebSocket,
  ): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    if (termWs) session.termClients.delete(termWs)
    if (ctrlWs) session.ctrlClients.delete(ctrlWs)
    // 不销毁 session — tmux 保活
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
    // ADR-006: 仅回收 aicli-* 前缀中不在内存 Map 的 session
    try {
      const { stdout } = await execAsync(
        'tmux list-sessions -F "#{session_name}"',
      )
      const allSessions = stdout
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)

      const orphanSessions = allSessions.filter((name) => {
        if (!name.startsWith('aicli-')) return false // 严禁触碰非 aicli- 前缀的宿主 tmux session
        const sessionId = name.slice('aicli-'.length)
        return !this.sessions.has(sessionId)
      })

      for (const name of orphanSessions) {
        await execAsync(`tmux kill-session -t ${name}`)
      }

      if (orphanSessions.length > 0) {
        console.log(`Reaped ${orphanSessions.length} orphan tmux session(s)`)
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

    try {
      session.ptyProcess.kill()
    } catch {
      // Process may already be dead
    }

    this.sessions.delete(sessionId)
  }

  getSessionIds(): string[] {
    return [...this.sessions.keys()]
  }

  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  getAdapterForSession(sessionId: string): CLIAdapter | undefined {
    return this.sessions.get(sessionId)?.adapter
  }
}
