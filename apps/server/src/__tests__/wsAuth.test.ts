import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

vi.mock('../lib/logger.js', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { verifyWsUpgradeToken } from '../lib/wsAuth.js'

const JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
const JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'

function createMockRequest(query: Record<string, string | undefined> = {}) {
  return { query } as any
}

function createMockWs() {
  return {
    close: vi.fn(),
  } as any
}

describe('wsAuth', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET
    process.env.JWT_REFRESH_SECRET = JWT_REFRESH_SECRET
  })

  it('should return payload for valid token', () => {
    const token = jwt.sign({ userId: 'u1', username: 'test' }, JWT_SECRET, { expiresIn: '15m' })
    const req = createMockRequest({ token })
    const ws = createMockWs()

    const result = verifyWsUpgradeToken(req, ws, 'Terminal')
    expect(result).not.toBeNull()
    expect(result!.userId).toBe('u1')
    expect(ws.close).not.toHaveBeenCalled()
  })

  it('should close socket when token is missing', () => {
    const req = createMockRequest({})
    const ws = createMockWs()

    const result = verifyWsUpgradeToken(req, ws, 'Terminal')
    expect(result).toBeNull()
    expect(ws.close).toHaveBeenCalledWith(4001, 'Missing token')
  })

  // [R9] Missing JWT_SECRET is now handled by getConfig() at startup (fail-fast).
  // This is tested in config.test.ts — validateConfig rejects missing JWT_SECRET.
  // The wsAuth module assumes JWT_SECRET is always available after startup.

  it('should close socket for expired token', () => {
    const token = jwt.sign({ userId: 'u1', username: 'test' }, JWT_SECRET, { expiresIn: '-1s' })
    const req = createMockRequest({ token })
    const ws = createMockWs()

    const result = verifyWsUpgradeToken(req, ws, 'Control')
    expect(result).toBeNull()
    expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid token')
  })

  it('should close socket for invalid token', () => {
    const req = createMockRequest({ token: 'not.a.jwt' })
    const ws = createMockWs()

    const result = verifyWsUpgradeToken(req, ws, 'Terminal')
    expect(result).toBeNull()
    expect(ws.close).toHaveBeenCalledWith(4001, 'Invalid token')
  })
})
