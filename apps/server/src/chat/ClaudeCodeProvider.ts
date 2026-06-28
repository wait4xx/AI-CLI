import type { Writable } from 'node:stream'
import type { ChatPermissionTier, ProviderEvent } from '@ai-cli/shared'
import type { ChatProvider, SpawnOpts } from './ChatProvider.js'

const TIER_FLAG: Record<ChatPermissionTier, string> = {
  Explore: 'plan',
  Edit: 'acceptEdits',
}

function summarizeInput(input: unknown): string {
  if (input == null) return ''
  try {
    const s = typeof input === 'string' ? input : JSON.stringify(input)
    return s.length > 120 ? s.slice(0, 117) + '...' : s
  } catch {
    return ''
  }
}

function summarizeResult(content: unknown): string {
  let text: string
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) {
    text = content
      .map((c) => (typeof c === 'string' ? c : ((c as { text?: string })?.text ?? '')))
      .join('')
  } else text = ''
  return text.length > 200 ? text.slice(0, 197) + '...' : text
}

export class ClaudeCodeProvider implements ChatProvider {
  readonly id = 'claude-code'

  spawnArgs(opts: SpawnOpts): string[] {
    const args = [
      '-p',
      '--session-id',
      opts.claudeSessionId,
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--permission-mode',
      TIER_FLAG[opts.tier],
    ]
    if (opts.model) args.push('--model', opts.model)
    if (opts.resume) args.push('--resume', opts.claudeSessionId)
    return args
  }

  sendMessage(stdin: Writable, text: string): void {
    const envelope = {
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text }] },
    }
    stdin.write(JSON.stringify(envelope) + '\n')
  }

  parseStreamLine(line: string): ProviderEvent[] {
    let ev: Record<string, unknown>
    try {
      ev = JSON.parse(line)
    } catch {
      return []
    }
    const type = ev.type as string | undefined
    const events: ProviderEvent[] = []

    if (type === 'system') {
      if (ev.subtype === 'thinking_tokens') events.push({ type: 'status', state: 'working' })
      return events
    }
    if (type === 'result') {
      events.push({ type: 'done' })
      return events
    }
    if (type !== 'assistant' && type !== 'user') return events

    const content = (ev.message as { content?: unknown[] } | undefined)?.content
    if (!Array.isArray(content)) return events

    for (const block of content) {
      const b = block as Record<string, unknown>
      const kind = b.type as string
      // `user`-typed output lines only carry tool_result (tool outputs fed back
      // to the model). Skip text/tool_use there so a user's own message is never
      // re-emitted as an assistant text-delta — keeping ProviderEvent role-free
      // at the source instead of every client having to suppress echoes.
      if (kind === 'text' && type === 'assistant' && typeof b.text === 'string') {
        events.push({ type: 'text-delta', text: b.text })
      } else if (kind === 'tool_use' && type === 'assistant') {
        events.push({
          type: 'tool-call-start',
          callId: String(b.id ?? ''),
          toolName: String(b.name ?? 'tool'),
          inputSummary: summarizeInput(b.input),
        })
      } else if (kind === 'tool_result') {
        events.push({
          type: 'tool-result',
          callId: String(b.tool_use_id ?? ''),
          status: b.is_error ? 'error' : 'success',
          outputSnippet: summarizeResult(b.content),
        })
      }
    }
    return events
  }

  availableTiers(): ChatPermissionTier[] {
    return ['Explore', 'Edit']
  }

  supportsResume(): boolean {
    return true
  }
}
