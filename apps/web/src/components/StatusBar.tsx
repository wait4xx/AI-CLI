import { Loader2 } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import type { AgentStatus } from '@ai-cli/shared'

const agentStatusConfig: Record<AgentStatus, { label: string; className: string; icon?: 'spin' | 'blink' }> = {
  IDLE: { label: 'IDLE', className: 'bg-gray-600 text-gray-300' },
  RUNNING: { label: 'RUNNING', className: 'bg-blue-600 text-blue-100', icon: 'spin' },
  WAITING_APPROVAL: { label: 'APPROVAL', className: 'bg-orange-500 text-orange-100', icon: 'blink' },
  ERROR: { label: 'ERROR', className: 'bg-red-600 text-red-100' },
}

export function StatusBar({ actionsSlot }: { actionsSlot?: React.ReactNode }) {
  const { connectionPhase, agentStatus, sessions, activeSessionIndex } = useSessionStore()

  const dotColor =
    connectionPhase === 'CONNECTED'
      ? 'bg-green-500'
      : connectionPhase === 'DISCONNECTED'
        ? 'bg-red-500'
        : 'bg-yellow-500'

  const config = agentStatusConfig[agentStatus]

  return (
    <div className="flex items-center gap-2 px-3 h-[40px] bg-dark-surface border-b border-dark-border text-xs text-gray-300 shrink-0">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />

      <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${config.className}`}
      >
        {config.icon === 'spin' && <Loader2 className="w-3 h-3 animate-spin" />}
        {config.icon === 'blink' && (
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        )}
        {config.label}
      </span>

      <span className="flex-1" />

      {sessions[activeSessionIndex] && (
        <span className="text-gray-500 truncate max-w-[120px] text-[11px]">
          {sessions[activeSessionIndex].label}
        </span>
      )}

      {actionsSlot}
    </div>
  )
}
