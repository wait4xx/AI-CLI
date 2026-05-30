import { WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { JwtPayload, TERM_PING, TERM_PONG, TERM_COLS_MIN, TERM_COLS_MAX, TERM_ROWS_MIN, TERM_ROWS_MAX, ControlClientMessage } from '@ai-cli/shared'
import { SessionManager } from './SessionManager.js'
import { pinoLogger } from '../lib/logger.js'

const PING_INTERVAL_MS = 30000

/**
 * WSGateway — WebSocket connection handler for terminal and control channels.
 *
 * Manages authentication (JWT), terminal data forwarding,
 * control message dispatch, and keep-alive probes.
 */
export class WSGateway {
  private sessionManager: SessionManager
  private jwtSecret: string
  private jwtRefreshSecret: string

  private pingTimers = new Map<WebSocket, NodeJS.Timeout>()

  constructor(sessionManager: SessionManager, jwtSecret: string, jwtRefreshSecret: string) {
    this.sessionManager = sessionManager
    this.jwtSecret = jwtSecret
    this.jwtRefreshSecret = jwtRefreshSecret
  }

  // ========== Terminal Channel ==========

  /**
   * Handle a new terminal WebSocket connection.
   * Auth is already verified at the HTTP upgrade level (query-param token).
   * Accepts ATTACH_SESSION then switches to binary mode.
   *
   * @param ws - The incoming WebSocket connection
   * @param user - The authenticated user (verified via query-param JWT)
   */
  handleTerminalConnection(ws: WebSocket, user: JwtPayload): void {
    let sessionId: string | null = null

    pinoLogger.info({ userId: user.userId }, 'Terminal WS connected (pre-authenticated)')

    ws.on('message', (data: Buffer) => {
      // No session attached yet — accept ATTACH_SESSION
      if (sessionId === null) {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ATTACH_SESSION' && msg.sessionId) {
            if (!this.sessionManager.hasSession(msg.sessionId)) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
              return
            }
            const owner = this.sessionManager.getOwner(msg.sessionId)
            if (owner && owner !== user.userId) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
              return
            }
            sessionId = msg.sessionId
            pinoLogger.info({ sessionId }, 'Terminal WS attached to session')
            this.sessionManager.attachClient(sessionId!, ws, undefined)
          }
        } catch {
          // binary data before ATTACH, discard
        }
        return
      }

      // Binary mode: PING (0x00) or keyboard input
      if (data.length === 1 && data[0] === TERM_PING) {
        ws.send(Buffer.from([TERM_PONG]))
        return
      }

      // Forward keyboard input to pty
      this.sessionManager.sendInput(sessionId!, data)
    })

    ws.on('close', () => {
      this.cleanupPing(ws)
      pinoLogger.info({ sessionId }, 'Terminal WS disconnected')
      if (sessionId) {
        this.sessionManager.detachClient(sessionId, ws, undefined)
      }
    })

    this.setupTerminalKeepAlive(ws)
  }

  // ========== Control Channel ==========

  /**
   * Handle a new control WebSocket connection.
   * Auth is already verified at the HTTP upgrade level (query-param token).
   * Dispatches JSON control messages immediately.
   *
   * @param ws - The incoming WebSocket connection
   * @param user - The authenticated user (verified via query-param JWT)
   */
  handleControlConnection(ws: WebSocket, user: JwtPayload): void {
    let currentSessionId: string | null = null

    pinoLogger.info({ username: user.username }, 'Control WS connected (pre-authenticated)')

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString())
        this.handleControlMessage(ws, msg, currentSessionId, user, (sid) => { currentSessionId = sid })
      } catch {
        // invalid JSON
      }
    })

    ws.on('close', () => {
      this.cleanupPing(ws)
      pinoLogger.info({ sessionId: currentSessionId }, 'Control WS disconnected')
      if (currentSessionId) {
        this.sessionManager.detachClient(currentSessionId, undefined, ws)
        this.sessionManager.detachObserver(currentSessionId, ws)
      }
    })

    this.setupControlKeepAlive(ws)
  }

  // ========== Session Access Validation ==========

  // [Q3修复] 提取公共的 session 校验逻辑
  private validateSessionAccess(
    ws: WebSocket,
    sessionId: string,
    currentUser: JwtPayload | null,
  ): boolean {
    if (ws.readyState !== WebSocket.OPEN) return false
    if (!this.sessionManager.hasSession(sessionId)) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
      return false
    }
    if (!currentUser) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }))
      return false
    }
    const owner = this.sessionManager.getOwner(sessionId)
    if (!owner || owner !== currentUser.userId) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
      return false
    }
    return true
  }

  // ========== Control Message Dispatch ==========

  private handleControlMessage(
    ws: WebSocket,
    msg: ControlClientMessage,
    currentSessionId: string | null,
    currentUser: JwtPayload | null,  // [C1修复] 当前认证用户，用于会话权限校验
    setSessionId: (sid: string) => void,
  ): void {

    // [C3修复] 终端尺寸范围限制（使用 shared 常量）

    switch (msg.type) {
      case 'PING':
        ws.send(JSON.stringify({ type: 'PONG' }))
        break

      case 'REFRESH': {
        try {
          const decoded = jwt.verify(msg.refreshToken, this.jwtRefreshSecret) as JwtPayload
          const newAccessToken = jwt.sign(
            { userId: decoded.userId, username: decoded.username },
            this.jwtSecret,
            { expiresIn: '15m' },
          )
          ws.send(JSON.stringify({ type: 'TOKEN_RENEWED', accessToken: newAccessToken }))
        } catch {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid refresh token' }))
        }
        break
      }

      case 'INIT_SESSION': {
        const { sessionId, cols, rows, adapter } = msg
        const attachToTmux = (msg as { attachToTmux?: string }).attachToTmux
        const cwd = (msg as { cwd?: string }).cwd
        // [C3修复] 校验终端尺寸参数范围
        const safeCols = Math.max(TERM_COLS_MIN, Math.min(TERM_COLS_MAX, Math.floor(cols) || 80))
        const safeRows = Math.max(TERM_ROWS_MIN, Math.min(TERM_ROWS_MAX, Math.floor(rows) || 24))
        try {
          // [C1修复] 传入 ownerId (currentUser.userId)
          if (!currentUser) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }))
            break
          }
          this.sessionManager.createOrAttachSession(sessionId, safeCols, safeRows, adapter, currentUser.userId, attachToTmux, cwd)
          this.sessionManager.attachClient(sessionId, undefined, ws)
          setSessionId(sessionId)
          ws.send(JSON.stringify({ type: 'SESSION_READY', sessionId }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'ATTACH_SESSION': {
        const { sessionId } = msg
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) return
        try {
          this.sessionManager.attachClient(sessionId, undefined, ws)
          setSessionId(sessionId)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'RESIZE': {
        if (!currentSessionId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No active session' }))
          break
        }
        // [R8修复] RESIZE 也需要校验会话归属
        if (!this.validateSessionAccess(ws, currentSessionId, currentUser)) break
        if (msg.cols && msg.rows) {
          // [C3修复] 校验终端尺寸参数范围
          const safeCols = Math.max(TERM_COLS_MIN, Math.min(TERM_COLS_MAX, Math.floor(msg.cols) || 80))
          const safeRows = Math.max(TERM_ROWS_MIN, Math.min(TERM_ROWS_MAX, Math.floor(msg.rows) || 24))
          try {
            this.sessionManager.resize(currentSessionId, safeCols, safeRows)
          } catch (err) {
            // session may have been destroyed
            pinoLogger.warn({ err, sessionId: currentSessionId }, 'RESIZE failed — session may have been destroyed')
          }
        }
        break
      }

      case 'QUICK_ACTION': {
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!currentSessionId || !this.validateSessionAccess(ws, currentSessionId, currentUser)) break
        if (msg.payload) {
          this.sessionManager.sendQuickAction(currentSessionId, msg.payload)
        }
        break
      }

      case 'INJECT_CODE': {
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!currentSessionId || !this.validateSessionAccess(ws, currentSessionId, currentUser)) break
        // [Q2修复] 服务端 INJECT_CODE 大小兜底校验（1MB）
        const INJECT_CODE_MAX_SIZE = 1048576
        if (msg.code && Buffer.byteLength(msg.code, 'utf-8') > INJECT_CODE_MAX_SIZE) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'INJECT_CODE exceeds maximum size (1MB)' }))
          break
        }
        if (msg.code) {
          this.sessionManager.sendInput(currentSessionId, msg.code)
        }
        break
      }

      case 'OBSERVE_SESSION': {
        const { sessionId } = msg
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) return
        try {
          this.sessionManager.attachObserver(sessionId, ws)
          setSessionId(sessionId)
          ws.send(JSON.stringify({ type: 'SESSION_READY', sessionId }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'START_RECORDING': {
        if (!currentSessionId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No active session' }))
          break
        }
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, currentSessionId, currentUser)) break
        try {
          this.sessionManager.startRecording(currentSessionId)
          const status = this.sessionManager.getRecordingStatus(currentSessionId)
          ws.send(JSON.stringify({ type: 'RECORDING_STATUS', sessionId: currentSessionId, ...status }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'STOP_RECORDING': {
        if (!currentSessionId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No active session' }))
          break
        }
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, currentSessionId, currentUser)) break
        try {
          this.sessionManager.stopRecording(currentSessionId)
          const status = this.sessionManager.getRecordingStatus(currentSessionId)
          ws.send(JSON.stringify({ type: 'RECORDING_STATUS', sessionId: currentSessionId, ...status }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }

      case 'GET_RECORDING': {
        const { sessionId, startTime, endTime } = msg
        // [Q3修复] 使用 validateSessionAccess 统一校验
        if (!this.validateSessionAccess(ws, sessionId, currentUser)) break
        try {
          const chunks = this.sessionManager.getRecording(sessionId, startTime, endTime)
          // [M10修复] 使用 base64 替代 Array.from 避免内存膨胀
          const data = chunks.map((c) => ({ data: c.data.toString('base64'), timestamp: c.timestamp }))
          ws.send(JSON.stringify({ type: 'RECORDING_DATA', sessionId, data }))
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          ws.send(JSON.stringify({ type: 'ERROR', message }))
        }
        break
      }
    }
  }

  // ========== Keep-Alive ==========

  private setupTerminalKeepAlive(ws: WebSocket): void {
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send PONG (0x01) as server-side keep-alive probe
        ws.send(Buffer.from([TERM_PONG]))
      }
    }, PING_INTERVAL_MS)
    this.pingTimers.set(ws, timer)
  }

  private setupControlKeepAlive(ws: WebSocket): void {
    const timer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'PING' }))
      }
    }, PING_INTERVAL_MS)
    this.pingTimers.set(ws, timer)
  }

  private cleanupPing(ws: WebSocket): void {
    const timer = this.pingTimers.get(ws)
    if (timer) {
      clearInterval(timer)
      this.pingTimers.delete(ws)
    }
  }

  /**
   * Destroy the gateway: close all WebSocket connections and clear keep-alive timers.
   * Call on server shutdown.
   */
  destroy(): void {
    for (const timer of this.pingTimers.values()) {
      clearInterval(timer)
    }
    this.pingTimers.clear()
  }
}
