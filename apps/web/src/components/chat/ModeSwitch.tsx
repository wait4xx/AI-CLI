import { Terminal } from 'lucide-react'
import type { ChatPermissionTier, ChatViewMode } from '@ai-cli/shared'
import { useUiTheme } from '../../hooks/useUiTheme'

interface Props {
  tier: ChatPermissionTier
  role: 'admin' | 'user'
  onEscalate: (tier: ChatPermissionTier) => void
  onSwitchView: (mode: ChatViewMode) => void
}

export function ModeSwitch({ tier, role, onEscalate, onSwitchView }: Props) {
  const ui = useUiTheme()
  const isAdmin = role === 'admin'

  const tierButton = (value: ChatPermissionTier, label: string) => {
    const active = tier === value
    const disabled = value === 'Edit' && !isAdmin
    return (
      <button
        key={value}
        onClick={() => !disabled && onEscalate(value)}
        disabled={disabled}
        title={disabled ? '需要管理员权限' : undefined}
        className={`flex-1 rounded px-2 py-1 text-xs transition-colors ${
          active
            ? 'border border-blue-500/50 bg-blue-500/20 text-blue-400'
            : `${ui.dark ? 'bg-white/5' : 'bg-black/5'} border ${ui.border} ${ui.text}`
        } ${disabled ? 'cursor-not-allowed opacity-40' : ui.hover}`}
      >
        {label}
      </button>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 border-b ${ui.border} px-2 py-1.5`}>
      <div className="flex flex-1 gap-1">
        {tierButton('Explore', '探索')}
        {tierButton('Edit', '编辑')}
      </div>
      <button
        onClick={() => onSwitchView('terminal')}
        title="切换到终端视图"
        aria-label="切换到终端视图"
        className={`shrink-0 rounded p-1.5 ${ui.hover} ${ui.text} transition-colors`}
      >
        <Terminal className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
