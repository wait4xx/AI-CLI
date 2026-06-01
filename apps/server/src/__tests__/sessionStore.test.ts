import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'
process.env.PROJECT_ROOT = '/tmp/ai-cli-sessionstore-test'
process.env.DATA_DIR = '/tmp/ai-cli-sessionstore-test'

import { SessionStore } from '../core/sessionStore.js'

describe('SessionStore', () => {
  let store: SessionStore
  const testDir = '/tmp/ai-cli-sessionstore-test'

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testDir, { recursive: true })
    store = new SessionStore()
  })

  afterEach(async () => {
    await store.flush()
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  describe('set & get', () => {
    it('should store and retrieve a session', () => {
      const data = {
        sessionId: 'test-1',
        adapterName: 'shell',
        tmuxSessionName: 'aicli-test-1',
        status: 'IDLE',
        ownerId: 'user-1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      }
      store.set('test-1', data)
      expect(store.get('test-1')).toEqual(data)
    })

    it('should return undefined for non-existent session', () => {
      expect(store.get('nonexistent')).toBeUndefined()
    })

    it('should overwrite existing session', () => {
      const data1 = {
        sessionId: 'test-1',
        adapterName: 'shell',
        tmuxSessionName: 'aicli-test-1',
        status: 'IDLE',
        ownerId: 'user-1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      }
      const data2 = { ...data1, status: 'RUNNING' }
      store.set('test-1', data1)
      store.set('test-1', data2)
      expect(store.get('test-1')?.status).toBe('RUNNING')
    })
  })

  describe('delete', () => {
    it('should delete a session', () => {
      const data = {
        sessionId: 'test-del',
        adapterName: 'shell',
        tmuxSessionName: 'aicli-test-del',
        status: 'IDLE',
        ownerId: 'user-1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      }
      store.set('test-del', data)
      expect(store.delete('test-del')).toBe(true)
      expect(store.get('test-del')).toBeUndefined()
    })

    it('should return false for non-existent session', () => {
      expect(store.delete('nonexistent')).toBe(false)
    })
  })

  describe('has', () => {
    it('should return true for existing session', () => {
      const data = {
        sessionId: 'test-has',
        adapterName: 'shell',
        tmuxSessionName: 'aicli-test-has',
        status: 'IDLE',
        ownerId: 'user-1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      }
      store.set('test-has', data)
      expect(store.has('test-has')).toBe(true)
    })

    it('should return false for non-existent session', () => {
      expect(store.has('nonexistent')).toBe(false)
    })
  })

  describe('entries', () => {
    it('should iterate over all entries', () => {
      const data1 = {
        sessionId: 'e1',
        adapterName: 'shell',
        tmuxSessionName: 'aicli-e1',
        status: 'IDLE',
        ownerId: 'user-1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      }
      const data2 = { ...data1, sessionId: 'e2', tmuxSessionName: 'aicli-e2' }
      store.set('e1', data1)
      store.set('e2', data2)
      const entries = [...store.entries()]
      expect(entries).toHaveLength(2)
      expect(entries.map((e) => e[0])).toContain('e1')
      expect(entries.map((e) => e[0])).toContain('e2')
    })
  })

  describe('persistence', () => {
    it('should persist data to file', async () => {
      const data = {
        sessionId: 'persist-1',
        adapterName: 'claude',
        tmuxSessionName: 'aicli-persist-1',
        status: 'RUNNING',
        ownerId: 'user-2',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      }
      store.set('persist-1', data)
      await store.flush()

      // Verify file was created
      const filePath = path.join(testDir, 'sessions.json')
      expect(fs.existsSync(filePath)).toBe(true)

      // Verify content
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      expect(raw['persist-1']).toBeDefined()
      expect(raw['persist-1'].adapterName).toBe('claude')
    })

    it('should load persisted data', async () => {
      const data = {
        sessionId: 'load-1',
        adapterName: 'shell',
        tmuxSessionName: 'aicli-load-1',
        status: 'IDLE',
        ownerId: 'user-1',
        createdAt: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      }
      store.set('load-1', data)
      await store.flush()

      // Create a new store and load
      const store2 = new SessionStore()
      await store2.load()
      expect(store2.get('load-1')).toBeDefined()
      expect(store2.get('load-1')?.adapterName).toBe('shell')
    })

    it('should handle corrupted file gracefully', async () => {
      const filePath = path.join(testDir, 'sessions.json')
      fs.writeFileSync(filePath, '{ invalid json', 'utf-8')

      // Should not throw
      const store2 = new SessionStore()
      await store2.load()
      expect(store2.get('anything')).toBeUndefined()
    })
  })
})
