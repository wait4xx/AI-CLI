import { create } from 'zustand'
import { AgentStatus } from '@ai-cli/shared'

interface SessionEntry {
  id: string
  status: AgentStatus
  label: string
}

interface SessionState {
  // Connection state
  isConnected: boolean
  connectionPhase: 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'

  // Current session
  sessionId: string | null
  agentStatus: AgentStatus

  // Multi-session
  sessions: SessionEntry[]
  activeSessionIndex: number

  // Auth
  accessToken: string | null
  refreshToken: string | null

  // Terminal settings
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
  addSession: () => void
  removeSession: (index: number) => void
  updateSessionStatus: (sessionId: string, status: AgentStatus) => void
  switchSession: (index: number) => void
  reset: () => void
}

const initialState = {
  isConnected: false,
  connectionPhase: 'DISCONNECTED' as const,
  sessionId: null as string | null,
  agentStatus: 'IDLE' as AgentStatus,
  sessions: [] as SessionEntry[],
  activeSessionIndex: 0,
  accessToken: null as string | null,
  refreshToken: null as string | null,
  fontSize: 14,
  theme: 'dark' as const,
  sendInjectCode: null as ((code: string) => void) | null,
}

export const useSessionStore = create<SessionState>((set, get) => ({
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

  setSession: (sessionId) => {
    const { sessions } = get()
    const existing = sessions.find((s) => s.id === sessionId)
    if (!existing) {
      set({
        sessionId,
        sessions: [...sessions, { id: sessionId, status: 'IDLE', label: sessionId.slice(0, 8) }],
        activeSessionIndex: sessions.length,
      })
    } else {
      set({ sessionId })
    }
  },

  setAgentStatus: (status) => {
    const { sessionId, sessions } = get()
    set({
      agentStatus: status,
      sessions: sessions.map((s) =>
        s.id === sessionId ? { ...s, status } : s
      ),
    })
  },

  setTokens: (accessToken, refreshToken) =>
    set({ accessToken, refreshToken }),

  setFontSize: (size) => set({ fontSize: size }),

  setTheme: (theme) => set({ theme }),

  addSession: () => {
    const newId = crypto.randomUUID()
    const { sessions } = get()
    set({
      sessions: [...sessions, { id: newId, status: 'IDLE', label: newId.slice(0, 8) }],
    })
  },

  removeSession: (index) => {
    const { sessions, activeSessionIndex } = get()
    if (sessions.length <= 1) return
    const newSessions = sessions.filter((_, i) => i !== index)
    let newActiveIndex = activeSessionIndex
    if (index < activeSessionIndex) {
      newActiveIndex = activeSessionIndex - 1
    } else if (index === activeSessionIndex) {
      newActiveIndex = Math.min(activeSessionIndex, newSessions.length - 1)
    }
    set({
      sessions: newSessions,
      activeSessionIndex: newActiveIndex,
      sessionId: newSessions[newActiveIndex]?.id ?? null,
    })
  },

  updateSessionStatus: (sessionId, status) => {
    const { sessions } = get()
    set({
      sessions: sessions.map((s) =>
        s.id === sessionId ? { ...s, status } : s
      ),
    })
  },

  switchSession: (index) => {
    const { sessions } = get()
    if (index >= 0 && index < sessions.length) {
      set({
        activeSessionIndex: index,
        sessionId: sessions[index].id,
        agentStatus: sessions[index].status,
      })
    }
  },

  reset: () => set(initialState),
}))
