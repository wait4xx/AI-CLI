import { StatusBar } from './components/StatusBar'
import { SettingsDrawer } from './components/SettingsDrawer'
import { FileExplorer } from './components/FileExplorer'
import { SessionTabs } from './components/SessionTabs'
import { LoginForm } from './components/LoginForm'
import { SplitPane } from './components/SplitPane'
import { DragOverlay } from './components/DragOverlay'
import { ControlRequestToast } from './components/ControlRequestToast'
import { SessionShareDrawer } from './components/SessionShareDrawer'
import { useAuth } from './hooks/useAuth'
import { useSessionStore } from './store/sessionStore'
import { useEffect, useState } from 'react'
import { Settings, FileText, FileDiff } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

export default function App() {
  const { isAuthenticated, login, loadStoredAuth, refreshToken, logout } = useAuth()
  const sessionId = useSessionStore((s) => s.sessionId)
  const setSession = useSessionStore((s) => s.setSession)
  const loadSessions = useSessionStore((s) => s.loadSessions)
  const accessToken = useSessionStore((s) => s.accessToken)
  const [restoring, setRestoring] = useState(false)

  // Diff badge state (global)
  const [diffBadge, setDiffBadge] = useState(0)

  const splitRoot = useSessionStore((s) => s.splitRoot)

  useEffect(() => {
    loadStoredAuth()
  }, [loadStoredAuth])

  // Wire up file change callback to store
  useEffect(() => {
    useSessionStore.getState().onFileChange = (_event) => {
      setDiffBadge((prev) => prev + 1)
    }
    return () => {
      useSessionStore.getState().onFileChange = null
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated || !accessToken || sessionId || restoring) return

    setRestoring(true)
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sessions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        // [M-#8修复] 401 时尝试刷新 token，失败则登出，不创建幽灵会话
        if (res.status === 401) {
          try {
            await refreshToken()
          } catch {
            logout()
          }
          setRestoring(false)
          return
        }
        if (res.ok) {
          const data = await res.json()
          const sessions = (data.sessions || []) as Array<{
            sessionId: string
            status: string
            tmuxSessionName: string
            adapterName: string
          }>
          if (sessions.length > 0) {
            loadSessions(
              sessions.map((s) => ({
                id: s.sessionId,
                status: s.status as 'IDLE' | 'RUNNING' | 'WAITING_APPROVAL' | 'ERROR',
                label: s.tmuxSessionName.startsWith('aicli-')
                  ? s.sessionId.slice(0, 8)
                  : s.tmuxSessionName,
                adapterName: s.adapterName || 'shell',
                attachToTmux: s.tmuxSessionName.startsWith('aicli-')
                  ? undefined
                  : s.tmuxSessionName,
              })),
            )
            setRestoring(false)
            return
          }
        }
      } catch {
        /* ignore */
      }
      setSession(crypto.randomUUID())
      setRestoring(false)
    })()
    // refreshToken/logout omitted from deps — they use refs internally and are effectively stable
  }, [
    isAuthenticated,
    accessToken,
    sessionId,
    setSession,
    loadSessions,
    restoring,
    refreshToken,
    logout,
  ])

  if (!isAuthenticated) {
    return <LoginForm onLogin={login} />
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-bg">
      <StatusBar
        actionsSlot={
          <>
            <button
              onClick={() => useSessionStore.getState().toggleDiff()}
              className={`ml-1 p-1 transition-colors ${useSessionStore.getState().diffEnabled ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
              aria-label="Toggle diff view"
            >
              <FileDiff className="w-4 h-4" />
            </button>
            {diffBadge > 0 && useSessionStore.getState().diffEnabled && (
              <button
                onClick={() => {
                  setDiffBadge(0)
                }}
                className="ml-1 relative p-1 text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Show file diff"
              >
                <FileText className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-500 text-[9px] text-white flex items-center justify-center">
                  {diffBadge > 9 ? '9+' : diffBadge}
                </span>
              </button>
            )}
            {sessionId && <SessionShareDrawer sessionId={sessionId} />}
            <FileExplorer
              onFileSelect={(path, content, language) => {
                const panelId = useSessionStore.getState().getOrCreateEditorPanel()
                useSessionStore.getState().addFileToPanel(panelId, { path, content, language })
              }}
              onFileOpenInSplit={(path, content, language) => {
                useSessionStore.getState().openFileInNewSplit({ path, content, language })
              }}
            />
            <SettingsDrawer
              trigger={
                <button className="ml-1 p-1 text-gray-400 hover:text-gray-200 transition-colors">
                  <Settings className="w-4 h-4" />
                </button>
              }
            />
          </>
        }
      />
      <SessionTabs />
      <div className="flex-1 min-h-0 overflow-hidden">
        <SplitPane node={splitRoot} />
      </div>
      <DragOverlay />
      <ControlRequestToast />
    </div>
  )
}
