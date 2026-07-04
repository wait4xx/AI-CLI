import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  AgentStatus,
  type ChatPermissionTier,
  type ChatViewMode,
  type ConversationMeta,
} from '@ai-cli/shared'
import {
  chatReducer,
  initialChatState,
  type ChatAction,
  type ChatRenderState,
} from '../lib/chatReducer'
import {
  type SplitNode,
  type SplitDirection,
  type PanelFileState,
  type FileEntry,
  type SplitPanel,
  createDefaultLayout,
  splitNode as splitTree,
  removeNode as removeTreeNode,
  updateRatios as updateTreeRatios,
  movePanel as moveTreePanel,
  collectPanels,
  genId,
  isContainer,
  findParentWithIndex,
} from '../lib/splitLayout'

interface SessionEntry {
  id: string
  status: AgentStatus
  label: string
  adapterName: string // per-session adapter (claude/shell/aider)
  attachToTmux?: string // if set, this session connects to an existing tmux session
  cwd?: string // working directory for new sessions
}

interface CurrentUser {
  userId: string
  username: string
  role: 'admin' | 'user'
}

interface SessionState {
  // Connection state
  isConnected: boolean
  connectionPhase: 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'

  // Current session (global ref, kept for compatibility)
  sessionId: string | null
  agentStatus: AgentStatus

  // Multi-session
  sessions: SessionEntry[]
  activeSessionIndex: number

  // Auth
  accessToken: string | null
  refreshToken: string | null
  currentUser: CurrentUser | null

  // Terminal settings
  fontSize: number
  editorFontSize: number
  uiTheme: 'dark' | 'light'
  editorTheme: string
  terminalTheme: string
  activeAdapter: string

  // Editor UI state
  sidebarOpen: boolean
  sidebarWidth: number

  // Diff view
  diffEnabled: boolean

  // Approval options from CLI
  approvalOptions: Array<{ label: string; payload: string }> | null

  // Tmux panes
  tmuxPanes: Array<{ index: number; title: string; active: boolean; command: string }>

  // Split pane layout
  splitRoot: SplitNode
  panelFiles: Record<string, PanelFileState> // keyed by panel id
  dragState: {
    type: 'session' | 'panel' | 'file'
    sessionId?: string
    panelId?: string
    filePath?: string
  } | null

  // Per-panel terminal assignment (panelId → sessionId)
  // Each panel shows the terminal session assigned here.
  // Tab clicks assign sessions to the active panel.
  terminalSessions: Record<string, string>

  // Currently focused panel (for tab click targeting)
  activePanelId: string

  // WS function refs (set by TerminalContainer)
  sendInjectCode: ((code: string) => void) | null
  onFileChange: ((event: { path: string; oldContent: string; newContent: string }) => void) | null
  sendSelectPane: ((paneIndex: number) => void) | null
  sendListPanes: (() => void) | null
  sendGrantControl: ((requestId: string) => void) | null
  sendDenyControl: ((requestId: string) => void) | null
  sendRequestControl: (() => void) | null
  sendForceTakeControl: ((sessionId: string) => void) | null

  // Multi-device state
  observerSessions: Record<string, boolean>
  connectedDevices: Array<{
    id: string
    deviceName: string
    username: string
    role: string
    connectedAt: number
  }>
  controlRequests: Array<{
    requestId: string
    deviceName: string
    username: string
    sessionId: string
  }>

  // Multi-conversation (replaces single conversation/chat fields)
  conversations: ConversationMeta[]
  chats: Record<string, ChatRenderState>
  activeConversationId: string | null
  subscribedConversationIds: string[]
  maxConversations: number

  // Hybrid chat view state
  chatConnected: boolean
  chatConnectionPhase: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'
  // Chat WS function refs (set by ChatTransport), mirroring the terminal WS refs
  chatCreateConversation: ((cwd: string) => void) | null
  chatSwitchTo: ((conversationId: string) => void) | null
  chatCloseConversation: ((conversationId: string) => void) | null
  sendChatMessage: ((text: string) => void) | null
  chatEscalate: ((tier: ChatPermissionTier) => void) | null
  chatSwitchView: ((mode: ChatViewMode) => void) | null
  chatReconnect: (() => void) | null

  // Actions
  setConnected: (phase: SessionState['connectionPhase']) => void
  setDisconnected: () => void
  setSession: (
    sessionId: string,
    label?: string,
    attachToTmux?: string,
    cwd?: string,
    adapterName?: string,
  ) => void
  setAgentStatus: (status: AgentStatus, options?: Array<{ label: string; payload: string }>) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setCurrentUser: (user: CurrentUser | null) => void
  setFontSize: (size: number) => void
  setEditorFontSize: (size: number) => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number) => void
  zoomAll: (delta: number) => void
  setUiTheme: (theme: 'dark' | 'light') => void
  setEditorTheme: (id: string) => void
  setTerminalTheme: (id: string) => void
  setActiveAdapter: (adapter: string) => void
  toggleDiff: () => void
  setTmuxPanes: (
    panes: Array<{ index: number; title: string; active: boolean; command: string }>,
  ) => void
  setActivePanelId: (id: string) => void
  setObserverMode: (sessionId: string, isObserver: boolean) => void
  setConnectedDevices: (
    devices: Array<{
      id: string
      deviceName: string
      username: string
      role: string
      connectedAt: number
    }>,
  ) => void
  addControlRequest: (request: {
    requestId: string
    deviceName: string
    username: string
    sessionId: string
  }) => void
  removeControlRequest: (requestId: string) => void

  // Multi-conversation actions
  createConversation: (cwd: string) => string
  switchTo: (conversationId: string) => void
  closeConversation: (conversationId: string) => void
  setConversationStatus: (id: string, status: ConversationMeta['status']) => void
  setConversationViewMode: (id: string, mode: ChatViewMode) => void
  setConversationTier: (id: string, tier: ChatPermissionTier) => void
  setConversationId: (claudeSessionId: string, conversationId: string) => void
  applyChatAction: (conversationId: string, action: ChatAction) => void
  markSubscribed: (conversationId: string) => void
  setMaxConversations: (n: number) => void

  // Chat WS (global, single WS)
  setChatConnected: (phase: SessionState['chatConnectionPhase']) => void

  // Split pane actions
  splitPanel: (
    targetId: string,
    direction: SplitDirection,
    newType: 'editor' | 'terminal',
    insertBefore?: boolean,
  ) => void
  removePanel: (panelId: string) => void
  updateSplitRatios: (containerId: string, newRatios: number[]) => void
  movePanelDrop: (
    sourceId: string,
    targetId: string,
    direction: SplitDirection,
    insertBefore?: boolean,
  ) => void
  addFileToPanel: (panelId: string, file: FileEntry) => void
  replaceActiveFileInPanel: (panelId: string, file: FileEntry) => void
  removeFileFromPanel: (panelId: string, filePath: string) => void
  setActiveFile: (panelId: string, filePath: string | null) => void
  getOrCreateEditorPanel: () => string // returns panel id, creates editor panel if needed
  openFileInNewSplit: (file: FileEntry, direction?: SplitDirection) => string // creates new split editor with file
  setDragState: (state: SessionState['dragState']) => void
  splitPanelWithSession: (
    targetId: string,
    direction: SplitDirection,
    sessionId: string,
    insertBefore: boolean,
  ) => void
  splitPanelWithFile: (
    sourcePanelId: string,
    targetId: string,
    direction: SplitDirection,
    filePath: string,
    insertBefore: boolean,
  ) => void
  addSession: () => void
  removeSession: (index: number) => void
  removeSessionById: (sessionId: string) => void
  updateSessionStatus: (sessionId: string, status: AgentStatus) => void
  switchSession: (index: number) => void
  loadSessions: (sessions: SessionEntry[]) => void
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
  currentUser: null as CurrentUser | null,
  fontSize: 14,
  editorFontSize: 14,
  uiTheme: 'dark' as const,
  editorTheme: 'tokyo-night',
  terminalTheme: 'tokyo-night',
  activeAdapter: 'shell',
  sidebarOpen: true,
  sidebarWidth: 200,
  diffEnabled: false,
  approvalOptions: null as Array<{ label: string; payload: string }> | null,
  sendInjectCode: null as ((code: string) => void) | null,
  onFileChange: null as
    | ((event: { path: string; oldContent: string; newContent: string }) => void)
    | null,
  sendSelectPane: null as ((paneIndex: number) => void) | null,
  sendListPanes: null as (() => void) | null,
  sendGrantControl: null as ((requestId: string) => void) | null,
  sendDenyControl: null as ((requestId: string) => void) | null,
  sendRequestControl: null as (() => void) | null,
  sendForceTakeControl: null as ((sessionId: string) => void) | null,
  tmuxPanes: [] as Array<{ index: number; title: string; active: boolean; command: string }>,
  splitRoot: createDefaultLayout() as SplitNode,
  panelFiles: {} as Record<string, PanelFileState>,
  dragState: null as SessionState['dragState'],
  terminalSessions: {} as Record<string, string>,
  activePanelId: 'terminal-main' as string,
  observerSessions: {},
  connectedDevices: [],
  controlRequests: [],
  conversations: [] as ConversationMeta[],
  chats: {} as Record<string, ChatRenderState>,
  activeConversationId: null as string | null,
  subscribedConversationIds: [] as string[],
  maxConversations: 5,
  chatConnected: false,
  chatConnectionPhase: 'DISCONNECTED' as const,
  chatCreateConversation: null as ((cwd: string) => void) | null,
  chatSwitchTo: null as ((conversationId: string) => void) | null,
  chatCloseConversation: null as ((conversationId: string) => void) | null,
  sendChatMessage: null as ((text: string) => void) | null,
  chatEscalate: null as ((tier: ChatPermissionTier) => void) | null,
  chatSwitchView: null as ((mode: ChatViewMode) => void) | null,
  chatReconnect: null as (() => void) | null,
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
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

      setSession: (sessionId, label?, attachToTmux?, cwd?, adapterName?) => {
        const { sessions, terminalSessions, activeAdapter } = get()
        const existing = sessions.find((s) => s.id === sessionId)
        if (!existing) {
          const ts = { ...terminalSessions }
          if (!ts['terminal-main']) ts['terminal-main'] = sessionId
          set({
            sessionId,
            sessions: [
              ...sessions,
              {
                id: sessionId,
                status: 'IDLE',
                label: label || sessionId.slice(0, 8),
                adapterName: adapterName || activeAdapter,
                attachToTmux,
                cwd,
              },
            ],
            activeSessionIndex: sessions.length,
            terminalSessions: ts,
          })
        } else {
          set({ sessionId })
        }
      },

      setAgentStatus: (status, options?) => {
        const { sessionId, sessions } = get()
        set({
          agentStatus: status,
          approvalOptions: status === 'WAITING_APPROVAL' ? (options ?? null) : null,
          sessions: sessions.map((s) => (s.id === sessionId ? { ...s, status } : s)),
        })
      },

      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),

      setCurrentUser: (currentUser) => set({ currentUser }),

      setFontSize: (size) => set({ fontSize: size }),

      setEditorFontSize: (size) => set({ editorFontSize: size }),

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      zoomAll: (delta) =>
        set((s) => {
          const next = Math.max(10, Math.min(32, s.fontSize + delta))
          return {
            fontSize: next,
            editorFontSize: Math.max(10, Math.min(32, s.editorFontSize + delta)),
          }
        }),

      setUiTheme: (uiTheme) => set({ uiTheme }),

      setEditorTheme: (editorTheme) => set({ editorTheme }),

      setTerminalTheme: (terminalTheme) => set({ terminalTheme }),

      setActiveAdapter: (adapter) => {
        const VALID_ADAPTERS = new Set(['claude', 'aider', 'shell'])
        const safe = VALID_ADAPTERS.has(adapter) ? adapter : 'claude'
        set({ activeAdapter: safe })
      },

      toggleDiff: () => set((s) => ({ diffEnabled: !s.diffEnabled })),

      setTmuxPanes: (panes) => set({ tmuxPanes: panes }),

      setActivePanelId: (id) => {
        const { terminalSessions, sessions } = get()
        const sid = terminalSessions[id]
        if (sid) {
          const idx = sessions.findIndex((s) => s.id === sid)
          set({
            activePanelId: id,
            sessionId: sid,
            activeSessionIndex: idx >= 0 ? idx : 0,
            agentStatus: sessions[idx >= 0 ? idx : 0]?.status ?? 'IDLE',
          })
        } else {
          set({ activePanelId: id })
        }
      },

      setObserverMode: (sessionId, isObserver) =>
        set((s) => ({ observerSessions: { ...s.observerSessions, [sessionId]: isObserver } })),

      setConnectedDevices: (connectedDevices) => set({ connectedDevices }),

      addControlRequest: (request) =>
        set((s) => ({ controlRequests: [...s.controlRequests, request] })),

      removeControlRequest: (requestId) =>
        set((s) => ({
          controlRequests: s.controlRequests.filter((r) => r.requestId !== requestId),
        })),

      createConversation: (cwd) => {
        const { conversations, maxConversations } = get()
        let next = conversations
        if (conversations.length >= maxConversations) {
          const oldest = [...conversations].sort((a, b) => a.lastActivity - b.lastActivity)[0]
          // Evict by claudeSessionId (always a unique UUID); closeConversation
          // matches on either field so placeholders (conversationId='') don't
          // collide when multiple are still pending CHAT_CREATED.
          get().closeConversation(oldest.claudeSessionId)
          next = get().conversations
        }
        const claudeSessionId = crypto.randomUUID()
        const placeholder: ConversationMeta = {
          conversationId: '',
          claudeSessionId,
          cwd,
          viewMode: 'chat',
          tier: 'Explore',
          status: 'connecting',
          lastActivity: Date.now(),
        }
        ;(get() as SessionState & { _pendingActiveClaudeId?: string })._pendingActiveClaudeId =
          claudeSessionId
        set({ conversations: [...next, placeholder], activeConversationId: '' })
        return claudeSessionId
      },

      switchTo: (conversationId) =>
        set((s) => ({
          activeConversationId: conversationId,
          conversations: s.conversations.map((c) =>
            c.conversationId === conversationId ? { ...c, lastActivity: Date.now() } : c,
          ),
        })),

      closeConversation: (conversationId) =>
        set((s) => {
          // Match on conversationId OR claudeSessionId — placeholders carry
          // conversationId='' until CHAT_CREATED arrives, so callers that know
          // the claudeSessionId (e.g. LRU eviction) can target a single entry.
          const removed = s.conversations.find(
            (c) => c.conversationId === conversationId || c.claudeSessionId === conversationId,
          )
          const targetId = removed?.conversationId ?? conversationId
          const remaining = s.conversations.filter(
            (c) =>
              c !== removed &&
              c.conversationId !== conversationId &&
              c.claudeSessionId !== conversationId,
          )
          const nextChats = { ...s.chats }
          delete nextChats[targetId]
          delete nextChats[conversationId]
          let nextActive = s.activeConversationId
          if (s.activeConversationId === targetId || s.activeConversationId === conversationId) {
            nextActive = remaining[remaining.length - 1]?.conversationId ?? null
          }
          return {
            conversations: remaining,
            chats: nextChats,
            activeConversationId: nextActive,
            subscribedConversationIds: s.subscribedConversationIds.filter(
              (id) => id !== targetId && id !== conversationId,
            ),
          }
        }),

      setConversationStatus: (id, status) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.conversationId === id ? { ...c, status } : c,
          ),
        })),

      setConversationViewMode: (id, mode) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.conversationId === id ? { ...c, viewMode: mode, lastActivity: Date.now() } : c,
          ),
        })),

      setConversationTier: (id, tier) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.conversationId === id ? { ...c, tier } : c)),
        })),

      setConversationId: (claudeSessionId, conversationId) =>
        set((s) => {
          const conversations = s.conversations.map((c) =>
            c.claudeSessionId === claudeSessionId
              ? { ...c, conversationId, status: 'active' as const }
              : c,
          )
          const pending = (s as SessionState & { _pendingActiveClaudeId?: string })
            ._pendingActiveClaudeId
          const activeConversationId =
            pending === claudeSessionId ? conversationId : s.activeConversationId
          return { conversations, activeConversationId }
        }),

      applyChatAction: (conversationId, action) =>
        set((s) => {
          const prev = s.chats[conversationId] ?? initialChatState
          return { chats: { ...s.chats, [conversationId]: chatReducer(prev, action) } }
        }),

      markSubscribed: (conversationId) =>
        set((s) =>
          s.subscribedConversationIds.includes(conversationId)
            ? s
            : { subscribedConversationIds: [...s.subscribedConversationIds, conversationId] },
        ),

      setMaxConversations: (n) => set({ maxConversations: Math.max(1, Math.min(10, n)) }),

      setChatConnected: (phase) =>
        set({ chatConnected: phase === 'CONNECTED', chatConnectionPhase: phase }),

      addSession: () => {
        const MAX_SESSIONS = 10
        const { sessions } = get()
        if (sessions.length >= MAX_SESSIONS) return
        const newId = crypto.randomUUID()
        const num = sessions.length + 1
        set({
          sessions: [
            ...sessions,
            { id: newId, status: 'IDLE', label: `Term ${num}`, adapterName: get().activeAdapter },
          ],
        })
      },

      removeSession: (index) => {
        const { sessions, activeSessionIndex, terminalSessions, splitRoot } = get()
        if (sessions.length <= 1) return
        const removedId = sessions[index].id
        const newSessions = sessions.filter((_, i) => i !== index)
        // Clean up terminalSessions references to removed session
        const cleanedTs = Object.fromEntries(
          Object.entries(terminalSessions).filter(([_, sid]) => sid !== removedId),
        )
        // Remove split panels that were showing the killed session
        let newSplitRoot = splitRoot
        const panels = collectPanels(splitRoot)
        for (const panel of panels) {
          if (panel.type === 'terminal' && terminalSessions[panel.id] === removedId) {
            const result = removeTreeNode(splitRoot, panel.id)
            if (result) newSplitRoot = result
          }
        }
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
          terminalSessions: cleanedTs,
          splitRoot: newSplitRoot,
        })
      },

      removeSessionById: (sessionId) => {
        const { sessions, activeSessionIndex } = get()
        const index = sessions.findIndex((s) => s.id === sessionId)
        if (index === -1) return
        if (sessions.length <= 1) {
          const newId = crypto.randomUUID()
          set({
            sessions: [
              { id: newId, status: 'IDLE', label: newId.slice(0, 8), adapterName: 'shell' },
            ],
            activeSessionIndex: 0,
            sessionId: newId,
          })
          return
        }
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
          sessions: sessions.map((s) => (s.id === sessionId ? { ...s, status } : s)),
        })
      },

      switchSession: (index) => {
        const { sessions, activePanelId, terminalSessions } = get()
        if (index >= 0 && index < sessions.length) {
          const sid = sessions[index].id
          set({
            activeSessionIndex: index,
            sessionId: sid,
            agentStatus: sessions[index].status,
            terminalSessions: { ...terminalSessions, [activePanelId]: sid },
          })
        }
      },

      loadSessions: (sessions) => {
        if (sessions.length > 0) {
          const { terminalSessions } = get()
          const ts = { ...terminalSessions }
          if (!ts['terminal-main']) ts['terminal-main'] = sessions[0].id
          set({
            sessions,
            activeSessionIndex: 0,
            sessionId: sessions[0].id,
            agentStatus: sessions[0].status,
            terminalSessions: ts,
          })
        }
      },

      // Split pane actions
      splitPanel: (targetId, direction, newType, insertBefore) => {
        const { splitRoot } = get()
        const newPanel: SplitPanel = { id: genId(), type: newType }
        const newRoot = splitTree(splitRoot, targetId, direction, newPanel, insertBefore)
        set({ splitRoot: newRoot })
      },

      removePanel: (panelId) => {
        const { splitRoot, panelFiles, terminalSessions } = get()
        // Find sibling panel to merge files into
        const parentInfo = findParentWithIndex(splitRoot, panelId)
        let siblingId: string | null = null
        if (parentInfo) {
          const { parent, index } = parentInfo
          // Try adjacent sibling first
          const sibling = parent.children[index - 1] ?? parent.children[index + 1]
          if (sibling && !isContainer(sibling)) {
            siblingId = sibling.id
          }
        }
        const newRoot = removeTreeNode(splitRoot, panelId)
        if (newRoot) set({ splitRoot: newRoot })
        // Merge files into sibling panel
        const sourceFiles = panelFiles[panelId]
        if (siblingId && sourceFiles && sourceFiles.files.length > 0) {
          const targetPf = panelFiles[siblingId]
          const mergedFiles = targetPf
            ? [
                ...targetPf.files.filter(
                  (f) => !sourceFiles.files.some((sf) => sf.path === f.path),
                ),
                ...sourceFiles.files,
              ]
            : [...sourceFiles.files]
          const mergedActive =
            sourceFiles.activeFilePath ?? targetPf?.activeFilePath ?? mergedFiles[0]?.path ?? null
          set({
            panelFiles: {
              ...Object.fromEntries(Object.entries(panelFiles).filter(([k]) => k !== panelId)),
              [siblingId]: { files: mergedFiles, activeFilePath: mergedActive },
            },
          })
        } else {
          const restFiles = { ...panelFiles }
          delete restFiles[panelId]
          set({ panelFiles: restFiles })
        }
        const restSessions = { ...terminalSessions }
        delete restSessions[panelId]
        set({ terminalSessions: restSessions })
      },

      updateSplitRatios: (containerId, newRatios) => {
        const { splitRoot } = get()
        set({ splitRoot: updateTreeRatios(splitRoot, containerId, newRatios) })
      },

      movePanelDrop: (sourceId, targetId, direction, insertBefore) => {
        const { splitRoot } = get()
        set({ splitRoot: moveTreePanel(splitRoot, sourceId, targetId, direction, insertBefore) })
      },

      addFileToPanel: (panelId, file) => {
        const { panelFiles } = get()
        const existing = panelFiles[panelId]
        if (existing) {
          const hasFile = existing.files.some((f) => f.path === file.path)
          set({
            panelFiles: {
              ...panelFiles,
              [panelId]: {
                files: hasFile ? existing.files : [...existing.files, file],
                activeFilePath: file.path,
              },
            },
          })
        } else {
          set({
            panelFiles: {
              ...panelFiles,
              [panelId]: { files: [file], activeFilePath: file.path },
            },
          })
        }
      },

      replaceActiveFileInPanel: (panelId, file) => {
        const { panelFiles } = get()
        const existing = panelFiles[panelId]
        if (existing && existing.activeFilePath) {
          set({
            panelFiles: {
              ...panelFiles,
              [panelId]: {
                files: existing.files.map((f) => (f.path === existing.activeFilePath ? file : f)),
                activeFilePath: file.path,
              },
            },
          })
        } else {
          set({
            panelFiles: {
              ...panelFiles,
              [panelId]: { files: [file], activeFilePath: file.path },
            },
          })
        }
      },

      removeFileFromPanel: (panelId, filePath) => {
        const { panelFiles } = get()
        const existing = panelFiles[panelId]
        if (!existing) return
        const remaining = existing.files.filter((f) => f.path !== filePath)
        const newActive =
          filePath === existing.activeFilePath
            ? remaining.length > 0
              ? remaining[remaining.length - 1].path
              : null
            : existing.activeFilePath
        set({
          panelFiles: {
            ...panelFiles,
            [panelId]: { files: remaining, activeFilePath: newActive },
          },
        })
      },

      setActiveFile: (panelId, filePath) => {
        const { panelFiles } = get()
        const existing = panelFiles[panelId]
        if (!existing) return
        set({
          panelFiles: {
            ...panelFiles,
            [panelId]: { ...existing, activeFilePath: filePath },
          },
        })
      },

      getOrCreateEditorPanel: () => {
        const { splitRoot } = get()
        const panels = collectPanels(splitRoot)
        const editorPanel = panels.find((p) => p.type === 'editor')
        if (editorPanel) return editorPanel.id
        const newPanel: SplitPanel = { id: genId(), type: 'editor' }
        const newRoot = splitTree(splitRoot, splitRoot.id, 'horizontal', newPanel, true)
        set({ splitRoot: newRoot })
        return newPanel.id
      },

      openFileInNewSplit: (file, direction = 'vertical') => {
        const { splitRoot, panelFiles } = get()
        // Find an existing editor panel to split from
        const panels = collectPanels(splitRoot)
        const existingEditor = panels.find((p) => p.type === 'editor')
        const targetId = existingEditor ? existingEditor.id : splitRoot.id
        // Create new editor panel
        const newPanel: SplitPanel = { id: genId(), type: 'editor' }
        const newRoot = splitTree(splitRoot, targetId, direction, newPanel, false)
        // Add file to the new panel
        const restFiles = { ...panelFiles }
        delete restFiles[newPanel.id]
        set({
          splitRoot: newRoot,
          panelFiles: { ...restFiles, [newPanel.id]: { files: [file], activeFilePath: file.path } },
        })
        return newPanel.id
      },

      setDragState: (state) => set({ dragState: state }),

      splitPanelWithSession: (targetId, direction, sessionId, insertBefore) => {
        const { splitRoot, terminalSessions, panelFiles } = get()

        const sourceEntry = Object.entries(terminalSessions).find(([_, sid]) => sid === sessionId)
        const sourcePanelId = sourceEntry?.[0]
        const isSplitSelf = sourcePanelId === targetId

        // When splitting onto self, keep session on the original panel; new panel starts empty
        const cleanedTs = isSplitSelf
          ? terminalSessions
          : Object.fromEntries(
              Object.entries(terminalSessions).filter(([_, sid]) => sid !== sessionId),
            )

        // Remove source panel from layout tree (skip when splitting onto self — panel stays)
        let currentRoot = splitRoot
        const cleanedFiles = panelFiles
        if (!isSplitSelf && sourcePanelId) {
          const afterRemove = removeTreeNode(currentRoot, sourcePanelId)
          if (afterRemove) {
            currentRoot = afterRemove
            delete cleanedFiles[sourcePanelId]
          }
        }

        const newPanel: SplitPanel = { id: genId(), type: 'terminal' }
        const newRoot = splitTree(currentRoot, targetId, direction, newPanel, insertBefore)
        set({
          splitRoot: newRoot,
          terminalSessions: { ...cleanedTs, ...(!isSplitSelf ? { [newPanel.id]: sessionId } : {}) },
          panelFiles: cleanedFiles,
          activePanelId: isSplitSelf ? sourcePanelId : newPanel.id,
          sessionId,
        })
      },

      splitPanelWithFile: (sourcePanelId, targetId, direction, filePath, insertBefore) => {
        const { splitRoot, panelFiles } = get()

        // Extract the file entry from source panel
        const sourceFiles = panelFiles[sourcePanelId]
        const fileEntry = sourceFiles?.files.find((f) => f.path === filePath)
        if (!fileEntry) return

        // Remove file from source panel
        const remainingFiles = sourceFiles.files.filter((f) => f.path !== filePath)
        const newActiveFile =
          remainingFiles.length > 0 ? remainingFiles[remainingFiles.length - 1].path : null

        let currentRoot = splitRoot
        const cleanedFiles = { ...panelFiles }

        // If source panel has no files left, remove it from tree
        if (remainingFiles.length === 0 && sourcePanelId !== targetId) {
          const afterRemove = removeTreeNode(currentRoot, sourcePanelId)
          if (afterRemove) {
            currentRoot = afterRemove
            delete cleanedFiles[sourcePanelId]
          } else {
            cleanedFiles[sourcePanelId] = { files: [], activeFilePath: null }
          }
        } else {
          cleanedFiles[sourcePanelId] = { files: remainingFiles, activeFilePath: newActiveFile }
        }

        // Create new editor panel at target with the moved file
        const newPanel: SplitPanel = { id: genId(), type: 'editor' }
        const newRoot = splitTree(currentRoot, targetId, direction, newPanel, insertBefore)
        set({
          splitRoot: newRoot,
          panelFiles: {
            ...cleanedFiles,
            [newPanel.id]: { files: [fileEntry], activeFilePath: filePath },
          },
        })
      },

      // [M7修复] 使用展开运算符创建新对象，避免引用问题
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'ai-cli-layout',
      // [M-#4修复] NOTE: Never persist accessToken/refreshToken here — they belong in sessionStorage via useAuth only
      partialize: (state) => ({
        fontSize: state.fontSize,
        editorFontSize: state.editorFontSize,
        uiTheme: state.uiTheme,
        editorTheme: state.editorTheme,
        terminalTheme: state.terminalTheme,
        activeAdapter: state.activeAdapter,
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth,
        splitRoot: state.splitRoot,
        panelFiles: state.panelFiles,
        terminalSessions: state.terminalSessions,
        sessions: state.sessions,
        activeSessionIndex: state.activeSessionIndex,
        maxConversations: state.maxConversations,
      }),
      version: 2,
    },
  ),
)
