import { useCallback, useEffect, useRef } from 'react'
import { useSessionStore } from '../store/sessionStore'

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

const TOKEN_KEY = 'ai_cli_tokens'

interface StoredTokens {
  accessToken: string
  refreshToken: string
}

function getStoredTokens(): StoredTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function storeTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ accessToken: access, refreshToken: refresh }))
}

function clearStoredTokens() {
  localStorage.removeItem(TOKEN_KEY)
}

function parseJwtExp(token: string): number {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(atob(payload))
    return decoded.exp * 1000
  } catch {
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
    if (stored) {
      setTokens(stored.accessToken, stored.refreshToken)
      scheduleTokenRenewal(stored.accessToken)
      return true
    }
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
