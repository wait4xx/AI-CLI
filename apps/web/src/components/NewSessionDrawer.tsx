import { useState, useCallback, useRef, useEffect } from 'react'
import { Drawer } from 'vaul'
import { Plus, Terminal, Monitor, Loader2, RefreshCw, Folder } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

interface TmuxSession {
  name: string
  windows: number
  attached: number
}

interface Completion {
  name: string
  path: string
}

interface NewSessionDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewSessionDrawer({ open, onOpenChange }: NewSessionDrawerProps) {
  const [tmuxSessions, setTmuxSessions] = useState<TmuxSession[]>([])
  const [loading, setLoading] = useState(false)
  const [cwd, setCwd] = useState('')
  const [completions, setCompletions] = useState<Completion[]>([])
  const [showCompletions, setShowCompletions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchTmuxSessions = useCallback(async () => {
    const token = useSessionStore.getState().accessToken
    if (!token) return

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/sessions/tmux`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setTmuxSessions(data.sessions || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const fetchCompletions = useCallback(async (input: string) => {
    const token = useSessionStore.getState().accessToken
    if (!token || !input) {
      setCompletions([])
      setShowCompletions(false)
      return
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/fs/complete?path=${encodeURIComponent(input)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (res.ok) {
        const data = await res.json()
        const items = data.completions || []
        setCompletions(items)
        setShowCompletions(items.length > 0)
      }
    } catch { /* ignore */ }
  }, [])

  const handlePathChange = useCallback((value: string) => {
    setCwd(value)
    setShowCompletions(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchCompletions(value)
    }, 200)
  }, [fetchCompletions])

  const selectCompletion = useCallback((c: Completion) => {
    setCwd(c.path + '/')
    setCompletions([])
    setShowCompletions(false)
  }, [])

  const handleNewSession = useCallback(() => {
    const newId = crypto.randomUUID()
    useSessionStore.getState().setSession(newId, undefined, undefined, cwd || undefined)
    onOpenChange(false)
  }, [onOpenChange, cwd])

  const handleAttachTmux = useCallback((tmuxName: string) => {
    const newId = crypto.randomUUID()
    useSessionStore.getState().setSession(newId, tmuxName, tmuxName)
    onOpenChange(false)
  }, [onOpenChange])

  const handleDrawerOpen = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen)
    if (isOpen) {
      setCwd('')
      setCompletions([])
      setShowCompletions(false)
      fetchTmuxSessions()
    }
  }, [onOpenChange, fetchTmuxSessions])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return (
    <Drawer.Root open={open} onOpenChange={handleDrawerOpen} direction="bottom">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1b26] rounded-t-xl max-h-[75vh] flex flex-col">
          <div className="flex flex-col h-full max-h-[75vh]">
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            <div className="px-4 pb-3 shrink-0">
              <Drawer.Title className="text-white text-sm font-medium">New Session</Drawer.Title>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {/* New session with CWD input */}
              <button
                onClick={handleNewSession}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-left mb-1"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">New Session</p>
                  {cwd && <p className="text-xs text-gray-500 truncate">Start in: {cwd}</p>}
                </div>
              </button>

              {/* CWD input with autocomplete */}
              <div className="relative px-1 mb-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-gray-700/50">
                  <Folder className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <input
                    type="text"
                    value={cwd}
                    onChange={(e) => handlePathChange(e.target.value)}
                    onBlur={() => setTimeout(() => setShowCompletions(false), 150)}
                    onFocus={() => completions.length > 0 && setShowCompletions(true)}
                    placeholder="Working directory (optional)"
                    className="flex-1 bg-transparent text-xs text-gray-300 placeholder-gray-600 outline-none"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* Autocomplete dropdown */}
                {showCompletions && completions.length > 0 && (
                  <div className="absolute left-1 right-1 mt-1 bg-[#24253a] rounded-lg border border-gray-700/50 shadow-xl z-10 max-h-40 overflow-y-auto">
                    {completions.map((c) => (
                      <button
                        key={c.path}
                        onMouseDown={() => selectCompletion(c)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
                      >
                        <Folder className="w-3 h-3 text-blue-400 shrink-0" />
                        <span className="text-xs text-gray-300 truncate">{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-xs text-gray-500 shrink-0">or connect to tmux</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              {/* Tmux sessions header */}
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-xs text-gray-500">Available tmux sessions</span>
                <button
                  onClick={fetchTmuxSessions}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  aria-label="Refresh tmux sessions"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loading && tmuxSessions.length === 0 && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                </div>
              )}

              {!loading && tmuxSessions.length === 0 && (
                <p className="text-center text-gray-600 text-xs py-4">No available tmux sessions</p>
              )}

              {tmuxSessions.map((session) => (
                <button
                  key={session.name}
                  onClick={() => handleAttachTmux(session.name)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                    <Monitor className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{session.name}</p>
                    <p className="text-xs text-gray-500">
                      {session.windows} window{session.windows !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Terminal className="w-4 h-4 text-gray-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
