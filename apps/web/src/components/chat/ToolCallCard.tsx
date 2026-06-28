import { useState } from 'react'
import { Wrench, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { ToolCallView } from '../../lib/chatReducer'
import { useUiTheme } from '../../hooks/useUiTheme'

export function ToolCallCard({ call }: { call: ToolCallView }) {
  const ui = useUiTheme()
  const [open, setOpen] = useState(false)

  const statusColor =
    call.status === 'success'
      ? 'text-green-400'
      : call.status === 'error'
        ? 'text-red-400'
        : 'text-blue-400'
  const StatusIcon =
    call.status === 'success' ? CheckCircle2 : call.status === 'error' ? XCircle : Loader2

  return (
    <div
      className={`mt-1.5 rounded-md border ${ui.border} ${ui.dark ? 'bg-white/5' : 'bg-black/5'} text-xs`}
      data-testid="tool-card"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        <Wrench className={`w-3 h-3 shrink-0 ${statusColor}`} />
        <span className={`font-medium ${ui.text}`}>{call.toolName}</span>
        {call.inputSummary && (
          <span className={`truncate ${ui.textDim}`}>· {call.inputSummary}</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {call.status === 'running' && <span className={ui.textDim}>运行中…</span>}
          <StatusIcon
            className={`w-3 h-3 shrink-0 ${statusColor} ${call.status === 'running' ? 'animate-spin' : ''}`}
          />
        </span>
      </button>
      {open && call.outputSnippet && (
        <pre
          className={`mx-2 mb-1.5 max-h-40 overflow-auto rounded p-2 ${ui.dark ? 'bg-black/30' : 'bg-black/5'} ${ui.textDim}`}
        >
          {call.outputSnippet}
        </pre>
      )}
    </div>
  )
}
