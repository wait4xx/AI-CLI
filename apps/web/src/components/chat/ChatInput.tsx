import { useState, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { useUiTheme } from '../../hooks/useUiTheme'

const MAX_BYTES = 256 * 1024

interface Props {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled }: Props) {
  const ui = useUiTheme()
  const [text, setText] = useState('')

  const bytes = new TextEncoder().encode(text).length
  const overLimit = bytes > MAX_BYTES
  const canSend = text.trim().length > 0 && !disabled && !overLimit

  const submit = () => {
    if (!canSend) return
    onSend(text)
    setText('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className={`border-t ${ui.border} p-2`}>
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="发消息… (Enter 发送, Shift+Enter 换行)"
          className={`flex-1 resize-none rounded-lg ${ui.dark ? 'bg-white/5' : 'bg-black/5'} border ${ui.border} px-2 py-1.5 text-sm ${ui.text} outline-none`}
        />
        <button
          onClick={submit}
          disabled={!canSend}
          aria-label="发送"
          className={`shrink-0 rounded-lg p-2 transition-colors ${canSend ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      {overLimit && <p className="mt-1 text-[10px] text-red-400">消息超过 256KB 限制,无法发送</p>}
    </div>
  )
}
