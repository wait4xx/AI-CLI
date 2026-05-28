/**
 * [M9修复] WSGateway 单元测试
 * 覆盖：JWT 鉴权、协议版本校验、会话权限校验、ping/pong、消息分发
 * 通过 mock WebSocket 和 SessionManager 避免真实网络依赖
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import jwt from 'jsonwebtoken'

// ─── Mock SessionManager ───
const mockSessionManager = {
  hasSession: vi.fn((id: string) => id === 'valid-session'),
  getOwner: vi.fn((id: string) => (id === 'valid-session' ? 'user-1' : null)),
  attachClient: vi.fn(),
  detachClient: vi.fn(),
  attachObserver: vi.fn(),
  detachObserver: vi.fn(),
  createOrAttachSession: vi.fn(),
  sendInput: vi.fn(),
  sendQuickAction: vi.fn(),
  resize: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  getRecordingStatus: vi.fn(() => ({ recording: false, duration: 0 })),
  getRecording: vi.fn(() => []),
  getSessionIds: vi.fn(() => []),
  destroy: vi.fn(),
}

vi.mock('../core/SessionManager.js', () => ({
  SessionManager: vi.fn(() => mockSessionManager),
}))

vi.mock('../lib/logger.js', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { WSGateway } from '../core/WSGateway.js'

const JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
const JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'

function createToken(payload: object = { userId: 'user-1', username: 'test' }, secret = JWT_SECRET) {
  return jwt.sign(payload, secret, { expiresIn: '15m' })
}

function createExpiredToken() {
  return jwt.sign({ userId: 'user-1', username: 'test' }, JWT_SECRET, { expiresIn: '-1s' })
}

/** 创建一个 mock WebSocket，记录所有 sent 数据和 close 调用 */
function createMockWs() {
  const ws = {
    readyState: 1, // OPEN
    sent: [] as any[],
    closed: false,
    closeCode: 0 as number,
    closeReason: '' as string,
    send(data: any) {
      this.sent.push(data)
    },
    close(code?: number, reason?: string) {
      this.closed = true
      this.closeCode = code || 0
      this.closeReason = reason || ''
      this.readyState = 3 // CLOSED
    },
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  }
  // 模拟 EventEmitter 的 on('message', ...) 和 on('close', ...)
  const handlers = new Map<string, Function[]>()
  ws.on = vi.fn((event: string, handler: Function) => {
    if (!handlers.has(event)) handlers.set(event, [])
    handlers.get(event)!.push(handler)
  })
  // 暴露 emit 供测试使用
  ;(ws as any).emit = (event: string, ...args: any[]) => {
    for (const h of handlers.get(event) || []) h(...args)
  }
  return ws as any
}

describe('WSGateway', () => {
  let gateway: WSGateway

  beforeEach(() => {
    vi.clearAllMocks()
    // Restore mock implementations after clearAllMocks
    mockSessionManager.hasSession.mockImplementation((id: string) => id === 'valid-session')
    mockSessionManager.getOwner.mockImplementation((id: string) => (id === 'valid-session' ? 'user-1' : null))
    mockSessionManager.attachClient.mockImplementation(() => {})
    mockSessionManager.detachClient.mockImplementation(() => {})
    mockSessionManager.attachObserver.mockImplementation(() => {})
    mockSessionManager.detachObserver.mockImplementation(() => {})
    mockSessionManager.createOrAttachSession.mockImplementation(() => ({}))
    mockSessionManager.sendInput.mockImplementation(() => {})
    mockSessionManager.sendQuickAction.mockImplementation(() => {})
    mockSessionManager.resize.mockImplementation(() => {})
    mockSessionManager.startRecording.mockImplementation(() => {})
    mockSessionManager.stopRecording.mockImplementation(() => {})
    mockSessionManager.getRecordingStatus.mockImplementation(() => ({ recording: false, duration: 0 }))
    mockSessionManager.getRecording.mockImplementation(() => [])
    mockSessionManager.getSessionIds.mockImplementation(() => [])
    mockSessionManager.destroy.mockImplementation(() => {})
    vi.useFakeTimers()
    gateway = new WSGateway(mockSessionManager as any, JWT_SECRET, JWT_REFRESH_SECRET)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Terminal Channel', () => {
    it('should close unauthenticated connection after timeout', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      // 快进到 auth 超时
      vi.advanceTimersByTime(16000)

      expect(ws.closed).toBe(true)
      expect(ws.closeCode).toBe(4001) // AUTH_FAILED
    })

    it('should authenticate with valid token', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      // 模拟 AUTH 消息
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'AUTH_OK'
      })).toBe(true)
    })

    it('should reject invalid token', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: 'invalid-token',
      })))

      expect(ws.closed).toBe(true)
      expect(ws.closeCode).toBe(4001) // AUTH_FAILED
    })

    it('should reject expired token', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createExpiredToken(),
      })))

      expect(ws.closed).toBe(true)
      expect(ws.closeCode).toBe(4001)
    })

    it('should reject protocol version mismatch', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
        protocolVersion: '999.0',
      })))

      expect(ws.closed).toBe(true)
      expect(ws.closeCode).toBe(4002) // PROTOCOL_MISMATCH
    })

    // [R9] Test missing accessToken in AUTH message
    it('should reject AUTH message without accessToken', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
      })))

      expect(ws.closed).toBe(true)
      expect(ws.closeCode).toBe(4001) // AUTH_FAILED
    })

    it('should attach session after auth', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      // Auth first
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))

      // Attach session
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'ATTACH_SESSION',
        sessionId: 'valid-session',
      })))

      expect(mockSessionManager.attachClient).toHaveBeenCalledWith('valid-session', ws, undefined)
    })

    it('should reject ATTACH to non-existent session', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))

      // Attach to non-existent session
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'ATTACH_SESSION',
        sessionId: 'ghost-session',
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'ERROR' && parsed?.message === 'Session not found'
      })).toBe(true)
    })

    it('should reject ATTACH when user is not the owner', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws)

      // Auth as user-2
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken({ userId: 'user-2', username: 'other' }),
      })))

      // valid-session is owned by user-1
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'ATTACH_SESSION',
        sessionId: 'valid-session',
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'ERROR' && parsed?.message === 'Permission denied'
      })).toBe(true)
    })
  })

  describe('Control Channel', () => {
    it('should authenticate and send AUTH_OK', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'AUTH_OK'
      })).toBe(true)
    })

    it('should handle PING/PONG', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth first
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))

      // Clear auth responses
      ws.sent.length = 0

      // PING
      ws.emit('message', Buffer.from(JSON.stringify({ type: 'PING' })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'PONG'
      })).toBe(true)
    })

    it('should handle INIT_SESSION', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Init session
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'INIT_SESSION',
        sessionId: 'new-session',
        cols: 80,
        rows: 24,
        adapter: 'shell',
      })))

      expect(mockSessionManager.createOrAttachSession).toHaveBeenCalledWith(
        'new-session', 80, 24, 'shell', 'user-1',
      )
    })

    it('should reject INJECT_CODE exceeding 1MB', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Mock current session
      mockSessionManager.hasSession.mockReturnValue(true)
      mockSessionManager.getOwner.mockReturnValue('user-1')

      // Attach session first
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'ATTACH_SESSION',
        sessionId: 'valid-session',
      })))
      ws.sent.length = 0

      // Send oversized INJECT_CODE (1MB + 1 byte)
      const hugeCode = 'x'.repeat(1048577)
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'INJECT_CODE',
        code: hugeCode,
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'ERROR' && parsed?.message?.includes('exceeds maximum size')
      })).toBe(true)
    })

    it('should reject RESIZE without active session', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Resize without session
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'RESIZE',
        cols: 120,
        rows: 40,
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'ERROR' && parsed?.message === 'No active session'
      })).toBe(true)
    })

    it('should handle REFRESH token renewal', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Refresh
      const refreshToken = jwt.sign(
        { userId: 'user-1', username: 'test' },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' },
      )
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'REFRESH',
        refreshToken,
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'TOKEN_RENEWED' && parsed?.accessToken
      })).toBe(true)
    })

    it('should reject invalid refresh token', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Invalid refresh
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'REFRESH',
        refreshToken: 'invalid',
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'ERROR' && parsed?.message === 'Invalid refresh token'
      })).toBe(true)
    })

    // [R9] Test WSGateway destroy()
    it('should clean up ping timers on destroy', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))

      // Destroy should not throw
      expect(() => gateway.destroy()).not.toThrow()
    })

    it('should clamp terminal size on INIT_SESSION', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Oversized cols
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'INIT_SESSION',
        sessionId: 'clamp-test',
        cols: 9999,
        rows: -5,
        adapter: 'shell',
      })))

      // Should clamp to MAX 500 and MIN 1
      expect(mockSessionManager.createOrAttachSession).toHaveBeenCalledWith(
        'clamp-test', 500, 1, 'shell', 'user-1',
      )
    })

    // [第五轮] OBSERVE_SESSION 测试
    it('should handle OBSERVE_SESSION', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Observe session
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'OBSERVE_SESSION',
        sessionId: 'valid-session',
      })))

      expect(mockSessionManager.attachObserver).toHaveBeenCalledWith('valid-session', ws)
    })

    it('should reject OBSERVE_SESSION for non-existent session', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Observe non-existent session
      mockSessionManager.hasSession.mockReturnValue(false)
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'OBSERVE_SESSION',
        sessionId: 'ghost-session',
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'ERROR'
      })).toBe(true)
    })

    it('should reject OBSERVE_SESSION when not owner', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth as user-2 (not owner of valid-session)
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken({ userId: 'user-2', username: 'other' }),
      })))
      ws.sent.length = 0

      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'OBSERVE_SESSION',
        sessionId: 'valid-session',
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'ERROR' && parsed?.message === 'Permission denied'
      })).toBe(true)
    })

    // [第五轮] START_RECORDING 测试
    it('should handle START_RECORDING', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Set up session
      mockSessionManager.hasSession.mockReturnValue(true)
      mockSessionManager.getOwner.mockReturnValue('user-1')

      // Attach session first
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'ATTACH_SESSION',
        sessionId: 'valid-session',
      })))
      ws.sent.length = 0

      // Start recording
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'START_RECORDING',
      })))

      expect(mockSessionManager.startRecording).toHaveBeenCalledWith('valid-session')
    })

    it('should reject START_RECORDING without active session', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Start recording without session
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'START_RECORDING',
      })))

      expect(ws.sent.some((s: any) => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : null
        return parsed?.type === 'ERROR' && parsed?.message === 'No active session'
      })).toBe(true)
    })

    // [第五轮] STOP_RECORDING 测试
    it('should handle STOP_RECORDING', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Set up session
      mockSessionManager.hasSession.mockReturnValue(true)
      mockSessionManager.getOwner.mockReturnValue('user-1')

      // Attach session first
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'ATTACH_SESSION',
        sessionId: 'valid-session',
      })))
      ws.sent.length = 0

      // Stop recording
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'STOP_RECORDING',
      })))

      expect(mockSessionManager.stopRecording).toHaveBeenCalledWith('valid-session')
    })

    // [第五轮] GET_RECORDING 测试
    it('should handle GET_RECORDING', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Get recording for valid session
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'GET_RECORDING',
        sessionId: 'valid-session',
      })))

      expect(mockSessionManager.getRecording).toHaveBeenCalledWith('valid-session', undefined, undefined)
    })

    it('should pass startTime and endTime to GET_RECORDING', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'GET_RECORDING',
        sessionId: 'valid-session',
        startTime: 1000,
        endTime: 2000,
      })))

      expect(mockSessionManager.getRecording).toHaveBeenCalledWith('valid-session', 1000, 2000)
    })

    // [第五轮] QUICK_ACTION 测试
    it('should handle QUICK_ACTION with payload', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Set up session
      mockSessionManager.hasSession.mockReturnValue(true)
      mockSessionManager.getOwner.mockReturnValue('user-1')

      // Attach session
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'ATTACH_SESSION',
        sessionId: 'valid-session',
      })))
      ws.sent.length = 0

      // Quick action
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'QUICK_ACTION',
        payload: '\r',
      })))

      expect(mockSessionManager.sendQuickAction).toHaveBeenCalledWith('valid-session', '\r')
    })

    it('should reject QUICK_ACTION without active session', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws)

      // Auth
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'AUTH',
        accessToken: createToken(),
      })))
      ws.sent.length = 0

      // Quick action without session — should be silently ignored (no currentSessionId)
      ws.emit('message', Buffer.from(JSON.stringify({
        type: 'QUICK_ACTION',
        payload: '\r',
      })))

      expect(mockSessionManager.sendQuickAction).not.toHaveBeenCalled()
    })
  })
})
