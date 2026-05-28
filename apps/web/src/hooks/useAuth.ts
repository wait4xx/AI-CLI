import { useCallback, useEffect, useRef } from 'react'
import { useSessionStore } from '../store/sessionStore'

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

const TOKEN_KEY = 'ai_cli_tokens'
// 安全修复[C4]: 使用 sessionStorage 替代 localStorage 存储 token，避免持久化
// NOTE: 未来可迁移到 httpOnly cookie + SameSite 策略，进一步提升 XSS 防护
const tokenStorage = {
  getItem(key: string) { return sessionStorage.getItem(key) },
  setItem(key: string, value: string) { sessionStorage.setItem(key, value) },
  removeItem(key: string) { sessionStorage.removeItem(key) },
}

interface StoredTokens {
  accessToken: string
  refreshToken: string
}

function getStoredTokens(): StoredTokens | null {
  try {
    const raw = tokenStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Ignore — corrupted storage data, treat as no stored tokens
    return null
  }
}

function storeTokens(access: string, refresh: string) {
  tokenStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken: access, refreshToken: refresh }))
}

function clearStoredTokens() {
  tokenStorage.removeItem(TOKEN_KEY)
}

function parseJwtExp(token: string): number {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    return decoded.exp * 1000
  } catch {
    // Ignore — malformed JWT, treat as already expired
    return 0
  }
}

export function useAuth() {
  const { accessToken, setTokens } = useSessionStore()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use ref for doRefreshToken to avoid stale closure in scheduleTokenRenewal
  const doRefreshTokenRef = useRef<() => Promise<string>>()
  doRefreshTokenRef.current = async () => {
    const currentRefresh = useSessionStore.getState().refreshToken
    if (!currentRefresh) throw new Error('No refresh token')

    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefresh }),
    })

    if (!res.ok) throw new Error('Refresh failed')

    const data = await res.json()
    setTokens(data.accessToken, currentRefresh)
    storeTokens(data.accessToken, currentRefresh)
    scheduleTokenRenewal(data.accessToken)
    return data.accessToken
  }

  const scheduleTokenRenewal = useCallback((token: string) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }

    const expiresAt = parseJwtExp(token)
    if (!expiresAt) return

    // Refresh 2 minutes before expiry
    const refreshIn = expiresAt - Date.now() - 2 * 60 * 1000
    if (refreshIn <= 0) return

    refreshTimerRef.current = setTimeout(async () => {
      try {
        await doRefreshTokenRef.current?.()
      } catch {
        // Silent — 4001 WS handler will pick up the failure
      }
    }, refreshIn)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }))
      throw new Error(err.message || 'Login failed')
    }

    const data = await res.json()
    setTokens(data.accessToken, data.refreshToken)
    storeTokens(data.accessToken, data.refreshToken)
    scheduleTokenRenewal(data.accessToken)
  }, [setTokens, scheduleTokenRenewal])

  const loadStoredAuth = useCallback(() => {
    const stored = getStoredTokens()
    if (!stored) return false

    const accessExp = parseJwtExp(stored.accessToken)
    const refreshExp = parseJwtExp(stored.refreshToken)
    const now = Date.now()

    // Access token still valid
    if (accessExp > now) {
      setTokens(stored.accessToken, stored.refreshToken)
      scheduleTokenRenewal(stored.accessToken)
      return true
    }

    // Access expired but refresh still valid — try refresh immediately
    if (refreshExp > now) {
      setTokens(stored.accessToken, stored.refreshToken)
      // Trigger refresh in background
      doRefreshTokenRef.current?.().catch(() => {
        clearStoredTokens()
        setTokens('', '')
      })
      return true
    }

    // Both expired — clear
    clearStoredTokens()
    return false
  }, [setTokens, scheduleTokenRenewal])

  const logout = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
    setTokens('', '')
    clearStoredTokens()
    useSessionStore.getState().reset()
  }, [setTokens])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
    }
  }, [])

  return {
    accessToken,
    isAuthenticated: !!accessToken,
    login,
    logout,
    loadStoredAuth,
    refreshToken: async () => {
      const fn = doRefreshTokenRef.current
      if (!fn) throw new Error('Not initialized')
      return fn()
    },
  }
}
