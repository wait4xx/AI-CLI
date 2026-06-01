import { useState, useEffect, useCallback } from 'react'
import { Drawer } from 'vaul'
import { X, Share2, Eye, Pencil, Trash2 } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import { useUiTheme } from '../hooks/useUiTheme'

const { Root, Trigger, Portal, Overlay, Content, Title, Close } = Drawer

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

interface SharedEntry {
  username: string
  permission: string
}

export function SessionShareDrawer({ sessionId }: { sessionId: string }) {
  const accessToken = useSessionStore((s) => s.accessToken)
  const ui = useUiTheme()
  const [open, setOpen] = useState(false)
  const [sharedList, setSharedList] = useState<SharedEntry[]>([])
  const [targetUser, setTargetUser] = useState('')
  const [permission, setPermission] = useState<'read' | 'write'>('read')
  const [error, setError] = useState('')
  const [sharedWithMe, setSharedWithMe] = useState<
    Array<{ sessionId: string; ownerName: string; permission: string }>
  >([])

  const fetchSharedWithMe = useCallback(async () => {
    if (!accessToken) return
    try {
      const res = await fetch(`${API_BASE}/api/sessions/shared`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setSharedWithMe(data.sessions || [])
      }
    } catch {
      /* ignore */
    }
  }, [accessToken])

  useEffect(() => {
    if (open) fetchSharedWithMe()
  }, [open, fetchSharedWithMe])

  const handleShare = async () => {
    if (!targetUser) return
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUsername: targetUser, permission }),
      })
      if (res.ok) {
        setSharedList([...sharedList, { username: targetUser, permission }])
        setTargetUser('')
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed' }))
        setError(data.error || 'Failed to share')
      }
    } catch {
      setError('Network error')
    }
  }

  const handleUnshare = async (username: string) => {
    const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/unshare`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUsername: username }),
    })
    if (res.ok) {
      setSharedList(sharedList.filter((s) => s.username !== username))
    }
  }

  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <button
          className={`p-1.5 rounded-lg ${ui.hover} ${ui.active} transition-colors`}
          title="Share session"
        >
          <Share2 className={`w-4 h-4 ${ui.textMuted}`} />
        </button>
      </Trigger>
      <Portal>
        <Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Content
          className={`fixed bottom-0 left-0 right-0 z-50 ${ui.surface} rounded-t-xl border-t ${ui.border} max-h-[80vh]`}
        >
          <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-600 mt-3" />
          <div className="flex items-center justify-between px-4 py-3">
            <Title className={`text-sm font-semibold ${ui.text}`}>Session Sharing</Title>
            <Close asChild>
              <button className={`p-1 ${ui.textMuted} ${ui.hover}`}>
                <X className="w-4 h-4" />
              </button>
            </Close>
          </div>

          <div className={`px-4 pb-3 border-b ${ui.border}`}>
            <p className={`text-xs font-medium ${ui.textMuted} mb-2`}>Share this session</p>
            <div className="flex gap-2">
              <input
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="Username"
                className={`flex-1 px-2 py-1.5 rounded text-sm ${ui.surface} border ${ui.border} ${ui.text} outline-none`}
              />
              <select
                value={permission}
                onChange={(e) => setPermission(e.target.value as 'read' | 'write')}
                className={`px-2 py-1.5 rounded text-sm ${ui.surface} border ${ui.border} ${ui.text} outline-none`}
              >
                <option value="read">Read-only</option>
                <option value="write">Can request edit</option>
              </select>
              <button
                onClick={handleShare}
                disabled={!targetUser}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50"
              >
                Share
              </button>
            </div>
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>

          {sharedList.length > 0 && (
            <div className={`px-4 py-3 border-b ${ui.border}`}>
              <p className={`text-xs font-medium ${ui.textMuted} mb-2`}>Shared with</p>
              {sharedList.map((s) => (
                <div
                  key={s.username}
                  className={`flex items-center justify-between py-1.5 ${ui.text}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{s.username}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${s.permission === 'write' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}
                    >
                      {s.permission === 'write' ? (
                        <span className="flex items-center gap-0.5">
                          <Pencil className="w-2.5 h-2.5" /> Edit
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5">
                          <Eye className="w-2.5 h-2.5" /> View
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => handleUnshare(s.username)}
                    className={`p-1 rounded ${ui.hover} text-red-400`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {sharedWithMe.length > 0 && (
            <div className="px-4 py-3">
              <p className={`text-xs font-medium ${ui.textMuted} mb-2`}>Shared with me</p>
              {sharedWithMe.map((s) => (
                <div
                  key={s.sessionId}
                  className={`flex items-center justify-between py-1.5 ${ui.text}`}
                >
                  <div>
                    <p className="text-sm">{s.sessionId.slice(0, 8)}</p>
                    <p className={`text-[10px] ${ui.textDim}`}>
                      by {s.ownerName} · {s.permission}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      useSessionStore.getState().setSession(s.sessionId)
                    }}
                    className={`px-2 py-1 rounded text-xs ${ui.hover} ${ui.textMuted}`}
                  >
                    Observe
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="h-6" />
        </Content>
      </Portal>
    </Root>
  )
}
