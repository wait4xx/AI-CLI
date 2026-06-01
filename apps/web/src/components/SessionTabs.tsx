import { useRef, useCallback, memo, useState, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import { useUiTheme } from '../hooks/useUiTheme'
import { NewSessionDrawer } from './NewSessionDrawer'
import { collectPanels } from '../lib/splitLayout'
import type { AgentStatus } from '@ai-cli/shared'

const STATUS_COLORS: Record<AgentStatus, string> = {
  IDLE: 'bg-gray-400',
  RUNNING: 'bg-green-400 animate-pulse',
  WAITING_APPROVAL: 'bg-yellow-400 animate-pulse',
  ERROR: 'bg-red-400',
}

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

export const SessionTabs = memo(function SessionTabs() {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionIndex = useSessionStore((s) => s.activeSessionIndex)
  const removeSession = useSessionStore((s) => s.removeSession)
  const switchSession = useSessionStore((s) => s.switchSession)
  // Get sessionIds actually rendered in the current split layout
  const terminalSessions = useSessionStore((s) => s.terminalSessions)
  const splitRoot = useSessionStore((s) => s.splitRoot)
  const visibleSessionIds = useMemo(() => {
    // 从 splitRoot 树中收集所有实际渲染的面板 ID
    const panels = collectPanels(splitRoot)
    const panelIds = new Set(panels.filter((p) => p.type === 'terminal').map((p) => p.id))
    // 只取这些面板映射到的 session
    const ids = new Set<string>()
    for (const panelId of panelIds) {
      const sid = terminalSessions[panelId]
      if (sid) ids.add(sid)
    }
    return ids
  }, [terminalSessions, splitRoot])
  const ui = useUiTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const didDragRef = useRef(false)

  const handleTabClick = useCallback(
    (index: number) => {
      // Skip click if a drag just ended (mousedown was used for drag)
      if (didDragRef.current) {
        didDragRef.current = false
        return
      }
      switchSession(index)
    },
    [switchSession],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.preventDefault()
      killAndRemove(index)
    },
    [sessions],
  )

  const killAndRemove = useCallback(
    async (index: number) => {
      const session = sessions[index]
      if (!session) return
      // Remove from store FIRST — clears terminalSessions + splitRoot panel,
      // so TerminalContainer unmounts / sessionId becomes null before reconnect can fire
      removeSession(index)
      // Then kill on server (best effort — session already removed from UI)
      const token = useSessionStore.getState().accessToken
      if (token) {
        try {
          await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(session.id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        } catch {
          /* best effort */
        }
      }
    },
    [sessions, removeSession],
  )

  const handleCloseClick = useCallback(
    (e: React.MouseEvent, index: number) => {
      e.stopPropagation()
      killAndRemove(index)
    },
    [killAndRemove],
  )

  return (
    <>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 ${ui.surface} border-t ${ui.border} overflow-x-auto scrollbar-none`}
      >
        {sessions.map((session, index) => {
          const isActive = index === activeSessionIndex
          const isVisible = visibleSessionIds.has(session.id)
          const isHovered = hoveredIndex === index
          return (
            <button
              key={session.id}
              data-drag-session={session.id}
              onClick={() => handleTabClick(index)}
              onContextMenu={(e) => handleContextMenu(e, index)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors cursor-grab relative ${
                isActive
                  ? `${ui.border} text-white bg-white/15`
                  : isVisible
                    ? `${ui.border} ${ui.text} bg-white/5`
                    : `${ui.textMuted} ${ui.hover}`
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[session.status]}`} />
              <span className={isActive ? 'text-white font-semibold' : ''}>
                {session.label || session.id.slice(0, 8)}
              </span>
              {/* Hover close button */}
              {isHovered && (
                <span
                  onClick={(e) => handleCloseClick(e, index)}
                  className="ml-0.5 p-0.5 rounded hover:bg-white/20 transition-colors"
                >
                  <X className="w-3 h-3 text-gray-400 hover:text-red-400 transition-colors" />
                </span>
              )}
            </button>
          )
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className={`flex items-center justify-center w-7 h-7 rounded ${ui.textMuted} ${ui.hover} transition-colors flex-shrink-0`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <NewSessionDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  )
})
