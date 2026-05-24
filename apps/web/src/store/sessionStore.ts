import { create } from 'zustand'
import { AgentStatus } from '@ai-cli/shared'

interface SessionState {
  // 连接状态
  isConnected: boolean
  connectionPhase: 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'

  // 会话
  sessionId: string | null
  agentStatus: AgentStatus

  // 认证
  accessToken: string | null
  refreshToken: string | null

  // 终端设置
  fontSize: number
  theme: 'dark' | 'light'

  // WS function refs (set by TerminalContainer)
  sendInjectCode: ((code: string) => void) | null

  // Actions
  setConnected: (phase: SessionState['connectionPhase']) => void
  setDisconnected: () => void
  setSession: (sessionId: string) => void
  setAgentStatus: (status: AgentStatus) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setFontSize: (size: number) => void
  setTheme: (theme: 'dark' | 'light') => void
  reset: () => void
}

const initialState = {
  isConnected: false,
  connectionPhase: 'DISCONNECTED' as const,
  sessionId: null as string | null,
  agentStatus: 'IDLE' as AgentStatus,
  accessToken: null as string | null,
  refreshToken: null as string | null,
  fontSize: 14,
  theme: 'dark' as const,
  sendInjectCode: null as ((code: string) => void) | null,
}

export const useSessionStore = create<SessionState>((set) => ({
  ...initialState,

  setConnected: (phase) =>
    set({
      isConnected: phase === 'CONNECTED',
      connectionPhase: phase,
    }),

  setDisconnected: () =>
    set({
      isConnected: false,
      connectionPhase: 'DISCONNECTED',
    }),

  setSession: (sessionId) => set({ sessionId }),

  setAgentStatus: (status) => set({ agentStatus: status }),

  setTokens: (accessToken, refreshToken) =>
    set({ accessToken, refreshToken }),

  setFontSize: (size) => set({ fontSize: size }),

  setTheme: (theme) => set({ theme }),

  reset: () => set(initialState),
}))
