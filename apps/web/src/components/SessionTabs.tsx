import { useRef, useCallback, memo } from 'react'
import { Plus, X } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import type { AgentStatus } from '@ai-cli/shared'

const STATUS_COLORS: Record<AgentStatus, string> = {
  IDLE: 'bg-gray-400',
  RUNNING: 'bg-green-400 animate-pulse',
  WAITING_APPROVAL: 'bg-yellow-400 animate-pulse',
  ERROR: 'bg-red-400',
}

export const SessionTabs = memo(function SessionTabs() {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionIndex = useSessionStore((s) => s.activeSessionIndex)
  const addSession = useSessionStore((s) => s.addSession)
  const removeSession = useSessionStore((s) => s.removeSession)
  const switchSession = useSessionStore((s) => s.switchSession)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTabPress = useCallback((index: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    switchSession(index)
  }, [switchSession])

  const handleTabLongPressStart = useCallback((index: number) => {
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      removeSession(index)
    }, 600)
  }, [removeSession])

  const handleTabLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  if (sessions.length <= 1) return null

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 bg-dark-surface border-t border-dark-border overflow-x-auto scrollbar-none">
      {sessions.map((session, index) => (
        <button
          key={session.id}
          onClick={() => handleTabPress(index)}
          onMouseDown={() => handleTabLongPressStart(index)}
          onMouseUp={handleTabLongPressEnd}
          onMouseLeave={handleTabLongPressEnd}
          onTouchStart={() => handleTabLongPressStart(index)}
          onTouchEnd={handleTabLongPressEnd}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono whitespace-nowrap transition-colors ${
            index === activeSessionIndex
              ? 'bg-dark-border text-gray-100'
              : 'text-gray-400 hover:text-gray-200 hover:bg-dark-border/50'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[session.status]}`} />
          <span>{session.id.slice(0, 8)}</span>
        </button>
      ))}
      <button
        onClick={() => addSession()}
        className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-border/50 transition-colors flex-shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
})