import { randomUUID } from 'node:crypto'
import type { ChatPermissionTier } from '@ai-cli/shared'
import { Conversation } from './Conversation.js'
import type { ChatProvider } from './ChatProvider.js'

export interface CreateConversationOpts {
  providerId: string
  cwd: string
  claudeSessionId: string
  initialTier?: ChatPermissionTier
}

export class ConversationManager {
  private providers = new Map<string, ChatProvider>()
  private conversations = new Map<string, Conversation>()

  registerProvider(p: ChatProvider): void {
    this.providers.set(p.id, p)
  }

  getProvider(id: string): ChatProvider | undefined {
    return this.providers.get(id)
  }

  create(opts: CreateConversationOpts): Conversation {
    const provider = this.providers.get(opts.providerId)
    if (!provider) throw new Error(`unknown provider: ${opts.providerId}`)
    const conversationId = randomUUID()
    const conv = new Conversation(provider, {
      conversationId,
      claudeSessionId: opts.claudeSessionId,
      cwd: opts.cwd,
      initialTier: opts.initialTier,
    })
    this.conversations.set(conversationId, conv)
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
    }
  }

  destroyAll(): void {
    for (const id of this.conversations.keys()) this.destroy(id)
  }
}
