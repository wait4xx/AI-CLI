import { StatusBar } from './components/StatusBar'
import { TerminalContainer } from './components/TerminalContainer'
import { SettingsDrawer } from './components/SettingsDrawer'
import { FileExplorer } from './components/FileExplorer'
import { SessionTabs } from './components/SessionTabs'
import { LoginForm } from './components/LoginForm'
import { useAuth } from './hooks/useAuth'
import { useSessionStore } from './store/sessionStore'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Settings } from 'lucide-react'

const CodeEditor = lazy(() => import('./components/CodeEditor').then(m => ({ default: m.CodeEditor })))

export default function App() {
  const { isAuthenticated, login, loadStoredAuth } = useAuth()
  const { sessionId, setSession } = useSessionStore()

  const [editorFile, setEditorFile] = useState<{
    path: string
    content: string
    language: string
  } | null>(null)

  useEffect(() => {
    loadStoredAuth()
  }, [loadStoredAuth])

  useEffect(() => {
    if (isAuthenticated && !sessionId) {
      setSession(crypto.randomUUID())
    }
  }, [isAuthenticated, sessionId, setSession])

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
