import { StatusBar } from './components/StatusBar'
import { TerminalContainer } from './components/TerminalContainer'
import { SettingsDrawer } from './components/SettingsDrawer'
import { FileExplorer } from './components/FileExplorer'
import { useAuth } from './hooks/useAuth'
import { useSessionStore } from './store/sessionStore'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Settings } from 'lucide-react'

const CodeEditor = lazy(() => import('./components/CodeEditor').then(m => ({ default: m.CodeEditor })))

function LoginForm({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full">
      <form onSubmit={handleSubmit} className="w-72 space-y-4">
        <h1 className="text-xl font-semibold text-gray-100 text-center">AI CLI Mobile</h1>
        {error && (
          <p className="text-red-400 text-xs text-center">{error}</p>
        )}
        <input
          type="text"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 rounded bg-dark-surface border border-dark-border text-gray-100 text-sm focus:outline-none focus:border-blue-500"
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="密码"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded bg-dark-surface border border-dark-border text-gray-100 text-sm focus:outline-none focus:border-blue-500"
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full py-2 rounded bg-blue-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  )
}

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
