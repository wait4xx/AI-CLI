import { EventEmitter } from 'node:events'
import type { ChatMessage, ChatPermissionTier, ChatViewMode, ProviderEvent } from '@ai-cli/shared'
import { pinoLogger } from '../lib/logger.js'
import type { ChatProvider } from './ChatProvider.js'
import { ChatSession } from './ChatSession.js'

export interface ConversationInit {
  conversationId: string
  claudeSessionId: string
  cwd: string
  initialTier?: ChatPermissionTier
}

export interface ConversationState {
  conversationId: string
  claudeSessionId: string
  cwd: string
  viewMode: ChatViewMode
  tier: ChatPermissionTier
  messageLog: ChatMessage[]
}

export class Conversation extends EventEmitter {
  private session: ChatSession | null = null
  readonly state: ConversationState

  constructor(
    private readonly provider: ChatProvider,
    init: ConversationInit,
  ) {
    super()
    this.state = {
      conversationId: init.conversationId,
      claudeSessionId: init.claudeSessionId,
      cwd: init.cwd,
      viewMode: 'chat',
      tier: init.initialTier ?? 'Explore',
      messageLog: [],
    }
  }

  start(): void {
    this.spawnSession(false)
  }

  switchView(viewMode: ChatViewMode): void {
    if (this.state.viewMode === viewMode) return
    this.session?.kill()
    this.session = null
    this.state.viewMode = viewMode
    if (viewMode === 'chat') this.spawnSession(true)
    this.emit('viewChanged', { viewMode, tier: this.state.tier })
  }

  escalate(tier: ChatPermissionTier): void {
    if (!this.provider.availableTiers().includes(tier)) return
    if (this.state.tier === tier) return
    this.session?.kill()
    this.session = null
    this.state.tier = tier
    if (this.state.viewMode === 'chat') this.spawnSession(true)
    this.emit('tierChanged', tier)
  }

  send(text: string): boolean {
    this.state.messageLog.push({ role: 'user', text, ts: Date.now() })
    return this.session?.send(text) ?? false
  }

  destroy(): void {
    this.session?.kill()
    this.session = null
    this.removeAllListeners()
  }

  private spawnSession(resume: boolean): void {
    if (!this.provider.supportsResume()) resume = false
    this.session = new ChatSession(
      this.provider,
      {
        claudeSessionId: this.state.claudeSessionId,
        cwd: this.state.cwd,
        tier: this.state.tier,
        resume,
      },
      (event) => this.onProviderEvent(event),
      (code, message) => this.onCrash(code, message),
    )
    this.session.start()
  }

  private onProviderEvent(event: ProviderEvent): void {
    if (event.type === 'text-delta') {
      const last = this.state.messageLog[this.state.messageLog.length - 1]
      if (last && last.role === 'assistant') last.text += event.text
      else this.state.messageLog.push({ role: 'assistant', text: event.text, ts: Date.now() })
    }
    this.emit('event', event)
  }

  private onCrash(code: number | null, message: string): void {
    pinoLogger.warn({ code, message, id: this.state.conversationId }, 'Conversation crashed')
    this.emit('crashed', { message, resumable: this.provider.supportsResume() })
  }
}
