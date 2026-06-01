import { useMemo } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { isMobile } from '../lib/device'

interface QuickActionsPanelProps {
  onAction: (payload: string) => void
}

const FALLBACK_ACTIONS: Record<
  string,
  Array<{ label: string; payload: string; variant: string }>
> = {
  claude: [
    { label: '✓ Approve', payload: '\r', variant: 'approve' },
    { label: '✗ Deny', payload: 'n\r', variant: 'deny' },
    { label: '⏼ Cancel', payload: '\x03', variant: 'cancel' },
  ],
  aider: [
    { label: '✓ Apply', payload: 'y\r', variant: 'approve' },
    { label: '✗ Reject', payload: 'n\r', variant: 'deny' },
    { label: '⏼ Cancel', payload: '\x03', variant: 'cancel' },
  ],
  shell: [{ label: '⏼ Cancel', payload: '\x03', variant: 'cancel' }],
}

function variantForLabel(label: string): string {
  const l = label.toLowerCase()
  if (
    l.includes('y') ||
    l.includes('approve') ||
    l.includes('apply') ||
    l.includes('yes') ||
    l.includes('allow')
  )
    return 'approve'
  if (
    l.includes('n') ||
    l.includes('deny') ||
    l.includes('reject') ||
    l.includes('no') ||
    l.includes('skip')
  )
    return 'deny'
  return 'cancel'
}

const variantStyles: Record<string, string> = {
  approve: 'bg-green-600 hover:bg-green-500 active:bg-green-700 text-white',
  deny: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white',
  cancel: 'bg-gray-600 hover:bg-gray-500 active:bg-gray-700 text-gray-200',
}

export function QuickActionsPanel({ onAction }: QuickActionsPanelProps) {
  const visible = useSessionStore((s) => s.agentStatus === 'WAITING_APPROVAL')
  const approvalOptions = useSessionStore((s) => s.approvalOptions)
  const activeAdapter = useSessionStore((s) => s.activeAdapter)
  const mobile = useMemo(() => isMobile(), [])

  if (!mobile) return null

  const actions = useMemo(() => {
    if (approvalOptions && approvalOptions.length > 0) {
      return approvalOptions.map((opt) => ({
        label: opt.label,
        payload: opt.payload,
        variant: variantForLabel(opt.label),
      }))
    }
    return FALLBACK_ACTIONS[activeAdapter] ?? FALLBACK_ACTIONS.claude
  }, [approvalOptions, activeAdapter])

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
