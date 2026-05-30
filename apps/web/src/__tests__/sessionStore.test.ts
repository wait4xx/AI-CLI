/**
 * [第五轮] 前端 Zustand sessionStore 单元测试
 * 覆盖：连接状态、会话管理、adapter 验证、token 管理、会话切换
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../store/sessionStore'

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  describe('初始状态', () => {
    it('should have correct initial state', () => {
      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.connectionPhase).toBe('DISCONNECTED')
      expect(state.sessionId).toBeNull()
      expect(state.agentStatus).toBe('IDLE')
      expect(state.sessions).toEqual([])
      expect(state.activeSessionIndex).toBe(0)
      expect(state.accessToken).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.fontSize).toBe(14)
      expect(state.theme).toBe('dark')
      expect(state.activeAdapter).toBe('shell')
    })
  })

  describe('连接状态管理', () => {
    it('should set connected phase', () => {
      useSessionStore.getState().setConnected('CONNECTING_TERM')
      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.connectionPhase).toBe('CONNECTING_TERM')
    })

    it('should set CONNECTED state', () => {
      useSessionStore.getState().setConnected('CONNECTED')
      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(true)
      expect(state.connectionPhase).toBe('CONNECTED')
    })

    it('should set disconnected', () => {
      useSessionStore.getState().setConnected('CONNECTED')
      useSessionStore.getState().setDisconnected()
      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.connectionPhase).toBe('DISCONNECTED')
    })
  })

  describe('会话管理', () => {
    it('should set session and add to list if new', () => {
      useSessionStore.getState().setSession('test-session-id')
      const state = useSessionStore.getState()
      expect(state.sessionId).toBe('test-session-id')
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].id).toBe('test-session-id')
      expect(state.sessions[0].status).toBe('IDLE')
      expect(state.sessions[0].label).toBe('test-ses')
    })

    it('should not duplicate existing session', () => {
      useSessionStore.getState().setSession('test-session-id')
      useSessionStore.getState().setSession('test-session-id')
      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })

    it('should add new sessions', () => {
      useSessionStore.getState().addSession()
      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(1)
    })

    it('should limit max sessions to 10', () => {
      // Add 10 sessions (max)
      for (let i = 0; i < 10; i++) {
        useSessionStore.getState().addSession()
      }
      expect(useSessionStore.getState().sessions).toHaveLength(10)

      // 11th should be ignored
      useSessionStore.getState().addSession()
      expect(useSessionStore.getState().sessions).toHaveLength(10)
    })

    it('should remove session', () => {
      useSessionStore.getState().addSession()
      useSessionStore.getState().addSession()
      expect(useSessionStore.getState().sessions).toHaveLength(2)

      useSessionStore.getState().removeSession(0)
      const state = useSessionStore.getState()
      expect(state.sessions).toHaveLength(1)
    })

    it('should not remove last remaining session', () => {
      useSessionStore.getState().addSession()
      useSessionStore.getState().removeSession(0)
      // The initial add + 1 = 1 session, removing should leave 0
      // But the store prevents removing when sessions.length <= 1
      // Actually it does prevent: if sessions.length <= 1 return
      // So let's add 2 and verify we can remove 1 but not the last
      useSessionStore.getState().addSession()
      expect(useSessionStore.getState().sessions).toHaveLength(2)
      useSessionStore.getState().removeSession(0)
      expect(useSessionStore.getState().sessions).toHaveLength(1)
      useSessionStore.getState().removeSession(0)
      // Should still have 1
      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })

    it('should switch session by index', () => {
      useSessionStore.getState().addSession()
      useSessionStore.getState().addSession()
      useSessionStore.getState().setSession(useSessionStore.getState().sessions[0].id)

      useSessionStore.getState().switchSession(1)
      const state = useSessionStore.getState()
      expect(state.activeSessionIndex).toBe(1)
      expect(state.sessionId).toBe(state.sessions[1].id)
    })

    it('should ignore invalid session index', () => {
      useSessionStore.getState().addSession()
      const origIndex = useSessionStore.getState().activeSessionIndex
      useSessionStore.getState().switchSession(99)
      expect(useSessionStore.getState().activeSessionIndex).toBe(origIndex)
    })
  })

  describe('agent 状态', () => {
    it('should set agent status', () => {
      useSessionStore.getState().setSession('test-session')
      useSessionStore.getState().setAgentStatus('RUNNING')
      expect(useSessionStore.getState().agentStatus).toBe('RUNNING')
    })

    it('should update session status', () => {
      useSessionStore.getState().setSession('test-session')
      useSessionStore.getState().updateSessionStatus('test-session', 'WAITING_APPROVAL')
      const session = useSessionStore.getState().sessions.find((s) => s.id === 'test-session')
      expect(session?.status).toBe('WAITING_APPROVAL')
    })
  })

  describe('token 管理', () => {
    it('should set tokens', () => {
      useSessionStore.getState().setTokens('access-token', 'refresh-token')
      const state = useSessionStore.getState()
      expect(state.accessToken).toBe('access-token')
      expect(state.refreshToken).toBe('refresh-token')
    })
  })

  describe('设置管理', () => {
    it('should set font size', () => {
      useSessionStore.getState().setFontSize(18)
      expect(useSessionStore.getState().fontSize).toBe(18)
    })

    it('should set theme', () => {
      useSessionStore.getState().setTheme('light')
      expect(useSessionStore.getState().theme).toBe('light')
    })

    it('should validate adapter against whitelist', () => {
      useSessionStore.getState().setActiveAdapter('aider')
      expect(useSessionStore.getState().activeAdapter).toBe('aider')

      useSessionStore.getState().setActiveAdapter('shell')
      expect(useSessionStore.getState().activeAdapter).toBe('shell')
    })

    it('should reject invalid adapter and default to claude', () => {
      useSessionStore.getState().setActiveAdapter('malicious')
      expect(useSessionStore.getState().activeAdapter).toBe('claude')
    })
  })

  describe('reset', () => {
    it('should reset all state to initial', () => {
      useSessionStore.getState().setTokens('a', 'b')
      useSessionStore.getState().setConnected('CONNECTED')
      useSessionStore.getState().setAgentStatus('RUNNING')
      useSessionStore.getState().setFontSize(20)
      useSessionStore.getState().setTheme('light')
      useSessionStore.getState().setActiveAdapter('shell')

      useSessionStore.getState().reset()

      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.connectionPhase).toBe('DISCONNECTED')
      expect(state.accessToken).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.agentStatus).toBe('IDLE')
      expect(state.fontSize).toBe(14)
      expect(state.theme).toBe('dark')
      expect(state.activeAdapter).toBe('shell')
    })
  })
})
