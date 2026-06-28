import { WebSocket } from 'ws'
import type {
  ChatClientMessage,
  ChatPermissionTier,
  ChatServerMessage,
  ChatViewMode,
  JwtPayload,
  ProviderEvent,
} from '@ai-cli/shared'
import { pinoLogger } from '../lib/logger.js'
import type { ConversationManager } from './ConversationManager.js'

/**
 * ChatGateway — WebSocket handler for `/ws/chat`.
 *
 * Manages chat connection lifecycle: message dispatch, broadcast to
 * subscribers, and RBAC escalation gate (non-admin users cannot escalate
 * to Edit tier).
 */
export class ChatGateway {
  private subscribers = new Map<string, Set<WebSocket>>()

  constructor(
    private readonly mgr: ConversationManager,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
  ) {}

  /**
   * Handle a new chat WebSocket connection.
   * Auth is already verified at the HTTP upgrade level (query-param token).
   *
   * @param ws - The incoming WebSocket connection
   * @param user - The authenticated user (verified via query-param JWT)
   */
  handleChatConnection(ws: WebSocket, user: JwtPayload): void {
    pinoLogger.info({ userId: user.userId }, 'Chat WS connected')

    const send = (m: ChatServerMessage) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
    }

    ws.on('message', (data: Buffer) => {
      let msg: ChatClientMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        send({ type: 'CHAT_ERROR', message: 'invalid JSON' })
        return
      }
      this.dispatch(ws, user, msg, send).catch((err) => {
        pinoLogger.error({ err }, 'ChatGateway dispatch error')
        send({ type: 'CHAT_ERROR', message: 'internal error' })
      })
    })
  }

  private async dispatch(
    ws: WebSocket,
    user: JwtPayload,
    msg: ChatClientMessage,
    send: (m: ChatServerMessage) => void,
  ): Promise<void> {
    switch (msg.type) {
      case 'CHAT_PING':
        send({ type: 'CHAT_PONG' })
        return
      case 'CHAT_CREATE': {
        const providerId = msg.providerId ?? 'claude-code'
        const conv = this.mgr.create({
          providerId,
          cwd: msg.cwd,
          claudeSessionId: msg.claudeSessionId,
          initialTier: msg.initialTier,
        })
        this.attach(ws, conv.state.conversationId)
        conv.start()
        send({
          type: 'CHAT_CREATED',
          conversationId: conv.state.conversationId,
          claudeSessionId: conv.state.claudeSessionId,
          tier: conv.state.tier,
          viewMode: conv.state.viewMode,
        })
        return
      }
      case 'CHAT_ATTACH':
      case 'CHAT_RECONNECT': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        this.attach(ws, conv.state.conversationId)
        send({
          type: 'CHAT_HISTORY',
          conversationId: conv.state.conversationId,
          messages: conv.state.messageLog,
        })
        return
      }
      case 'CHAT_SEND': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        conv.send(msg.text)
        return
      }
      case 'CHAT_SWITCH_VIEW': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        conv.switchView(msg.viewMode)
        return
      }
      case 'CHAT_ESCALATE': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        if (msg.tier === 'Edit' && user.role !== 'admin') {
          return send({ type: 'CHAT_ERROR', message: 'escalation requires admin role' })
        }
        conv.escalate(msg.tier)
        return
      }
    }
  }

  /**
   * Subscribe a WebSocket to a conversation's events.
   * Registers listeners for 'event', 'viewChanged', and 'crashed' on the
   * Conversation, broadcasting to all subscribers. Listeners are cleaned
   * up on ws 'close'.
   */
  private attach(ws: WebSocket, conversationId: string): void {
    let set = this.subscribers.get(conversationId)
    if (!set) {
      set = new Set()
      this.subscribers.set(conversationId, set)
    }
    set.add(ws)
    const conv = this.mgr.get(conversationId)!

    const onEvent = (event: ProviderEvent) =>
      this.broadcast(conversationId, { type: 'CHAT_EVENT', conversationId, event })
    const onView = (p: { viewMode: ChatViewMode; tier: ChatPermissionTier }) =>
      this.broadcast(conversationId, { type: 'CHAT_VIEW_CHANGED', conversationId, ...p })
    const onCrash = (p: { message: string; resumable: boolean }) =>
      this.broadcast(conversationId, { type: 'CHAT_CRASHED', conversationId, ...p })

    conv.on('event', onEvent)
    conv.on('viewChanged', onView)
    conv.on('crashed', onCrash)

    ws.once('close', () => {
      conv.off('event', onEvent)
      conv.off('viewChanged', onView)
      conv.off('crashed', onCrash)
      this.subscribers.get(conversationId)?.delete(ws)
    })
  }

  /**
   * Broadcast a message to all WebSocket subscribers of a conversation.
   */
  private broadcast(conversationId: string, m: ChatServerMessage): void {
    const set = this.subscribers.get(conversationId)
    if (!set) return
    const raw = JSON.stringify(m)
    for (const ws of set) if (ws.readyState === WebSocket.OPEN) ws.send(raw)
  }
}
