import { randomUUID } from 'node:crypto'
import type { ChatPermissionTier } from '@ai-cli/shared'
import { Conversation } from './Conversation.js'
import type { ChatProvider } from './ChatProvider.js'
import { getConfig } from '../lib/config.js'

export interface CreateConversationOpts {
  providerId: string
  cwd: string
  claudeSessionId: string
  initialTier?: ChatPermissionTier
}

export class ConversationManager {
  private providers = new Map<string, ChatProvider>()
  private conversations = new Map<string, Conversation>()
  // Secondary index so create() is idempotent per claudeSessionId. Without this,
  // a duplicate CHAT_CREATE (e.g. React StrictMode mount→cleanup→remount, or a
  // reconnect) would spawn a second `claude --session-id <id>`, which claude
  // rejects with "Session ID … is already in use" → crash.
  private byClaudeSessionId = new Map<string, Conversation>()

  registerProvider(p: ChatProvider): void {
    this.providers.set(p.id, p)
  }

  getProvider(id: string): ChatProvider | undefined {
    return this.providers.get(id)
  }

  create(opts: CreateConversationOpts): Conversation {
    const provider = this.providers.get(opts.providerId)
    if (!provider) throw new Error(`unknown provider: ${opts.providerId}`)

    // Reuse an existing conversation for this claudeSessionId (idempotent).
    const existing = this.byClaudeSessionId.get(opts.claudeSessionId)
    if (existing) return existing

    const conversationId = randomUUID()
    const conv = new Conversation(provider, {
      conversationId,
      claudeSessionId: opts.claudeSessionId,
      // Fall back to PROJECT_ROOT when the client omits a working directory so
      // headless claude always launches somewhere sensible.
      cwd: opts.cwd || getConfig().PROJECT_ROOT,
      initialTier: opts.initialTier,
    })
    this.conversations.set(conversationId, conv)
    this.byClaudeSessionId.set(opts.claudeSessionId, conv)
    return conv
  }

  get(id: string): Conversation | undefined {
    return this.conversations.get(id)
  }

  size(): number {
    return this.conversations.size
  }

  destroy(id: string): void {
    const c = this.conversations.get(id)
    if (c) {
      c.destroy()
      this.conversations.delete(id)
      this.byClaudeSessionId.delete(c.state.claudeSessionId)
    }
  }

  destroyAll(): void {
    for (const id of this.conversations.keys()) this.destroy(id)
  }
}
