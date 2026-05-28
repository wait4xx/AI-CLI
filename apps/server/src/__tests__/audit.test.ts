import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import fs from 'fs'
import path from 'path'

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'
process.env.PROJECT_ROOT = '/tmp/ai-cli-audit-test'

const TEST_DIR = '/tmp/ai-cli-audit-test'

// Must import after env is set
vi.mock('../lib/logger.js', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { auditLog, closeAuditLog } from '../core/audit.js'

describe('AuditLog', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(TEST_DIR, { recursive: true })
  })

  afterAll(() => {
    closeAuditLog()
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
  })

  it('should write an audit log entry', () => {
    auditLog('LOGIN', 'user-1', { ip: '127.0.0.1' })

    // Wait a bit for the stream to flush
    const filePath = path.join(TEST_DIR, '.audit.log')
    // Give the write stream time to flush
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(fs.existsSync(filePath)).toBe(true)
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.trim().split('\n')
        expect(lines.length).toBeGreaterThan(0)
        const entry = JSON.parse(lines[lines.length - 1])
        expect(entry.event).toBe('LOGIN')
        expect(entry.userId).toBe('user-1')
        expect(entry.details.ip).toBe('127.0.0.1')
        resolve()
      }, 200)
    })
  })

  it('should write multiple entries', () => {
    auditLog('SESSION_CREATE', 'user-1', { sessionId: 's1' })
    auditLog('SESSION_DESTROY', 'user-1', { sessionId: 's1' })

    const filePath = path.join(TEST_DIR, '.audit.log')
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.trim().split('\n')
        const createLine = lines.find((l: string) => {
          const e = JSON.parse(l)
          return e.event === 'SESSION_CREATE'
        })
        const destroyLine = lines.find((l: string) => {
          const e = JSON.parse(l)
          return e.event === 'SESSION_DESTROY'
        })
        expect(createLine).toBeDefined()
        expect(destroyLine).toBeDefined()
        resolve()
      }, 200)
    })
  })

  it('should handle null userId and details', () => {
    auditLog('WS_CONNECT')

    const filePath = path.join(TEST_DIR, '.audit.log')
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.trim().split('\n')
        const entry = JSON.parse(lines[lines.length - 1])
        expect(entry.event).toBe('WS_CONNECT')
        expect(entry.userId).toBeNull()
        expect(entry.details).toBeNull()
        resolve()
      }, 200)
    })
  })

  it('should include timestamp in ISO format', () => {
    const before = new Date().toISOString()
    auditLog('FILE_READ', 'user-1', { path: 'test.txt' })
    const after = new Date().toISOString()

    const filePath = path.join(TEST_DIR, '.audit.log')
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.trim().split('\n')
        const entry = JSON.parse(lines[lines.length - 1])
        expect(entry.timestamp).toBeDefined()
        expect(new Date(entry.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime())
        expect(new Date(entry.timestamp).getTime()).toBeLessThanOrEqual(new Date(after).getTime())
        resolve()
      }, 200)
    })
  })
})
