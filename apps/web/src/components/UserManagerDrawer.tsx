import { useState, useEffect, useCallback } from 'react'
import { Drawer } from 'vaul'
import { X, Plus, Trash2, Shield, User, Key } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import { useUiTheme } from '../hooks/useUiTheme'

const { Root, Trigger, Portal, Overlay, Content, Title, Description, Close } = Drawer

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

interface UserItem {
  userId: string
  username: string
  role: string
  createdAt: string
}

export function UserManagerDrawer() {
  const accessToken = useSessionStore((s) => s.accessToken)
  const currentUser = useSessionStore((s) => s.currentUser)
  const ui = useUiTheme()
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const fetchUsers = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch {
      /* ignore */
    }
    setLoading(false)
  }, [accessToken])

  useEffect(() => {
    if (open) fetchUsers()
  }, [open, fetchUsers])

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return
    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      })
      if (res.ok) {
        setNewUsername('')
        setNewPassword('')
        setNewRole('user')
        fetchUsers()
      } else {
        const data = await res.json().catch(() => ({ error: 'Failed' }))
        setError(data.error || 'Failed to create user')
      }
    } catch {
      setError('Network error')
    }
    setCreating(false)
  }

  const handleDelete = async (username: string) => {
    if (username === currentUser?.username) return
    const res = await fetch(`${API_BASE}/api/auth/users/${username}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (res.ok) fetchUsers()
  }

  const handleRoleChange = async (username: string, role: string) => {
    const res = await fetch(`${API_BASE}/api/auth/users/${username}/role`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) fetchUsers()
  }

  const handlePasswordChange = async (username: string) => {
    const newPassword = prompt(`Enter new password for ${username} (min 6 chars):`)
    if (!newPassword || newPassword.length < 6) return
    const res = await fetch(`${API_BASE}/api/auth/users/${username}/password`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword }),
    })
    if (res.ok) alert('Password updated')
  }

  if (currentUser?.role !== 'admin') return null

  return (
    <Root open={open} onOpenChange={setOpen}>
      <Trigger asChild>
        <button
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg ${ui.hover} ${ui.active} transition-colors text-left`}
        >
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${ui.text}`}>User Management</p>
            <p className={`text-xs ${ui.textDim}`}>Manage users and roles</p>
          </div>
        </button>
      </Trigger>
      <Portal>
        <Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Content
          className={`fixed bottom-0 left-0 right-0 z-50 ${ui.surface} rounded-t-xl border-t ${ui.border} max-h-[80vh]`}
        >
          <div className="mx-auto w-12 h-1.5 rounded-full bg-gray-600 mt-3" />
          <div className="flex items-center justify-between px-4 py-3">
            <Title className={`text-sm font-semibold ${ui.text}`}>User Management</Title>
            <Description className="sr-only">
              Create, delete, and manage user accounts and roles
            </Description>
            <Close asChild>
              <button className={`p-1 ${ui.textMuted} ${ui.hover}`}>
                <X className="w-4 h-4" />
              </button>
            </Close>
          </div>

          {/* Create user */}
          <div className={`px-4 pb-3 border-b ${ui.border}`}>
            <p className={`text-xs font-medium ${ui.textMuted} mb-2`}>Add New User</p>
            <div className="flex gap-2">
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Username"
                className={`flex-1 px-2 py-1.5 rounded text-sm ${ui.surface} border ${ui.border} ${ui.text} outline-none`}
              />
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="Password"
                className={`flex-1 px-2 py-1.5 rounded text-sm ${ui.surface} border ${ui.border} ${ui.text} outline-none`}
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                className={`px-2 py-1.5 rounded text-sm ${ui.surface} border ${ui.border} ${ui.text} outline-none`}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
              <button
                onClick={handleCreate}
                disabled={creating || !newUsername || !newPassword}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
          </div>

          {/* User list */}
          <div className="px-4 py-3 space-y-2 max-h-[50vh] overflow-y-auto">
            {loading ? (
              <p className={`text-xs ${ui.textDim}`}>Loading...</p>
            ) : (
              users.map((u) => (
                <div
                  key={u.userId}
                  className={`flex items-center gap-2 p-2 rounded-lg ${ui.surface} border ${ui.border}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${u.role === 'admin' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}
                  >
                    {u.role === 'admin' ? (
                      <Shield className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${ui.text} truncate`}>{u.username}</p>
                    <p className={`text-[10px] ${ui.textDim}`}>
                      {u.role === 'admin' ? 'Admin' : 'User'} ·{' '}
                      {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {u.username !== currentUser?.username && (
                      <button
                        onClick={() =>
                          handleRoleChange(u.username, u.role === 'admin' ? 'user' : 'admin')
                        }
                        className={`p-1 rounded ${ui.hover} ${ui.textMuted} transition-colors`}
                        title={u.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                      >
                        <Shield
                          className={`w-3.5 h-3.5 ${u.role === 'admin' ? 'text-orange-400' : ''}`}
                        />
                      </button>
                    )}
                    <button
                      onClick={() => handlePasswordChange(u.username)}
                      className={`p-1 rounded ${ui.hover} ${ui.textMuted} transition-colors`}
                      title="Change password"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                    {u.username !== currentUser?.username && (
                      <button
                        onClick={() => handleDelete(u.username)}
                        className={`p-1 rounded ${ui.hover} text-red-400 transition-colors`}
                        title="Delete user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="h-6" />
        </Content>
      </Portal>
    </Root>
  )
}
