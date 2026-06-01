import { useState, useCallback, useRef } from 'react'
import { Drawer } from 'vaul'
import {
  Folder,
  File,
  ChevronRight,
  FolderOpen,
  Loader2,
  AlertCircle,
  Plus,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Pencil,
  Check,
  X,
  MoreVertical,
  ArrowLeft,
  FolderSearch,
  Columns2,
} from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import { useUiTheme } from '../hooks/useUiTheme'

interface FileExplorerProps {
  onFileSelect: (path: string, content: string, language: string) => void
  onFileOpenInNewTab?: (path: string, content: string, language: string) => void
  onFileOpenInSplit?: (path: string, content: string, language: string) => void
}

interface FileEntry {
  name: string
  path: string
  type: 'directory' | 'file'
  size?: number
  modified: string
}

interface FileExplorerState {
  currentPath: string
  entries: FileEntry[]
  loading: boolean
  error: string | null
}

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function buildBreadcrumbs(path: string): { label: string; path: string }[] {
  if (!path) return [{ label: '~', path: '' }]
  const isAbsolute = path.startsWith('/')
  const parts = path.split('/').filter(Boolean)
  const crumbs: { label: string; path: string }[] = []
  if (isAbsolute) crumbs.push({ label: '/', path: '/' })
  else crumbs.push({ label: '~', path: '' })
  for (let i = 0; i < parts.length; i++) {
    const partialPath = isAbsolute
      ? '/' + parts.slice(0, i + 1).join('/')
      : parts.slice(0, i + 1).join('/')
    crumbs.push({ label: parts[i], path: partialPath })
  }
  return crumbs
}

export function FileExplorer({
  onFileSelect,
  onFileOpenInNewTab,
  onFileOpenInSplit,
}: FileExplorerProps) {
  const [open, setOpen] = useState(false)
  const ui = useUiTheme()
  const [state, setState] = useState<FileExplorerState>({
    currentPath: '',
    entries: [],
    loading: false,
    error: null,
  })
  const abortRef = useRef<AbortController | null>(null)

  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showNewInput, setShowNewInput] = useState<'file' | 'folder' | null>(null)
  const [newName, setNewName] = useState('')
  const [actionMenu, setActionMenu] = useState<string | null>(null)
  const [pathInput, setPathInput] = useState('')
  const [showPathInput, setShowPathInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getToken = useCallback(() => useSessionStore.getState().accessToken, [])

  const fetchTree = useCallback(
    async (dirPath: string) => {
      const token = getToken()
      if (!token) return
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setState((prev) => ({ ...prev, loading: true, error: null, currentPath: dirPath }))
      try {
        const res = await fetch(`${API_BASE}/api/fs/tree?path=${encodeURIComponent(dirPath)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        const entries: FileEntry[] = (data.entries || []).sort((a: FileEntry, b: FileEntry) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        setState({ currentPath: dirPath, entries, loading: false, error: null })
      } catch (err) {
        if (controller.signal.aborted) return
        setState((prev) => ({ ...prev, loading: false, error: (err as Error).message }))
      }
    },
    [getToken],
  )

  const fetchFileContent = useCallback(
    async (entry: FileEntry): Promise<{ content: string; language: string } | null> => {
      const token = getToken()
      if (!token) return null
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setState((prev) => ({ ...prev, loading: true, error: null }))
      try {
        const res = await fetch(`${API_BASE}/api/fs/file?path=${encodeURIComponent(entry.path)}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        return { content: data.content, language: data.language }
      } catch (err) {
        if (controller.signal.aborted) return null
        setState((prev) => ({ ...prev, loading: false, error: (err as Error).message }))
        return null
      }
    },
    [getToken],
  )

  const handleEntryClick = useCallback(
    async (entry: FileEntry) => {
      if (entry.type === 'directory') {
        fetchTree(entry.path)
        return
      }
      const result = await fetchFileContent(entry)
      if (result) onFileSelect(entry.path, result.content, result.language)
      setOpen(false)
    },
    [onFileSelect, fetchFileContent, fetchTree],
  )

  const handleBreadcrumb = useCallback(
    (path: string) => {
      fetchTree(path)
    },
    [fetchTree],
  )

  const fetchCwdAndTree = useCallback(async () => {
    const token = getToken()
    const sid = useSessionStore.getState().sessionId
    if (!token || !sid) {
      fetchTree('')
      return
    }
    let cwd = ''
    try {
      const res = await fetch(`${API_BASE}/api/fs/cwd?sessionId=${encodeURIComponent(sid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        cwd = data.cwd || ''
      }
    } catch {
      /* fallback */
    }
    fetchTree(cwd)
  }, [fetchTree, getToken])

  const createEntry = useCallback(
    async (type: 'file' | 'folder') => {
      const name = newName.trim()
      if (!name) {
        setShowNewInput(null)
        return
      }
      const token = getToken()
      if (!token) return
      const entryPath = state.currentPath ? `${state.currentPath}/${name}` : name
      try {
        const res = await fetch(`${API_BASE}/api/fs/${type === 'folder' ? 'mkdir' : 'new-file'}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: entryPath }),
        })
        if (res.ok) fetchTree(state.currentPath)
      } catch {
        /* ignore */
      }
      setShowNewInput(null)
      setNewName('')
    },
    [newName, state.currentPath, fetchTree, getToken],
  )

  const deleteEntry = useCallback(
    async (entryPath: string) => {
      const token = getToken()
      if (!token) return
      try {
        await fetch(`${API_BASE}/api/fs/file`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: entryPath }),
        })
        fetchTree(state.currentPath)
      } catch {
        /* ignore */
      }
      setConfirmDelete(null)
      setActionMenu(null)
    },
    [state.currentPath, fetchTree, getToken],
  )

  const renameEntry = useCallback(
    async (oldPath: string, newNameStr: string) => {
      const trimmed = newNameStr.trim()
      if (!trimmed) {
        setRenaming(null)
        return
      }
      const parts = oldPath.split('/')
      parts[parts.length - 1] = trimmed
      const newPath = parts.join('/')
      const token = getToken()
      if (!token) return
      try {
        await fetch(`${API_BASE}/api/fs/rename`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldPath, newPath }),
        })
        fetchTree(state.currentPath)
      } catch {
        /* ignore */
      }
      setRenaming(null)
    },
    [state.currentPath, fetchTree, getToken],
  )

  const downloadEntry = useCallback(
    (entryPath: string) => {
      const token = getToken()
      if (!token) return
      const name = entryPath.split('/').pop() || 'download'
      fetch(`${API_BASE}/api/fs/download?path=${encodeURIComponent(entryPath)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.blob())
        .then((blob) => {
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = name
          a.click()
          URL.revokeObjectURL(a.href)
        })
        .catch(() => {})
      setActionMenu(null)
    },
    [getToken],
  )

  // [M-#1修复] 危险扩展名上传确认：检测后弹窗提示用户，确认后才上传
  const DANGEROUS_EXTENSIONS = new Set([
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.msi',
    '.ps1',
    '.vbs',
    '.dll',
    '.so',
    '.dylib',
    '.app',
  ])

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files?.length) return
      const token = getToken()
      if (!token) return

      // 检查是否有危险扩展名
      const dangerousFiles = Array.from(files).filter((f) => {
        const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
        return DANGEROUS_EXTENSIONS.has(ext)
      })

      if (dangerousFiles.length > 0) {
        const names = dangerousFiles.map((f) => f.name).join(', ')
        const confirmed = window.confirm(
          `⚠️ 以下文件可能存在安全风险：\n${names}\n\n确定要上传吗？`,
        )
        if (!confirmed) {
          e.target.value = ''
          return
        }
      }

      const formData = new FormData()
      for (let i = 0; i < files.length; i++) formData.append('files', files[i])
      try {
        await fetch(`${API_BASE}/api/fs/upload?dir=${encodeURIComponent(state.currentPath)}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        fetchTree(state.currentPath)
      } catch {
        /* ignore */
      }
      e.target.value = ''
    },
    [state.currentPath, fetchTree, getToken],
  )

  const goUp = useCallback(() => {
    if (!state.currentPath) return
    const isAbsolute = state.currentPath.startsWith('/')
    const parentParts = state.currentPath.split('/').filter(Boolean)
    parentParts.pop()
    fetchTree(
      isAbsolute
        ? parentParts.length > 0
          ? '/' + parentParts.join('/')
          : '/'
        : parentParts.join('/'),
    )
  }, [state.currentPath, fetchTree])

  const handlePathJump = useCallback(() => {
    const p = pathInput.trim()
    if (p) {
      fetchTree(p)
      setShowPathInput(false)
      setPathInput('')
    }
  }, [pathInput, fetchTree])

  const breadcrumbs = buildBreadcrumbs(state.currentPath)

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          setConfirmDelete(null)
          setRenaming(null)
          setShowNewInput(null)
          setActionMenu(null)
          setShowPathInput(false)
          setPathInput('')
          fetchCwdAndTree()
        }
      }}
      direction="bottom"
    >
      <Drawer.Trigger asChild>
        <button
          className={`p-2 rounded-lg ${ui.hover} ${ui.active} transition-colors`}
          aria-label="Browse files"
        >
          <FolderOpen className={`w-5 h-5 ${ui.textMuted}`} />
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content
          className={`fixed bottom-0 left-0 right-0 z-50 ${ui.surface} rounded-t-xl max-h-[85vh] flex flex-col`}
        >
          <div className="flex flex-col h-full max-h-[85vh]">
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Header with navigation + actions */}
            <div className="flex items-center justify-between px-4 pb-2 shrink-0">
              <div className="flex items-center gap-1">
                {state.currentPath && (
                  <button
                    onClick={goUp}
                    className={`p-1.5 rounded ${ui.hover}`}
                    aria-label="Go back"
                  >
                    <ArrowLeft className={`w-4 h-4 ${ui.textMuted}`} />
                  </button>
                )}
                <Drawer.Title className={`${ui.text} text-sm font-medium`}>Files</Drawer.Title>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setShowPathInput(!showPathInput)
                    setPathInput(state.currentPath)
                  }}
                  className={`p-1.5 rounded ${ui.hover}`}
                  aria-label="Jump to path"
                >
                  <FolderSearch className={`w-4 h-4 ${ui.textMuted}`} />
                </button>
                <button
                  onClick={() => {
                    setShowNewInput('file')
                    setNewName('')
                  }}
                  className={`p-1.5 rounded ${ui.hover}`}
                  aria-label="New file"
                >
                  <Plus className={`w-4 h-4 ${ui.textMuted}`} />
                </button>
                <button
                  onClick={() => {
                    setShowNewInput('folder')
                    setNewName('')
                  }}
                  className={`p-1.5 rounded ${ui.hover}`}
                  aria-label="New folder"
                >
                  <FolderPlus className={`w-4 h-4 ${ui.textMuted}`} />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-1.5 rounded ${ui.hover}`}
                  aria-label="Upload"
                >
                  <Upload className={`w-4 h-4 ${ui.textMuted}`} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
              </div>
            </div>

            {/* Path jump input */}
            {showPathInput && (
              <div className="flex items-center gap-2 px-4 pb-2 shrink-0">
                <input
                  type="text"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePathJump()
                    if (e.key === 'Escape') setShowPathInput(false)
                  }}
                  placeholder="/path/to/directory"
                  autoFocus
                  className={`flex-1 ${ui.dark ? 'bg-white/5 border-gray-600' : 'bg-black/5 border-gray-300'} border rounded px-2 py-1.5 text-xs ${ui.text} outline-none focus:border-blue-500`}
                />
                <button
                  onClick={handlePathJump}
                  className="px-2 py-1.5 rounded bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30"
                >
                  Go
                </button>
              </div>
            )}

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto shrink-0 scrollbar-hide">
              {breadcrumbs.map((crumb, i) => (
                <button
                  key={crumb.path}
                  onClick={() => handleBreadcrumb(crumb.path)}
                  className={`flex items-center gap-1 text-xs ${ui.textMuted} hover:${ui.text} whitespace-nowrap transition-colors`}
                >
                  {i > 0 && <ChevronRight className="w-3 h-3" />}
                  <span className={i === breadcrumbs.length - 1 ? `${ui.text} font-medium` : ''}>
                    {crumb.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {state.loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                </div>
              )}
              {state.error && (
                <div className="flex items-center gap-2 px-3 py-3 mx-2 rounded-lg bg-red-500/10 text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{state.error}</span>
                </div>
              )}

              {showNewInput && (
                <div className="flex items-center gap-1.5 px-3 py-2">
                  {showNewInput === 'folder' ? (
                    <FolderPlus className="w-4 h-4 text-blue-400 shrink-0" />
                  ) : (
                    <Plus className="w-4 h-4 text-green-400 shrink-0" />
                  )}
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') createEntry(showNewInput)
                      if (e.key === 'Escape') setShowNewInput(null)
                    }}
                    placeholder={showNewInput === 'folder' ? 'folder name' : 'file name'}
                    autoFocus
                    className={`flex-1 ${ui.dark ? 'bg-white/5 border-gray-600' : 'bg-black/5 border-gray-300'} border rounded px-2 py-1 text-xs ${ui.text} outline-none focus:border-blue-500`}
                  />
                  <button
                    onClick={() => createEntry(showNewInput)}
                    className={`p-1 rounded ${ui.hover}`}
                  >
                    <Check className="w-3 h-3 text-green-400" />
                  </button>
                  <button
                    onClick={() => setShowNewInput(null)}
                    className={`p-1 rounded ${ui.hover}`}
                  >
                    <X className={`w-3 h-3 ${ui.textMuted}`} />
                  </button>
                </div>
              )}

              {!state.loading &&
                !state.error &&
                state.entries.map((entry) => (
                  <div key={entry.path} className="relative group">
                    {renaming === entry.path ? (
                      <div className="flex items-center gap-1.5 px-3 py-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameEntry(entry.path, renameValue)
                            if (e.key === 'Escape') setRenaming(null)
                          }}
                          autoFocus
                          className={`flex-1 ${ui.dark ? 'bg-white/5 border-gray-600' : 'bg-black/5 border-gray-300'} border rounded px-2 py-0.5 text-xs ${ui.text} outline-none focus:border-blue-500`}
                        />
                        <button
                          onClick={() => renameEntry(entry.path, renameValue)}
                          className={`p-1 rounded ${ui.hover}`}
                        >
                          <Check className="w-3 h-3 text-green-400" />
                        </button>
                        <button
                          onClick={() => setRenaming(null)}
                          className={`p-1 rounded ${ui.hover}`}
                        >
                          <X className={`w-3 h-3 ${ui.textMuted}`} />
                        </button>
                      </div>
                    ) : confirmDelete === entry.path ? (
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <span className="text-xs text-red-400 flex-1">Delete {entry.name}?</span>
                        <button
                          onClick={() => deleteEntry(entry.path)}
                          className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className={`p-1 rounded ${ui.hover}`}
                        >
                          <X className={`w-3 h-3 ${ui.textMuted}`} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEntryClick(entry)}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg ${ui.hover} ${ui.active} transition-colors text-left`}
                      >
                        {entry.type === 'directory' ? (
                          <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : (
                          <File className={`w-4 h-4 ${ui.textDim} shrink-0`} />
                        )}
                        <span className={`flex-1 text-sm ${ui.text} truncate`}>{entry.name}</span>
                        {entry.type === 'file' && entry.size != null && (
                          <span className={`text-[11px] ${ui.textDim} shrink-0`}>
                            {formatFileSize(entry.size)}
                          </span>
                        )}
                        {entry.type === 'directory' && (
                          <ChevronRight className={`w-3.5 h-3.5 ${ui.textDim} shrink-0`} />
                        )}
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            setActionMenu(actionMenu === entry.path ? null : entry.path)
                          }}
                          className={`p-1 rounded ${ui.hover} opacity-0 group-hover:opacity-100 transition-opacity`}
                        >
                          <MoreVertical className={`w-3.5 h-3.5 ${ui.textMuted}`} />
                        </span>
                      </button>
                    )}

                    {actionMenu === entry.path &&
                      renaming !== entry.path &&
                      confirmDelete !== entry.path && (
                        <div
                          className={`absolute right-2 top-full mt-1 z-10 ${ui.dark ? 'bg-[#24283b] border-gray-700' : 'bg-white border-gray-300'} border rounded-lg shadow-xl py-1 min-w-[120px]`}
                        >
                          {entry.type === 'file' && onFileOpenInSplit && (
                            <button
                              onClick={() => {
                                setActionMenu(null)
                                const token = getToken()
                                if (!token) return
                                fetch(
                                  `${API_BASE}/api/fs/file?path=${encodeURIComponent(entry.path)}`,
                                  {
                                    headers: { Authorization: `Bearer ${token}` },
                                  },
                                )
                                  .then((r) => r.json())
                                  .then((data) => {
                                    if (data.content)
                                      onFileOpenInSplit(
                                        entry.path,
                                        data.content,
                                        data.language || 'text',
                                      )
                                  })
                                  .catch(() => {})
                                setOpen(false)
                              }}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${ui.text} ${ui.hover}`}
                            >
                              <Columns2 className="w-3 h-3" /> Open in Split
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActionMenu(null)
                              setRenaming(entry.path)
                              setRenameValue(entry.name)
                            }}
                            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${ui.text} ${ui.hover}`}
                          >
                            <Pencil className="w-3 h-3" /> Rename
                          </button>
                          <button
                            onClick={() => downloadEntry(entry.path)}
                            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${ui.text} ${ui.hover}`}
                          >
                            <Download className="w-3 h-3" /> Download
                          </button>
                          <button
                            onClick={() => {
                              setActionMenu(null)
                              setConfirmDelete(entry.path)
                            }}
                            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 ${ui.hover}`}
                          >
                            <Trash2 className="w-3 h-3" /> Delete
                          </button>
                        </div>
                      )}
                  </div>
                ))}

              {!state.loading && !state.error && state.entries.length === 0 && !showNewInput && (
                <p className={`text-center ${ui.textDim} text-sm py-8`}>Empty directory</p>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
