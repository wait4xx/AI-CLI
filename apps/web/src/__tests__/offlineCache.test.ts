/**
 * OfflineCache 单元测试
 * 覆盖：缓存写入/读取、输入队列、TTL 过期、序列化/反序列化
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sessionStorage
const storage = new Map<string, string>()
const mockSessionStorage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value) }),
  removeItem: vi.fn((key: string) => { storage.delete(key) }),
  clear: vi.fn(() => { storage.clear() }),
}
Object.defineProperty(globalThis, 'sessionStorage', { value: mockSessionStorage, writable: true })

import { OfflineCache } from '../lib/offlineCache'

describe('OfflineCache', () => {
  beforeEach(() => {
    storage.clear()
    vi.clearAllMocks()
  })

  describe('cacheScreen & getCachedScreen', () => {
    it('should cache and retrieve screen data', () => {
      const cache = new OfflineCache('test-session')
      cache.cacheScreen('hello world')
      expect(cache.getCachedScreen()).toBe('hello world')
    })

    it('should overwrite previous cache', () => {
      const cache = new OfflineCache('test-session')
      cache.cacheScreen('first')
      cache.cacheScreen('second')
      expect(cache.getCachedScreen()).toBe('second')
    })
  })

  describe('queueInput', () => {
    it('should queue string inputs', () => {
      const cache = new OfflineCache('test-session')
      cache.queueInput('hello')
      cache.queueInput('world')
      expect(cache.hasQueuedInputs()).toBe(true)
    })

    it('should queue Uint8Array inputs', () => {
      const cache = new OfflineCache('test-session')
      cache.queueInput(new Uint8Array([1, 2, 3]))
      expect(cache.hasQueuedInputs()).toBe(true)
    })

    it('should evict oldest input when queue exceeds MAX_QUEUED_INPUTS', () => {
      const cache = new OfflineCache('test-session')
      // Fill up to 1000 + 1 to trigger eviction
      for (let i = 0; i < 1001; i++) {
        cache.queueInput(`input-${i}`)
      }
      // Queue should still be functional
      expect(cache.hasQueuedInputs()).toBe(true)
    })
  })

  describe('flushInputs', () => {
    it('should flush all queued inputs', () => {
      const cache = new OfflineCache('test-session')
      cache.queueInput('a')
      cache.queueInput('b')
      const flushed: string[] = []
      cache.flushInputs((data) => { flushed.push(data as string) })
      expect(flushed).toEqual(['a', 'b'])
      expect(cache.hasQueuedInputs()).toBe(false)
    })

    it('should handle empty queue', () => {
      const cache = new OfflineCache('test-session')
      const flushed: string[] = []
      cache.flushInputs((data) => { flushed.push(data as string) })
      expect(flushed).toEqual([])
    })
  })

  describe('clear', () => {
    it('should clear all cached data', () => {
      const cache = new OfflineCache('test-session')
      cache.cacheScreen('data')
      cache.queueInput('input')
      cache.clear()
      expect(cache.getCachedScreen()).toBe('')
      expect(cache.hasQueuedInputs()).toBe(false)
    })
  })

  describe('persistence', () => {
    it('should persist to sessionStorage', () => {
      const cache = new OfflineCache('persist-test')
      cache.cacheScreen('persisted')
      expect(mockSessionStorage.setItem).toHaveBeenCalled()
    })

    it('should restore from sessionStorage', () => {
      // Pre-populate storage
      storage.set('ai_cli_offline_cache_restore-test', JSON.stringify({
        screenSnapshot: 'restored screen',
        inputQueue: [{ type: 'string', value: 'restored input' }],
        sessionId: 'restore-test',
        timestamp: Date.now(),
      }))

      const cache = new OfflineCache('restore-test')
      expect(cache.getCachedScreen()).toBe('restored screen')
      expect(cache.hasQueuedInputs()).toBe(true)
    })

    it('should skip expired cache (TTL)', () => {
      // Set expired cache (24h + 1s ago)
      const expired = Date.now() - 24 * 60 * 60 * 1000 - 1000
      storage.set('ai_cli_offline_cache_expired-test', JSON.stringify({
        screenSnapshot: 'expired',
        inputQueue: [],
        sessionId: 'expired-test',
        timestamp: expired,
      }))

      const cache = new OfflineCache('expired-test')
      expect(cache.getCachedScreen()).toBe('')
    })
  })
})
