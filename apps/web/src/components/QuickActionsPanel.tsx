import { useSessionStore } from '../store/sessionStore'

interface QuickActionsPanelProps {
  onAction: (payload: string) => void
}

const actions = [
  { label: '✓ Approve', payload: '\r', variant: 'approve' },
  { label: '✗ Deny', payload: 'n\r', variant: 'deny' },
  { label: '⏼ Cancel', payload: '\x03', variant: 'cancel' },
] as const

const variantStyles: Record<string, string> = {
  approve: 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white',
  deny: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white',
  cancel: 'bg-gray-600 hover:bg-gray-500 active:bg-gray-700 text-gray-200',
}

export function QuickActionsPanel({ onAction }: QuickActionsPanelProps) {
  const visible = useSessionStore((s) => s.agentStatus === 'WAITING_APPROVAL')

  return (
    <div
      className={`absolute bottom-0 left-0 right-0 flex items-center justify-center gap-2 px-3 py-2.5 bg-dark-surface/95 border-t border-dark-border backdrop-blur-sm transition-transform duration-200 ease-out pointer-events-auto ${visible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ visibility: visible ? 'visible' : 'hidden' }}
    >
      {actions.map((action) => (
        <button
          key={action.payload}
          onClick={() => onAction(action.payload)}
          className={`flex-1 max-w-[120px] px-3 py-2 rounded text-sm font-medium transition-colors ${variantStyles[action.variant]}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
