/**
 * WSGateway unit tests
 * Coverage: session ownership checks, ping/pong, message dispatch, recording, token refresh
 * Auth is now verified at the HTTP upgrade level — tests pass JwtPayload directly.
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
import type { JwtPayload } from '@ai-cli/shared'

const JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
const JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'

const defaultUser: JwtPayload = {
  userId: 'user-1',
  username: 'test',
  role: 'admin',
  tokenVersion: 0,
  iat: 1234567890,
  exp: 1234571490,
}

function otherUser(): JwtPayload {
  return {
    userId: 'user-2',
    username: 'other',
    role: 'user',
    tokenVersion: 0,
    iat: 1234567890,
    exp: 1234571490,
  }
}

/** Create a mock WebSocket that records sent data */
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
  const handlers = new Map<string, ((...a: unknown[]) => void)[]>()
  ws.on = vi.fn((event: string, handler: (...a: unknown[]) => void) => {
    if (!handlers.has(event)) handlers.set(event, [])
    handlers.get(event)!.push(handler)
  })
  ;(ws as any).emit = (event: string, ...args: any[]) => {
    for (const h of handlers.get(event) || []) h(...args)
  }
  return ws as any
}

describe('WSGateway', () => {
  let gateway: WSGateway

  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionManager.hasSession.mockImplementation((id: string) => id === 'valid-session')
    mockSessionManager.getOwner.mockImplementation((id: string) =>
      id === 'valid-session' ? 'user-1' : null,
    )
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
    mockSessionManager.getRecordingStatus.mockImplementation(() => ({
      recording: false,
      duration: 0,
    }))
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
    it('should attach session immediately when ATTACH_SESSION is sent', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )

      expect(mockSessionManager.attachClient).toHaveBeenCalledWith('valid-session', ws, undefined)
    })

    it('should reject ATTACH to non-existent session', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'ghost-session',
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'ERROR' && parsed?.message === 'Session not found'
        }),
      ).toBe(true)
    })

    it('should reject ATTACH when user is not the owner', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws, otherUser())

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'ERROR' && parsed?.message === 'Permission denied'
        }),
      ).toBe(true)
    })

    it('should respond to PING with PONG in binary mode', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws, defaultUser)

      // Attach session first
      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )

      // Send PING (0x00)
      ws.emit('message', Buffer.from([0x00]))

      expect(ws.sent.some((s: any) => Buffer.isBuffer(s) && s.length === 1 && s[0] === 0x01)).toBe(
        true,
      )
    })

    it('should forward keyboard input to pty after ATTACH', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )

      const input = Buffer.from('ls -la\n')
      ws.emit('message', input)

      expect(mockSessionManager.sendInput).toHaveBeenCalledWith('valid-session', input)
    })

    it('should detach client on close', () => {
      const ws = createMockWs()
      gateway.handleTerminalConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )

      ws.emit('close')

      expect(mockSessionManager.detachClient).toHaveBeenCalledWith('valid-session', ws, undefined)
    })
  })

  describe('Control Channel', () => {
    it('should handle PING/PONG', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit('message', Buffer.from(JSON.stringify({ type: 'PING' })))

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'PONG'
        }),
      ).toBe(true)
    })

    it('should handle INIT_SESSION', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'INIT_SESSION',
            sessionId: 'new-session',
            cols: 80,
            rows: 24,
            adapter: 'shell',
          }),
        ),
      )

      expect(mockSessionManager.createOrAttachSession).toHaveBeenCalledWith(
        'new-session',
        80,
        24,
        'shell',
        'user-1',
        undefined,
        undefined,
      )
    })

    it('should reject INJECT_CODE exceeding 1MB', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      mockSessionManager.hasSession.mockReturnValue(true)
      mockSessionManager.getOwner.mockReturnValue('user-1')

      // Attach session first
      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )
      ws.sent.length = 0

      // Send oversized INJECT_CODE (1MB + 1 byte)
      const hugeCode = 'x'.repeat(1048577)
      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'INJECT_CODE',
            code: hugeCode,
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'ERROR' && parsed?.message?.includes('exceeds maximum size')
        }),
      ).toBe(true)
    })

    it('should reject RESIZE without active session', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'RESIZE',
            cols: 120,
            rows: 40,
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'ERROR' && parsed?.message === 'No active session'
        }),
      ).toBe(true)
    })

    it('should handle REFRESH token renewal', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      const refreshToken = jwt.sign({ userId: 'user-1', username: 'test' }, JWT_REFRESH_SECRET, {
        expiresIn: '7d',
      })
      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'REFRESH',
            refreshToken,
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'TOKEN_RENEWED' && parsed?.accessToken
        }),
      ).toBe(true)
    })

    it('should reject invalid refresh token', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'REFRESH',
            refreshToken: 'invalid',
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'ERROR' && parsed?.message === 'Invalid refresh token'
        }),
      ).toBe(true)
    })

    it('should clean up ping timers on destroy', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      expect(() => gateway.destroy()).not.toThrow()
    })

    it('should clamp terminal size on INIT_SESSION', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'INIT_SESSION',
            sessionId: 'clamp-test',
            cols: 9999,
            rows: -5,
            adapter: 'shell',
          }),
        ),
      )

      expect(mockSessionManager.createOrAttachSession).toHaveBeenCalledWith(
        'clamp-test',
        500,
        1,
        'shell',
        'user-1',
        undefined,
        undefined,
      )
    })

    it('should handle OBSERVE_SESSION', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'OBSERVE_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )

      expect(mockSessionManager.attachObserver).toHaveBeenCalledWith('valid-session', ws)
    })

    it('should reject OBSERVE_SESSION for non-existent session', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      mockSessionManager.hasSession.mockReturnValue(false)
      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'OBSERVE_SESSION',
            sessionId: 'ghost-session',
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'ERROR'
        }),
      ).toBe(true)
    })

    it('should reject OBSERVE_SESSION when not owner', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, otherUser())

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'OBSERVE_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'ERROR' && parsed?.message === 'Permission denied'
        }),
      ).toBe(true)
    })

    it('should handle START_RECORDING', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      mockSessionManager.hasSession.mockReturnValue(true)
      mockSessionManager.getOwner.mockReturnValue('user-1')

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )
      ws.sent.length = 0

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'START_RECORDING',
          }),
        ),
      )

      expect(mockSessionManager.startRecording).toHaveBeenCalledWith('valid-session')
    })

    it('should reject START_RECORDING without active session', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'START_RECORDING',
          }),
        ),
      )

      expect(
        ws.sent.some((s: any) => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : null
          return parsed?.type === 'ERROR' && parsed?.message === 'No active session'
        }),
      ).toBe(true)
    })

    it('should handle STOP_RECORDING', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      mockSessionManager.hasSession.mockReturnValue(true)
      mockSessionManager.getOwner.mockReturnValue('user-1')

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )
      ws.sent.length = 0

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'STOP_RECORDING',
          }),
        ),
      )

      expect(mockSessionManager.stopRecording).toHaveBeenCalledWith('valid-session')
    })

    it('should handle GET_RECORDING', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'GET_RECORDING',
            sessionId: 'valid-session',
          }),
        ),
      )

      expect(mockSessionManager.getRecording).toHaveBeenCalledWith(
        'valid-session',
        undefined,
        undefined,
      )
    })

    it('should pass startTime and endTime to GET_RECORDING', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'GET_RECORDING',
            sessionId: 'valid-session',
            startTime: 1000,
            endTime: 2000,
          }),
        ),
      )

      expect(mockSessionManager.getRecording).toHaveBeenCalledWith('valid-session', 1000, 2000)
    })

    it('should handle QUICK_ACTION with payload', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      mockSessionManager.hasSession.mockReturnValue(true)
      mockSessionManager.getOwner.mockReturnValue('user-1')

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: 'valid-session',
          }),
        ),
      )
      ws.sent.length = 0

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'QUICK_ACTION',
            payload: '\r',
          }),
        ),
      )

      expect(mockSessionManager.sendQuickAction).toHaveBeenCalledWith('valid-session', '\r')
    })

    it('should reject QUICK_ACTION without active session', () => {
      const ws = createMockWs()
      gateway.handleControlConnection(ws, defaultUser)

      ws.emit(
        'message',
        Buffer.from(
          JSON.stringify({
            type: 'QUICK_ACTION',
            payload: '\r',
          }),
        ),
      )

      expect(mockSessionManager.sendQuickAction).not.toHaveBeenCalled()
    })
  })
})
