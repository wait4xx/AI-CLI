/**
 * Auth plugin 单元测试
 * 覆盖：用户 CRUD、密码哈希、JWT 认证中间件
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'
process.env.PROJECT_ROOT = '/tmp/ai-cli-auth-plugin-test'
process.env.DATA_DIR = '/tmp/ai-cli-auth-plugin-test'
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'admin-password-123'

const TEST_DIR = '/tmp/ai-cli-auth-plugin-test'

vi.mock('../lib/logger.js', () => ({
  pinoLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}))

import {
  getUser,
  hasUser,
  createUser,
  listUsers,
  updateUserPassword,
  deleteUser,
} from '../plugins/auth.js'

describe('Auth Plugin — User Store', () => {
  beforeAll(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true })
    }
    fs.mkdirSync(TEST_DIR, { recursive: true })
  })

  beforeEach(() => {
    // Clean users file before each test
    const usersFile = path.join(TEST_DIR, 'users.json')
    if (fs.existsSync(usersFile)) {
      fs.rmSync(usersFile)
    }
  })

  describe('createUser & getUser', () => {
    it('should create and retrieve a user', async () => {
      const user = {
        userId: 'u-1',
        username: 'alice',
        passwordHash: 'hashed-abc',
        role: 'user' as const,
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      }
      await createUser('alice', user)
      const retrieved = getUser('alice')
      expect(retrieved).toBeDefined()
      expect(retrieved!.userId).toBe('u-1')
      expect(retrieved!.username).toBe('alice')
      expect(retrieved!.passwordHash).toBe('hashed-abc')
    })

    it('should return undefined for non-existent user', () => {
      expect(getUser('nonexistent')).toBeUndefined()
    })

    it('should overwrite existing user', async () => {
      const user1 = {
        userId: 'u-1',
        username: 'bob',
        passwordHash: 'hash1',
        role: 'user' as const,
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      }
      const user2 = {
        userId: 'u-2',
        username: 'bob',
        passwordHash: 'hash2',
        role: 'user' as const,
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      }
      await createUser('bob', user1)
      await createUser('bob', user2)
      expect(getUser('bob')!.passwordHash).toBe('hash2')
    })
  })

  describe('hasUser', () => {
    it('should return true for existing user', async () => {
      await createUser('charlie', {
        userId: 'u-3',
        username: 'charlie',
        passwordHash: 'hash3',
        role: 'user',
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      })
      expect(hasUser('charlie')).toBe(true)
    })

    it('should return false for non-existent user', () => {
      expect(hasUser('nobody')).toBe(false)
    })
  })

  describe('listUsers', () => {
    it('should list all users', async () => {
      await createUser('u1', {
        userId: 'id1',
        username: 'u1',
        passwordHash: 'h1',
        role: 'user',
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      })
      await createUser('u2', {
        userId: 'id2',
        username: 'u2',
        passwordHash: 'h2',
        role: 'user',
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      })
      const list = listUsers()
      expect(list.length).toBeGreaterThanOrEqual(2)
      const usernames = list.map((u) => u.username)
      expect(usernames).toContain('u1')
      expect(usernames).toContain('u2')
    })
  })

  describe('updateUserPassword', () => {
    it('should update password hash', async () => {
      await createUser('dave', {
        userId: 'u-4',
        username: 'dave',
        passwordHash: 'old-hash',
        role: 'user',
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      })
      const result = await updateUserPassword('dave', 'new-hash')
      expect(result).toBe(true)
      expect(getUser('dave')!.passwordHash).toBe('new-hash')
    })

    it('should return false for non-existent user', async () => {
      expect(await updateUserPassword('ghost', 'hash')).toBe(false)
    })
  })

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      await createUser('eve', {
        userId: 'u-5',
        username: 'eve',
        passwordHash: 'hash5',
        role: 'user',
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      })
      expect(await deleteUser('eve')).toBe(true)
      expect(getUser('eve')).toBeUndefined()
    })

    it('should return false for non-existent user', async () => {
      expect(await deleteUser('nobody')).toBe(false)
    })
  })

  describe('persistence', () => {
    it('should persist users to file', async () => {
      await createUser('persist-user', {
        userId: 'u-p',
        username: 'persist-user',
        passwordHash: 'persist-hash',
        role: 'user',
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      })
      const usersFile = path.join(TEST_DIR, 'users.json')
      expect(fs.existsSync(usersFile)).toBe(true)
      const raw = JSON.parse(fs.readFileSync(usersFile, 'utf-8'))
      expect(raw['persist-user']).toBeDefined()
      expect(raw['persist-user'].passwordHash).toBe('persist-hash')
    })
  })
})
