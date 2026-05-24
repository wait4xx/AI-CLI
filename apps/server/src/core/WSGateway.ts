import { WebSocket } from 'ws'
import jwt from 'jsonwebtoken'
import { JwtPayload, PROTOCOL_VERSION, WS_CLOSE_CODE, TERM_PING, TERM_PONG } from '@ai-cli/shared'
import { SessionManager } from './SessionManager.js'

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

    const authTimeout = setTimeout(() => {
      if (state === WSState.UNAUTHENTICATED) {
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

    const authTimeout = setTimeout(() => {
      if (state === WSState.UNAUTHENTICATED) {
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
        this.handleControlMessage(ws, msg, currentSessionId, (sid) => { currentSessionId = sid })
      } catch {
        // invalid JSON
      }
    })

    ws.on('close', () => {
      clearTimeout(authTimeout)
      this.cleanupPing(ws)
      if (currentSessionId) {
        this.sessionManager.detachClient(currentSessionId, undefined, ws)
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
      ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Invalid token')
    }
  }

  // ========== Control Message Dispatch ==========

  private handleControlMessage(
    ws: WebSocket,
    msg: any,
    currentSessionId: string | null,
    setSessionId: (sid: string) => void,
  ): void {
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
        try {
          this.sessionManager.createOrAttachSession(sessionId, cols, rows, adapter)
          this.sessionManager.attachClient(sessionId, undefined, ws)
          setSessionId(sessionId)
          ws.send(JSON.stringify({ type: 'SESSION_READY', sessionId }))
        } catch (err: any) {
          ws.send(JSON.stringify({ type: 'ERROR', message: err.message }))
        }
        break
      }

      case 'ATTACH_SESSION': {
        const { sessionId } = msg
        if (!this.sessionManager.hasSession(sessionId)) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
          return
        }
        try {
          this.sessionManager.attachClient(sessionId, undefined, ws)
          setSessionId(sessionId)
        } catch (err: any) {
          ws.send(JSON.stringify({ type: 'ERROR', message: err.message }))
        }
        break
      }

      case 'RESIZE': {
        if (!currentSessionId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'No active session' }))
          break
        }
        if (msg.cols && msg.rows) {
          try {
            this.sessionManager.resize(currentSessionId, msg.cols, msg.rows)
          } catch {
            // session may have been destroyed
          }
        }
        break
      }

      case 'QUICK_ACTION': {
        if (currentSessionId && msg.payload) {
          this.sessionManager.sendQuickAction(currentSessionId, msg.payload)
        }
        break
      }

      case 'INJECT_CODE': {
        if (currentSessionId && msg.code) {
          this.sessionManager.sendInput(currentSessionId, msg.code)
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
