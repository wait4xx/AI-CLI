import { useState, useCallback } from 'react'
import { Drawer } from 'vaul'
import { Monitor, Trash2, RefreshCw, Loader2, Pencil, Check, X, Terminal } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

interface TmuxSession {
  name: string
  windows: number
  attached: number
  created: string
  isManaged: boolean
  adapterName?: string
}

interface TmuxManagerDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TmuxManagerDrawer({ open, onOpenChange }: TmuxManagerDrawerProps) {
  const [sessions, setSessions] = useState<TmuxSession[]>([])
  const [loading, setLoading] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmKill, setConfirmKill] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    const token = useSessionStore.getState().accessToken
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/tmux`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [])

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      onOpenChange(isOpen)
      if (isOpen) {
        setConfirmKill(null)
        setRenaming(null)
        fetchSessions()
      }
    },
    [onOpenChange, fetchSessions],
  )

  const killSession = useCallback(async (name: string) => {
    const token = useSessionStore.getState().accessToken
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/tmux/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.name !== name))
      }
    } catch {
      /* ignore */
    }
    setConfirmKill(null)
  }, [])

  const startRename = useCallback((name: string) => {
    setRenaming(name)
    setRenameValue(name)
  }, [])

  const confirmRename = useCallback(
    async (oldName: string) => {
      const newName = renameValue.trim()
      if (!newName || newName === oldName) {
        setRenaming(null)
        return
      }
      const token = useSessionStore.getState().accessToken
      if (!token) return
      try {
        const res = await fetch(`${API_BASE}/api/tmux/${encodeURIComponent(oldName)}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newName }),
        })
        if (res.ok) {
          setSessions((prev) => prev.map((s) => (s.name === oldName ? { ...s, name: newName } : s)))
        }
      } catch {
        /* ignore */
      }
      setRenaming(null)
    },
    [renameValue],
  )

  return (
    <Drawer.Root open={open} onOpenChange={handleOpen} direction="bottom">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1b26] rounded-t-xl max-h-[80vh] flex flex-col">
          <div className="flex flex-col h-full max-h-[80vh]">
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            <div className="flex items-center justify-between px-4 pb-3 shrink-0">
              <Drawer.Title className="text-white text-sm font-medium">Tmux Sessions</Drawer.Title>
              <button
                onClick={fetchSessions}
                className="p-1.5 rounded hover:bg-white/10 transition-colors"
                aria-label="Refresh sessions"
              >
                <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {loading && sessions.length === 0 && (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                </div>
              )}

              {!loading && sessions.length === 0 && (
                <p className="text-center text-gray-600 text-xs py-10">No tmux sessions found</p>
              )}

              {sessions.map((session) => (
                <div
                  key={session.name}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      session.isManaged ? 'bg-blue-500/20' : 'bg-green-500/20'
                    }`}
                  >
                    {session.isManaged ? (
                      <Terminal className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Monitor className="w-4 h-4 text-green-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {renaming === session.name ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmRename(session.name)
                            if (e.key === 'Escape') setRenaming(null)
                          }}
                          autoFocus
                          className="flex-1 bg-white/5 border border-gray-600 rounded px-2 py-0.5 text-xs text-gray-200 outline-none focus:border-blue-500"
                          spellCheck={false}
                        />
                        <button
                          onClick={() => confirmRename(session.name)}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          <Check className="w-3 h-3 text-green-400" />
                        </button>
                        <button
                          onClick={() => setRenaming(null)}
                          className="p-1 rounded hover:bg-white/10"
                        >
                          <X className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-gray-200 truncate">{session.name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{session.windows}w</span>
                          <span>{session.attached}a</span>
                          {session.isManaged && session.adapterName && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">
                              {session.adapterName}
                            </span>
                          )}
                          {!session.isManaged && (
                            <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">
                              external
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {renaming !== session.name && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startRename(session.name)}
                        className="p-1.5 rounded hover:bg-white/10 transition-colors opacity-50 group-hover:opacity-100"
                        aria-label="Rename session"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      {confirmKill === session.name ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => killSession(session.name)}
                            className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmKill(null)}
                            className="p-1 rounded hover:bg-white/10"
                          >
                            <X className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmKill(session.name)}
                          className="p-1.5 rounded hover:bg-white/10 transition-colors opacity-50 group-hover:opacity-100"
                          aria-label="Kill session"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
