import { StatusBar } from './components/StatusBar'
import { TerminalContainer } from './components/TerminalContainer'
import { SettingsDrawer } from './components/SettingsDrawer'
import { FileExplorer } from './components/FileExplorer'
import { SessionTabs } from './components/SessionTabs'
import { LoginForm } from './components/LoginForm'
import { useAuth } from './hooks/useAuth'
import { useSessionStore } from './store/sessionStore'
import { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import { Settings } from 'lucide-react'

const CodeEditor = lazy(() => import('./components/CodeEditor').then(m => ({ default: m.CodeEditor })))

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

export default function App() {
  const { isAuthenticated, login, loadStoredAuth } = useAuth()
  const { sessionId, setSession, loadSessions, accessToken } = useSessionStore()
  const [restoring, setRestoring] = useState(false)

  const [editorFile, setEditorFile] = useState<{
    path: string
    content: string
    language: string
  } | null>(null)

  useEffect(() => {
    loadStoredAuth()
  }, [loadStoredAuth])

  // On auth, restore existing sessions or create a new one
  useEffect(() => {
    if (!isAuthenticated || !accessToken || sessionId || restoring) return

    setRestoring(true)
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/sessions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (res.ok) {
          const data = await res.json()
          const sessions = (data.sessions || []) as Array<{
            sessionId: string
            status: string
            tmuxSessionName: string
            adapterName: string
          }>
          if (sessions.length > 0) {
            loadSessions(sessions.map(s => ({
              id: s.sessionId,
              status: s.status as 'IDLE' | 'RUNNING' | 'WAITING_APPROVAL' | 'ERROR',
              label: s.tmuxSessionName.startsWith('aicli-') ? s.sessionId.slice(0, 8) : s.tmuxSessionName,
              attachToTmux: s.tmuxSessionName.startsWith('aicli-') ? undefined : s.tmuxSessionName,
            })))
            setRestoring(false)
            return
          }
        }
      } catch { /* ignore — fall through to create new */ }
      // No existing sessions — create a fresh one
      setSession(crypto.randomUUID())
      setRestoring(false)
    })()
  }, [isAuthenticated, accessToken, sessionId, setSession, loadSessions, restoring])

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen flex flex-col bg-dark-bg">
        <LoginForm onLogin={login} />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-bg">
      <StatusBar actionsSlot={
        <>
          <FileExplorer onFileSelect={(path, content, language) =>
            setEditorFile({ path, content, language })
          } />
          <SettingsDrawer trigger={
            <button className="ml-1 p-1 text-gray-400 hover:text-gray-200 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          } />
        </>
      } />
      <SessionTabs />
      <div className="flex-1 relative overflow-hidden">
        <TerminalContainer />
      </div>
      {editorFile && (
        <Suspense fallback={<div className="fixed inset-0 z-30 bg-[#1a1b26] flex items-center justify-center text-gray-400 text-sm">Loading editor...</div>}>
          <CodeEditor
            filePath={editorFile.path}
            content={editorFile.content}
            language={editorFile.language}
            onClose={() => setEditorFile(null)}
            onInjectCode={(code: string) => useSessionStore.getState().sendInjectCode?.(code)}
          />
        </Suspense>
      )}
    </div>
  )
}
