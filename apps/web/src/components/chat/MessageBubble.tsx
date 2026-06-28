import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useUiTheme } from '../../hooks/useUiTheme'

interface Props {
  role: 'user' | 'assistant'
  text: string
  error?: string
}

export function MessageBubble({ role, text, error }: Props) {
  const ui = useUiTheme()

  if (role === 'assistant' && error) {
    return (
      <div className="flex justify-start mb-3" data-testid="msg-error">
        <div className="max-w-[85%] rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300 break-words">
          {error}
        </div>
      </div>
    )
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end mb-3" data-testid="msg-user">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-blue-600 px-3 py-2 text-sm text-white">
          {text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-3" data-testid="msg-assistant">
      <div
        className={`max-w-[85%] rounded-lg ${ui.surface} border ${ui.border} px-3 py-2 text-sm ${ui.text}
          [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0
          [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_code]:bg-white/10
          [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:p-2
          [&_pre>code]:bg-transparent [&_pre>code]:p-0
          [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
          [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold
          [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold
          [&_a]:text-blue-400 [&_a]:underline
          [&_strong]:font-semibold`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    </div>
  )
}
