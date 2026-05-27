import { WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { JwtPayload, PROTOCOL_VERSION, WS_CLOSE_CODE, TERM_PING, TERM_PONG, ControlClientMessage } from '@ai-cli/shared'
import { SessionManager } from './SessionManager.js'
import { pinoLogger } from '../lib/logger.js'

enum WSState {
  UNAUTHENTICATED,
  AUTHENTICATED,
}

const AUTH_TIMEOUT_MS = 5000
const PING_INTERVAL_MS = 30000

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

  handleTerminalConnection(ws: WebSocket): void {
    let state = WSState.UNAUTHENTICATED
    let sessionId: string | null = null

    pinoLogger.info('Terminal WS connected')

    const authTimeout = setTimeout(() => {
      if (state === WSState.UNAUTHENTICATED) {
        pinoLogger.warn('Terminal WS auth timeout')
        ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Auth timeout')
      }
    }, AUTH_TIMEOUT_MS)

    ws.on('message', (data: Buffer) => {
      if (state === WSState.UNAUTHENTICATED) {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'AUTH') {
            this.verifyAuth(ws, msg, (payload) => {
              clearTimeout(authTimeout)
              state = WSState.AUTHENTICATED
              pinoLogger.info({ sessionId: payload.userId }, 'Terminal WS authenticated')
              ws.send(JSON.stringify({ type: 'AUTH_OK' }))
            })
          }
        } catch {
          // invalid JSON in UNAUTHENTICATED state, discard
        }
        return
      }

      // AUTHENTICATED but no session attached yet — accept ATTACH
      if (sessionId === null) {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.type === 'ATTACH_SESSION' && msg.sessionId) {
            if (!this.sessionManager.hasSession(msg.sessionId)) {
              ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
              return
            }
            sessionId = msg.sessionId
            pinoLogger.info({ sessionId }, 'Terminal WS attached to session')
            this.sessionManager.attachClient(sessionId!, ws, undefined)
            // Switch to binary mode — no more JSON expected
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
      clearTimeout(authTimeout)
      this.cleanupPing(ws)
      pinoLogger.info({ sessionId }, 'Terminal WS disconnected')
      if (sessionId) {
        this.sessionManager.detachClient(sessionId, ws, undefined)
      }
    })

    this.setupTerminalKeepAlive(ws)
  }

  // ========== Control Channel ==========

  handleControlConnection(ws: WebSocket): void {
    let state = WSState.UNAUTHENTICATED
    let currentUser: JwtPayload | null = null
    let currentSessionId: string | null = null

    pinoLogger.info('Control WS connected')

    const authTimeout = setTimeout(() => {
      if (state === WSState.UNAUTHENTICATED) {
        pinoLogger.warn('Control WS auth timeout')
        ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Auth timeout')
      }
    }, AUTH_TIMEOUT_MS)

    ws.on('message', (raw: Buffer) => {
      if (state === WSState.UNAUTHENTICATED) {
        try {
          const msg = JSON.parse(raw.toString())
          if (msg.type === 'AUTH') {
            this.verifyAuth(ws, msg, (payload) => {
              clearTimeout(authTimeout)
              state = WSState.AUTHENTICATED
              currentUser = payload
              pinoLogger.info({ username: payload.username }, 'Control WS authenticated')
              ws.send(JSON.stringify({ type: 'AUTH_OK' }))
            })
          }
        } catch {
          // invalid JSON, discard
        }
        return
      }

      // AUTHENTICATED
      try {
        const msg = JSON.parse(raw.toString())
        // [C1/W14修复] 传入 currentUser 用于会话权限校验
        this.handleControlMessage(ws, msg, currentSessionId, currentUser, (sid) => { currentSessionId = sid })
      } catch {
        // invalid JSON
      }
    })

    ws.on('close', () => {
      clearTimeout(authTimeout)
      this.cleanupPing(ws)
      pinoLogger.info({ sessionId: currentSessionId }, 'Control WS disconnected')
      if (currentSessionId) {
        this.sessionManager.detachClient(currentSessionId, undefined, ws)
        this.sessionManager.detachObserver(currentSessionId, ws)
      }
    })

    this.setupControlKeepAlive(ws)
  }

  // ========== Auth ==========

  private verifyAuth(
    ws: WebSocket,
    msg: { accessToken?: string; protocolVersion?: string },
    onSuccess: (payload: JwtPayload) => void,
  ): void {
    if (msg.protocolVersion && msg.protocolVersion !== PROTOCOL_VERSION) {
      ws.close(WS_CLOSE_CODE.PROTOCOL_MISMATCH, 'Protocol version mismatch')
      return
    }

    try {
      const decoded = jwt.verify(msg.accessToken!, this.jwtSecret) as JwtPayload
      onSuccess(decoded)
    } catch {
      pinoLogger.warn('WS auth failed — invalid token')
      ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Invalid token')
    }
  }

  // ========== Control Message Dispatch ==========

  private handleControlMessage(
    ws: WebSocket,
    msg: ControlClientMessage,
    currentSessionId: string | null,
    currentUser: JwtPayload | null,  // [C1修复] 当前认证用户，用于会话权限校验
    setSessionId: (sid: string) => void,
  ): void {
    // [C1修复] 辅助方法：校验 sessionId 是否归属于 currentUser
    const checkSessionOwnership = (sessionId: string): boolean => {
      if (!currentUser) return false
      const owner = this.sessionManager.getOwner(sessionId)
      if (!owner) return false
      return owner === currentUser.userId
    }

    // [C3修复] 终端尺寸范围限制
    const COLS_MIN = 1
    const COLS_MAX = 500
    const ROWS_MIN = 1
    const ROWS_MAX = 200

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
        // [C3修复] 校验终端尺寸参数范围
        const safeCols = Math.max(COLS_MIN, Math.min(COLS_MAX, Math.floor(cols) || 80))
        const safeRows = Math.max(ROWS_MIN, Math.min(ROWS_MAX, Math.floor(rows) || 24))
        try {
          // [C1修复] 传入 ownerId (currentUser.userId)
          if (!currentUser) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }))
            break
          }
          this.sessionManager.createOrAttachSession(sessionId, safeCols, safeRows, adapter, currentUser.userId)
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
        if (!this.sessionManager.hasSession(sessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
          return
        }
        // [C1修复] 校验会话归属
        if (!checkSessionOwnership(sessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
          return
        }
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
        if (msg.cols && msg.rows) {
          // [C3修复] 校验终端尺寸参数范围
          const safeCols = Math.max(COLS_MIN, Math.min(COLS_MAX, Math.floor(msg.cols) || 80))
          const safeRows = Math.max(ROWS_MIN, Math.min(ROWS_MAX, Math.floor(msg.rows) || 24))
          try {
            this.sessionManager.resize(currentSessionId, safeCols, safeRows)
          } catch {
            // session may have been destroyed
          }
        }
        break
      }

      case 'QUICK_ACTION': {
        // [C1修复] 校验会话归属
        if (!currentSessionId || !checkSessionOwnership(currentSessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No session or permission denied' }))
          break
        }
        if (msg.payload) {
          this.sessionManager.sendQuickAction(currentSessionId, msg.payload)
        }
        break
      }

      case 'INJECT_CODE': {
        // [C1修复] 校验会话归属
        if (!currentSessionId || !checkSessionOwnership(currentSessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No session or permission denied' }))
          break
        }
        if (msg.code) {
          this.sessionManager.sendInput(currentSessionId, msg.code)
        }
        break
      }

      case 'OBSERVE_SESSION': {
        const { sessionId } = msg
        if (!this.sessionManager.hasSession(sessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
          return
        }
        // [C1修复] 校验会话归属
        if (!checkSessionOwnership(sessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
          return
        }
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
        // [C1修复] 校验会话归属
        if (!checkSessionOwnership(currentSessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
          break
        }
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
        // [C1修复] 校验会话归属
        if (!checkSessionOwnership(currentSessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
          break
        }
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
        // [C1修复] 校验会话归属
        if (!checkSessionOwnership(sessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
          break
        }
        try {
          const chunks = this.sessionManager.getRecording(sessionId, startTime, endTime)
          const data = chunks.map((c) => ({ data: Array.from(c.data), timestamp: c.timestamp }))
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
}
