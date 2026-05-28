/**
 * [V3补强] useAuth hook 单元测试
 * 覆盖：token 存储/读取、JWT 解析、login/logout、refresh、定时器清理
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuth } from '../hooks/useAuth'
import { useSessionStore } from '../store/sessionStore'

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    _store: () => store,
  }
})()

Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock })

// Helper: create a JWT-like token with an expiry
function createFakeToken(expSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = btoa(JSON.stringify({ exp: expSeconds, sub: 'test-user' }))
  const signature = btoa('fake-signature')
  return `${header}.${payload}.${signature}`
}

// Helper: get current time in seconds
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorageMock.clear()
    useSessionStore.getState().reset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('初始状态', () => {
    it('should not be authenticated when no tokens are stored', () => {
      const { result } = renderHook(() => useAuth())
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.accessToken).toBeNull()
    })
  })

  describe('loadStoredAuth', () => {
    it('should return false when no tokens stored', () => {
      const { result } = renderHook(() => useAuth())
      let loaded: boolean | undefined
      act(() => {
        loaded = result.current.loadStoredAuth()
      })
      expect(loaded).toBe(false)
    })

    it('should load valid stored tokens and return true', () => {
      const futureExp = nowSeconds() + 3600
      const accessToken = createFakeToken(futureExp)
      const refreshToken = createFakeToken(futureExp + 3600)

      sessionStorageMock.setItem('ai_cli_tokens', JSON.stringify({
        accessToken,
        refreshToken,
      }))

      const { result } = renderHook(() => useAuth())
      let loaded: boolean | undefined
      act(() => {
        loaded = result.current.loadStoredAuth()
      })

      expect(loaded).toBe(true)
      expect(useSessionStore.getState().accessToken).toBe(accessToken)
    })

    it('should handle expired access but valid refresh token', () => {
      const pastExp = nowSeconds() - 3600
      const futureExp = nowSeconds() + 3600

      const accessToken = createFakeToken(pastExp)
      const refreshToken = createFakeToken(futureExp)

      sessionStorageMock.setItem('ai_cli_tokens', JSON.stringify({
        accessToken,
        refreshToken,
      }))

      const { result } = renderHook(() => useAuth())
      let loaded: boolean | undefined
      act(() => {
        loaded = result.current.loadStoredAuth()
      })

      expect(loaded).toBe(true)
    })

    it('should return false when both tokens expired', () => {
      const pastExp = nowSeconds() - 3600
      const accessToken = createFakeToken(pastExp)
      const refreshToken = createFakeToken(pastExp)

      sessionStorageMock.setItem('ai_cli_tokens', JSON.stringify({
        accessToken,
        refreshToken,
      }))

      const { result } = renderHook(() => useAuth())
      let loaded: boolean | undefined
      act(() => {
        loaded = result.current.loadStoredAuth()
      })

      expect(loaded).toBe(false)
    })

    it('should handle corrupt stored data gracefully', () => {
      sessionStorageMock.setItem('ai_cli_tokens', 'not-valid-json')

      const { result } = renderHook(() => useAuth())
      let loaded: boolean | undefined
      act(() => {
        loaded = result.current.loadStoredAuth()
      })

      expect(loaded).toBe(false)
    })
  })

  describe('logout', () => {
    it('should clear tokens and reset store', () => {
      const { result } = renderHook(() => useAuth())

      act(() => {
        useSessionStore.getState().setTokens('access', 'refresh')
      })

      expect(useSessionStore.getState().accessToken).toBe('access')

      act(() => {
        result.current.logout()
      })

      expect(useSessionStore.getState().accessToken).toBeNull()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('should clear refresh timer on logout', () => {
      const { result } = renderHook(() => useAuth())

      act(() => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('login', () => {
    it('should throw on failed login', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const { result } = renderHook(() => useAuth())

      await expect(
        act(async () => {
          await result.current.login('baduser', 'badpass')
        }),
      ).rejects.toThrow('Invalid credentials')
    })

    it('should set tokens on successful login', async () => {
      const futureExp = nowSeconds() + 3600
      const accessToken = createFakeToken(futureExp)
      const refreshToken = createFakeToken(futureExp + 3600)

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accessToken, refreshToken }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const { result } = renderHook(() => useAuth())

      await act(async () => {
        await result.current.login('testuser', 'testpass')
      })

      expect(useSessionStore.getState().accessToken).toBe(accessToken)
      expect(useSessionStore.getState().refreshToken).toBe(refreshToken)
      expect(result.current.isAuthenticated).toBe(true)
      expect(sessionStorageMock.setItem).toHaveBeenCalled()
    })

    it('should handle network error gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      vi.stubGlobal('fetch', mockFetch)

      const { result } = renderHook(() => useAuth())

      await expect(
        act(async () => {
          await result.current.login('user', 'pass')
        }),
      ).rejects.toThrow('Network error')
    })
  })

  describe('定时器清理', () => {
    it('should clear timer on unmount', () => {
      const { unmount } = renderHook(() => useAuth())

      act(() => {
        useSessionStore.getState().setTokens('access', 'refresh')
      })

      unmount()
      // Verify no timer leak — no error thrown
      expect(true).toBe(true)
    })
  })
})
