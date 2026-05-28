import { useState, useCallback, useRef } from 'react'
import { Drawer } from 'vaul'
import { Folder, File, ChevronRight, FolderOpen, Loader2, AlertCircle, ChevronLeft } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

interface FileExplorerProps {
  onFileSelect: (path: string, content: string, language: string) => void
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
  const parts = path.split('/').filter(Boolean)
  const crumbs = [{ label: '~', path: '' }]
  let accumulated = ''
  for (const part of parts) {
    accumulated = accumulated ? `${accumulated}/${part}` : part
    crumbs.push({ label: part, path: accumulated })
  }
  return crumbs
}

export function FileExplorer({ onFileSelect }: FileExplorerProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<FileExplorerState>({
    currentPath: '',
    entries: [],
    loading: false,
    error: null,
  })
  // 安全修复[W23]: 使用 AbortController 防止并发请求竞态条件
  const abortRef = useRef<AbortController | null>(null)

  const fetchTree = useCallback(async (dirPath: string) => {
    const token = useSessionStore.getState().accessToken
    if (!token) return

    // 取消上一个未完成的请求
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setState(prev => ({ ...prev, loading: true, error: null, currentPath: dirPath }))

    try {
      const res = await fetch(
        `${API_BASE}/api/fs/tree?path=${encodeURIComponent(dirPath)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
      )
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
      // 忽略被 abort 的请求（用户快速切换目录时触发）
      if (controller.signal.aborted) return
      setState(prev => ({ ...prev, loading: false, error: (err as Error).message }))
    }
  }, [])

  const handleOpen = useCallback(() => {
    setOpen(true)
    fetchTree(state.currentPath || '')
  }, [fetchTree, state.currentPath])

  const handleEntryClick = useCallback(async (entry: FileEntry) => {
    if (entry.type === 'directory') {
      fetchTree(entry.path)
      return
    }

    const token = useSessionStore.getState().accessToken
    if (!token) return

    // Cancel any in-progress tree request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const res = await fetch(
        `${API_BASE}/api/fs/file?path=${encodeURIComponent(entry.path)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      onFileSelect(entry.path, data.content, data.language)
      setOpen(false)
    } catch (err) {
      if (controller.signal.aborted) return
      setState(prev => ({ ...prev, loading: false, error: (err as Error).message }))
    }
  }, [onFileSelect, fetchTree])

  const handleBreadcrumb = useCallback((path: string) => {
    fetchTree(path)
  }, [fetchTree])

  const breadcrumbs = buildBreadcrumbs(state.currentPath)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} direction="bottom">
      <Drawer.Trigger asChild>
        <button
          onClick={handleOpen}
          className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15 transition-colors"
          aria-label="Browse files"
        >
          <FolderOpen className="w-5 h-5 text-gray-400" />
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1b26] rounded-t-xl max-h-[85vh] flex flex-col">
          <div className="flex flex-col h-full max-h-[85vh]">
            {/* Drag handle */}
            <div className="flex justify-center py-2 shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Header */}
            <div className="px-4 pb-2 shrink-0">
              <Drawer.Title className="text-white text-sm font-medium">File Explorer</Drawer.Title>
            </div>

            {/* Breadcrumbs */}
            <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto shrink-0 scrollbar-hide">
              {breadcrumbs.map((crumb, i) => (
                <button
                  key={crumb.path}
                  onClick={() => handleBreadcrumb(crumb.path)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white whitespace-nowrap transition-colors"
                >
                  {i > 0 && <ChevronRight className="w-3 h-3" />}
                  <span className={i === breadcrumbs.length - 1 ? 'text-white font-medium' : ''}>
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

              {!state.loading && !state.error && state.currentPath && (
                <button
                  onClick={() => {
                    const parentParts = state.currentPath.split('/').filter(Boolean)
                    parentParts.pop()
                    fetchTree(parentParts.join('/'))
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-gray-400 text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>..</span>
                </button>
              )}

              {!state.loading && !state.error && state.entries.map(entry => (
                <button
                  key={entry.path}
                  onClick={() => handleEntryClick(entry)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors text-left"
                >
                  {entry.type === 'directory' ? (
                    <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                  ) : (
                    <File className="w-4 h-4 text-gray-500 shrink-0" />
                  )}
                  <span className="flex-1 text-sm text-gray-200 truncate">{entry.name}</span>
                  {entry.type === 'file' && entry.size != null && (
                    <span className="text-[11px] text-gray-500 shrink-0">{formatFileSize(entry.size)}</span>
                  )}
                  {entry.type === 'directory' && (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 shrink-0" />
                  )}
                </button>
              ))}

              {!state.loading && !state.error && state.entries.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-8">Empty directory</p>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
