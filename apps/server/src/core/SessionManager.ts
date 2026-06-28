import { EventEmitter } from 'events'
import type { WebSocket } from 'ws'
import type { AgentStatus } from '@ai-cli/shared'
import { TERM_COLS_MIN, TERM_COLS_MAX, TERM_ROWS_MIN, TERM_ROWS_MAX } from '@ai-cli/shared'
import type { CLIAdapter } from '../adapters/base.js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import stripAnsi from 'strip-ansi'
import pty from 'node-pty'
import os from 'os'
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

export interface DeviceEntry {
  id: string
  ws: WebSocket
  ctrlWs?: WebSocket
  username: string
  role: 'controller' | 'observer'
  connectedAt: number
  deviceName: string
  pendingRequestId?: string
}

interface Session {
  sessionId: string
  ownerId: string
  adapterName: string
  adapter: CLIAdapter
  ptyProcess: pty.IPty
  tmuxSessionName: string
  status: AgentStatus
  termClients: Set<WebSocket>
  ctrlClients: Set<WebSocket>
  observeClients: Set<WebSocket>
  devices: Map<string, DeviceEntry>
  controllerDeviceId: string | null
  sharedWith: Map<string, 'read' | 'write'> // userId → permission
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
  private creatingSessions = new Set<string>()

  constructor(adapters: Map<string, CLIAdapter>) {
    super()
    this.adapters = adapters
    this.sessionStore = new SessionStore()
    // [M-#5修复] load() 已改为异步，移至 init() 中 await 调用
  }

  // [M-#5修复] 异步初始化：加载持久化数据、检查 tmux、清理孤儿会话
  async init(): Promise<void> {
    await this.sessionStore.load()
    await this.checkTmuxAvailable()
    await this.reapOrphanSessions()
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

    if (this.creatingSessions.has(sessionId)) {
      throw new Error('Session creation in progress')
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

    this.creatingSessions.add(sessionId)
    try {
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
        // [S-H2] Validate tmux session name to prevent injection
        if (!SAFE_SESSION_ID.test(attachToTmux)) {
          throw new Error(`Invalid tmux session name: ${attachToTmux}`)
        }
        // Attach to existing tmux session — pass cols/rows so tmux uses our
        // terminal dimensions instead of the previous client's dimensions.
        // Without this, the screen capture has wrong cursor position.
        tmuxSessionName = attachToTmux
        ptyProcess = pty.spawn('tmux', ['attach', '-t', attachToTmux], { cols, rows })
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
            (cwd?.startsWith('~') ? cwd.replace(/^~/, os.homedir()) : cwd) ||
              getConfig().PROJECT_ROOT,
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
        devices: new Map(),
        controllerDeviceId: null,
        sharedWith: new Map(),
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
        // Auto-destroy session after brief delay so user sees the exit message
        // This handles cases like Claude Code permission denied where the terminal is useless after exit
        setTimeout(() => {
          if (this.sessions.has(sessionId)) {
            this.destroySession(sessionId)
          }
        }, 2000)
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
    } finally {
      this.creatingSessions.delete(sessionId)
    }
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
      const { stdout } = await execFileAsync('tmux', [
        'capture-pane',
        '-p',
        '-t',
        session.tmuxSessionName,
      ])
      const screenResult = session.adapter.parseScreenSnapshot(stdout)

      if (typeof screenResult === 'object' && screenResult !== null && 'status' in screenResult) {
        if (screenResult.status !== null) {
          this.updateStatus(session, screenResult.status, undefined, screenResult.options)
        }
      } else if (screenResult !== null) {
        this.updateStatus(session, screenResult as AgentStatus)
      } else {
        this.updateStatus(session, candidate.status)
      }
    } catch {
      this.updateStatus(session, candidate.status)
    }
  }

  private updateStatus(
    session: Session,
    newStatus: AgentStatus,
    message?: string,
    options?: Array<{ label: string; payload: string }>,
  ): void {
    const changed = session.status !== newStatus
    if (!changed && !options) return

    session.status = newStatus
    this.emit('statusChange', session.sessionId, newStatus)
    this.broadcastControl(session.sessionId, {
      type: 'STATUS_UPDATE',
      sessionId: session.sessionId,
      status: newStatus,
      ...(message ? { message } : {}),
      ...(options ? { options } : {}),
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
      // 立即加入 termClients，确保后续 PTY 输出不会丢失
      session.termClients.add(termWs)

      // 延迟 300ms 等待 tmux 处理完 resize 后再捕获屏幕
      // DOM 渲染器能正确处理大量 ANSI 数据，使用 -S -3000 恢复历史
      setTimeout(() => {
        Promise.all([
          execFileAsync('tmux', [
            'capture-pane',
            '-p',
            '-e',
            '-S',
            '-3000',
            '-t',
            session.tmuxSessionName,
          ]),
          execFileAsync('tmux', [
            'display-message',
            '-t',
            session.tmuxSessionName,
            '-p',
            '#{cursor_x} #{cursor_y}',
          ]),
        ])
          .then(([captureResult, cursorResult]) => {
            if (termWs.readyState !== 1) return
            const stdout = captureResult.stdout
            if (stdout) {
              termWs.send(Buffer.from('\x1b[2J\x1b[H' + stdout))
            }
            const match = cursorResult.stdout?.trim().match(/(\d+)\s+(\d+)/)
            if (match) {
              const col = parseInt(match[1]) + 1
              const row = parseInt(match[2]) + 1
              termWs.send(Buffer.from(`\x1b[${row};${col}H`))
            }
          })
          .catch(() => {
            /* best-effort screen capture */
          })
      }, 300)
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

    // 延迟后捕获屏幕含历史，DOM 渲染器可正确处理
    setTimeout(() => {
      Promise.all([
        execFileAsync('tmux', [
          'capture-pane',
          '-p',
          '-e',
          '-S',
          '-3000',
          '-t',
          session.tmuxSessionName,
        ]),
        execFileAsync('tmux', [
          'display-message',
          '-t',
          session.tmuxSessionName,
          '-p',
          '#{cursor_x} #{cursor_y}',
        ]),
      ])
        .then(([captureResult, cursorResult]) => {
          if (ws.readyState !== 1) return
          const stdout = captureResult.stdout
          if (stdout) {
            ws.send(Buffer.from('\x1b[2J\x1b[H' + stdout))
          }
          const match = cursorResult.stdout?.trim().match(/(\d+)\s+(\d+)/)
          if (match) {
            const col = parseInt(match[1]) + 1
            const row = parseInt(match[2]) + 1
            ws.send(Buffer.from(`\x1b[${row};${col}H`))
          }
        })
        .catch(() => {
          /* best-effort tmux capture */
        })
    }, 300)
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

  // ========== Device Management ==========

  registerDevice(
    sessionId: string,
    termWs: WebSocket,
    ctrlWs: WebSocket,
    username: string,
    deviceName: string,
  ): { deviceId: string; isObserver: boolean } {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error(`Session not found: ${sessionId}`)

    const deviceId = crypto.randomUUID()

    // 清除同一用户的旧设备（页面刷新/重连时避免竞争条件）
    // 如果旧设备是 controller，新设备直接继承 controller 角色
    let inheritController = false
    for (const [oldId, dev] of session.devices) {
      if (dev.username === username) {
        if (session.controllerDeviceId === oldId) {
          inheritController = true
        }
        session.devices.delete(oldId)
        // 关闭旧 WS 连接（可能还半开）
        try {
          dev.ws.close()
        } catch {
          /* already closed */
        }
        try {
          dev.ctrlWs?.close()
        } catch {
          /* already closed */
        }
        break
      }
    }

    const isObserver = inheritController ? false : session.controllerDeviceId !== null

    const device: DeviceEntry = {
      id: deviceId,
      ws: termWs,
      ctrlWs,
      username,
      role: isObserver ? 'observer' : 'controller',
      connectedAt: Date.now(),
      deviceName: deviceName || 'Unknown',
    }

    if (!isObserver) {
      session.controllerDeviceId = deviceId
    }

    session.devices.set(deviceId, device)
    return { deviceId, isObserver }
  }

  unregisterDevice(sessionId: string, deviceId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.devices.delete(deviceId)
    if (session.controllerDeviceId === deviceId) {
      session.controllerDeviceId = null
      // Promote first available device to controller
      for (const [id, dev] of session.devices) {
        dev.role = 'controller'
        session.controllerDeviceId = id
        dev.ctrlWs?.send(JSON.stringify({ type: 'CONTROL_GRANTED', sessionId }))
        break
      }
    }
  }

  requestControl(sessionId: string, requesterCtrlWs: WebSocket, username: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return

    const controller = session.controllerDeviceId
      ? session.devices.get(session.controllerDeviceId)
      : null
    const requestId = crypto.randomUUID()

    // Store pendingRequestId on the requester's device
    for (const dev of session.devices.values()) {
      if (dev.ctrlWs === requesterCtrlWs) {
        dev.pendingRequestId = requestId
        break
      }
    }

    if (controller?.ctrlWs && controller.ctrlWs.readyState === 1) {
      controller.ctrlWs.send(
        JSON.stringify({
          type: 'CONTROL_REQUESTED',
          sessionId,
          requestId,
          deviceName: 'Device',
          username,
        }),
      )
    }
  }

  grantControl(sessionId: string, requestId: string, currentControllerCtrlWs: WebSocket): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    // Only the current controller may hand off control — otherwise any
    // connected device (e.g. an observer) could approve a pending request and
    // seize/redirect control without the controller's consent.
    const controller = session.controllerDeviceId
      ? session.devices.get(session.controllerDeviceId)
      : null
    if (!controller || controller.ctrlWs !== currentControllerCtrlWs) return false

    // Find the requester by matching pendingRequestId
    for (const [id, dev] of session.devices) {
      if (dev.role === 'observer' && dev.pendingRequestId === requestId) {
        // Demote current controller
        if (session.controllerDeviceId) {
          const current = session.devices.get(session.controllerDeviceId)
          if (current) {
            current.role = 'observer'
            current.ctrlWs?.send(
              JSON.stringify({ type: 'OBSERVER_MODE', sessionId, isObserver: true }),
            )
          }
        }
        // Promote this observer
        dev.role = 'controller'
        session.controllerDeviceId = id
        dev.pendingRequestId = undefined
        dev.ctrlWs?.send(JSON.stringify({ type: 'CONTROL_GRANTED', sessionId }))
        return true
      }
    }
    return false
  }

  forceTakeControl(sessionId: string, requesterCtrlWs: WebSocket, isAdmin: boolean): void {
    if (!isAdmin) return
    const session = this.sessions.get(sessionId)
    if (!session) return

    // Find device by ctrlWs
    for (const [id, dev] of session.devices) {
      if (dev.ctrlWs === requesterCtrlWs) {
        // Demote current controller
        if (session.controllerDeviceId && session.controllerDeviceId !== id) {
          const current = session.devices.get(session.controllerDeviceId)
          if (current) {
            current.role = 'observer'
            current.ctrlWs?.send(
              JSON.stringify({ type: 'OBSERVER_MODE', sessionId, isObserver: true }),
            )
          }
        }
        dev.role = 'controller'
        session.controllerDeviceId = id
        dev.ctrlWs?.send(JSON.stringify({ type: 'CONTROL_GRANTED', sessionId }))
        return
      }
    }
  }

  getConnectedDevices(sessionId: string): Array<{
    id: string
    deviceName: string
    username: string
    role: string
    connectedAt: number
  }> {
    const session = this.sessions.get(sessionId)
    if (!session) return []
    return [...session.devices.values()].map((d) => ({
      id: d.id,
      deviceName: d.deviceName,
      username: d.username,
      role: d.role,
      connectedAt: d.connectedAt,
    }))
  }

  isDeviceController(sessionId: string, ws: WebSocket): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || !session.controllerDeviceId) return true // no devices tracked yet = allow
    const controller = session.devices.get(session.controllerDeviceId)
    if (!controller) return true
    // Check if this ws is the controller's term WS
    return controller.ws === ws
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
   * Check whether a resize should be applied for this session.
   * When multiple terminal clients are attached, skip resize to prevent
   * multi-device rendering conflicts (each device has different screen size).
   */
  shouldResize(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    // Always allow resize — each device sends its own dimensions.
    // The last resize wins, which is correct for the active device.
    return true
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
        // [M-#9修复] 验证 tmux 会话名格式，过滤非法名称
        .filter((name) => SAFE_SESSION_ID.test(name))

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

    // Notify clients that the session is being destroyed
    this.broadcastControl(sessionId, {
      type: 'SESSION_DESTROYED',
      sessionId,
    } as { type: 'SESSION_DESTROYED'; sessionId: string })

    const fuseTimer = this.fuseTimers.get(sessionId)
    if (fuseTimer) {
      clearTimeout(fuseTimer)
      this.fuseTimers.delete(sessionId)
    }
    this.fuseTexts.delete(sessionId)

    // Clean up throttle timer
    if (session.throttleTimer) {
      clearTimeout(session.throttleTimer)
      session.throttleTimer = null
    }

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

    void execFileAsync('tmux', ['kill-session', '-t', session.tmuxSessionName]).catch(() => {
      /* tmux session may already be gone */
    })

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

  // [M-#3修复] 按用户过滤会话：admin 返回全部，普通用户只返回自己的和被共享的
  listSessionsForUser(
    userId: string,
    role: string,
  ): Array<{
    sessionId: string
    status: AgentStatus
    tmuxSessionName: string
    adapterName: string
  }> {
    const all = [...this.sessions.values()]
    if (role === 'admin') {
      return all.map((s) => ({
        sessionId: s.sessionId,
        status: s.status,
        tmuxSessionName: s.tmuxSessionName,
        adapterName: s.adapterName,
      }))
    }
    return all
      .filter((s) => s.ownerId === userId || s.sharedWith.has(userId))
      .map((s) => ({
        sessionId: s.sessionId,
        status: s.status,
        tmuxSessionName: s.tmuxSessionName,
        adapterName: s.adapterName,
      }))
  }

  /**
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

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId)
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

  // ========== Session Sharing ==========

  shareSession(
    sessionId: string,
    ownerId: string,
    targetUserId: string,
    permission: 'read' | 'write',
  ): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || session.ownerId !== ownerId) return false
    session.sharedWith.set(targetUserId, permission)
    return true
  }

  unshareSession(sessionId: string, ownerId: string, targetUserId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session || session.ownerId !== ownerId) return false
    session.sharedWith.delete(targetUserId)
    return true
  }

  getSharedSessions(
    userId: string,
  ): Array<{ sessionId: string; ownerId: string; permission: string }> {
    const result: Array<{ sessionId: string; ownerId: string; permission: string }> = []
    for (const session of this.sessions.values()) {
      const perm = session.sharedWith.get(userId)
      if (perm) {
        result.push({ sessionId: session.sessionId, ownerId: session.ownerId, permission: perm })
      }
    }
    return result
  }

  getSessionPermission(sessionId: string, userId: string): 'owner' | 'read' | 'write' | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    if (session.ownerId === userId) return 'owner'
    return session.sharedWith.get(userId) ?? null
  }

  /**
   * Destroy all sessions and clean up timers. Call on server shutdown.
   */
  async destroy(): Promise<void> {
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
    await this.sessionStore.flush()
  }

  // ========== Tmux Pane Management ==========

  async getPanes(
    sessionId: string,
  ): Promise<Array<{ index: number; title: string; active: boolean; command: string }>> {
    const session = this.sessions.get(sessionId)
    if (!session) return []
    try {
      const { stdout } = await execFileAsync('tmux', [
        'list-panes',
        '-t',
        session.tmuxSessionName,
        '-F',
        '#{pane_index}:#{pane_title}:#{pane_active}:#{pane_current_command}',
      ])
      return stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [idx, title, active, command] = line.split(':')
          return { index: parseInt(idx), title, active: active === '1', command }
        })
    } catch {
      return []
    }
  }

  async selectPane(sessionId: string, paneIndex: number): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) return false
    try {
      const target = `${session.tmuxSessionName}:0.${paneIndex}`
      // If already zoomed, unzoom first
      await execFileAsync('tmux', ['resize-pane', '-Z', '-t', session.tmuxSessionName]).catch(
        () => {},
      )
      // Select and zoom the target pane
      await execFileAsync('tmux', ['select-pane', '-t', target])
      await execFileAsync('tmux', ['resize-pane', '-Z', '-t', target])
      // Re-capture and send to all term clients
      await this.recaptureScreen(session)
      return true
    } catch {
      return false
    }
  }

  private async recaptureScreen(session: Session): Promise<void> {
    try {
      const [captureResult, cursorResult] = await Promise.all([
        execFileAsync('tmux', [
          'capture-pane',
          '-p',
          '-e',
          '-S',
          '-3000',
          '-t',
          session.tmuxSessionName,
        ]),
        execFileAsync('tmux', [
          'display-message',
          '-t',
          session.tmuxSessionName,
          '-p',
          '#{cursor_x} #{cursor_y}',
        ]),
      ])
      const buf = Buffer.from('\x1b[2J\x1b[H' + captureResult.stdout)
      for (const client of session.termClients) {
        if (client.readyState === 1) client.send(buf)
      }
      for (const client of session.observeClients) {
        if (client.readyState === 1) client.send(buf)
      }
      const match = cursorResult.stdout?.trim().match(/(\d+)\s+(\d+)/)
      if (match) {
        const cursorBuf = Buffer.from(`\x1b[${parseInt(match[2]) + 1};${parseInt(match[1]) + 1}H`)
        for (const client of session.termClients) {
          if (client.readyState === 1) client.send(cursorBuf)
        }
        for (const client of session.observeClients) {
          if (client.readyState === 1) client.send(cursorBuf)
        }
      }
    } catch {
      /* best-effort */
    }
  }
}
