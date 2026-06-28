import type { Writable } from 'node:stream'
import type { ChatPermissionTier, ProviderEvent } from '@ai-cli/shared'
import type { ChatProvider, SpawnOpts } from './ChatProvider.js'

const TIER_FLAG: Record<ChatPermissionTier, string> = {
  Explore: 'plan',
  Edit: 'acceptEdits',
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

  parseStreamLine(_line: string): ProviderEvent[] {
    return [] // Task 4 implements this
  }

  availableTiers(): ChatPermissionTier[] {
    return ['Explore', 'Edit']
  }

  supportsResume(): boolean {
    return true
  }
}
