import path from 'node:path'
import { randomUUID } from 'node:crypto'
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
import { auditLog } from '../core/audit.js'
import { getConfig } from '../lib/config.js'
import type { ConversationManager } from './ConversationManager.js'

/**
 * ChatGateway — WebSocket handler for `/ws/chat`.
 *
 * Manages chat connection lifecycle: message dispatch, broadcast to
 * subscribers, and RBAC escalation gate (non-admin users cannot escalate
 * to Edit tier).
 */
const CHAT_IDLE_TTL_MS = 30_000

export class ChatGateway {
  private subscribers = new Map<string, Set<WebSocket>>()
  // Pending destruction timers — a conversation with no subscribers is reaped
  // after CHAT_IDLE_TTL_MS to reclaim the headless claude process.
  private reapers = new Map<string, NodeJS.Timeout>()
  // per-(ws,conversation) cleanup fns，detach 与 close 共用
  private detachCleanups = new Map<string, () => void>()

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
    ;(ws as WebSocket & { __id: string }).__id = randomUUID()
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

  /**
   * Constrain CHAT_CREATE.cwd to PROJECT_ROOT (mirrors the fs layer's policy).
   * When FS_ALLOW_ABSOLUTE_PATHS is enabled, any cwd is allowed (bounded only
   * by the server process's OS permissions, same as the fs routes).
   */
  private isCwdAllowed(cwd: string): boolean {
    const config = getConfig()
    if (config.FS_ALLOW_ABSOLUTE_PATHS) return true
    const root = path.resolve(config.PROJECT_ROOT)
    const resolved = path.isAbsolute(cwd) ? path.resolve(cwd) : path.resolve(root, cwd)
    const rel = path.relative(root, resolved)
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
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
        if (msg.cwd && !this.isCwdAllowed(msg.cwd))
          return send({ type: 'CHAT_ERROR', message: 'cwd outside allowed project root' })
        const providerId = msg.providerId ?? 'claude-code'
        const conv = this.mgr.create({
          providerId,
          cwd: msg.cwd,
          claudeSessionId: msg.claudeSessionId,
          ownerId: user.userId,
          initialTier: msg.initialTier,
        })
        this.attach(ws, conv.state.conversationId)
        conv.start()
        auditLog('CHAT_CREATE', user.userId, {
          conversationId: conv.state.conversationId,
          claudeSessionId: msg.claudeSessionId,
          tier: conv.state.tier,
          cwd: msg.cwd,
        })
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
        if (conv.state.ownerId !== user.userId && user.role !== 'admin')
          return send({ type: 'CHAT_ERROR', message: 'not conversation owner' })
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
        if (conv.state.ownerId !== user.userId && user.role !== 'admin')
          return send({ type: 'CHAT_ERROR', message: 'not conversation owner' })
        conv.send(msg.text)
        auditLog('CHAT_SEND', user.userId, { conversationId: msg.conversationId })
        return
      }
      case 'CHAT_SWITCH_VIEW': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        if (conv.state.ownerId !== user.userId && user.role !== 'admin')
          return send({ type: 'CHAT_ERROR', message: 'not conversation owner' })
        conv.switchView(msg.viewMode)
        auditLog('CHAT_SWITCH_VIEW', user.userId, {
          conversationId: msg.conversationId,
          viewMode: msg.viewMode,
        })
        return
      }
      case 'CHAT_ESCALATE': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        if (conv.state.ownerId !== user.userId && user.role !== 'admin')
          return send({ type: 'CHAT_ERROR', message: 'not conversation owner' })
        if (msg.tier === 'Edit' && user.role !== 'admin') {
          return send({ type: 'CHAT_ERROR', message: 'escalation requires admin role' })
        }
        auditLog('CHAT_ESCALATE', user.userId, {
          conversationId: msg.conversationId,
          tier: msg.tier,
        })
        conv.escalate(msg.tier)
        return
      }
      case 'CHAT_DETACH': {
        this.detach(ws, msg.conversationId)
        return
      }
    }
  }

  /**
   * Subscribe a WebSocket to a conversation's events.
   * Registers listeners for 'event', 'viewChanged', 'tierChanged', and
   * 'crashed' on the Conversation, broadcasting to all subscribers.
   * Listeners are cleaned up on ws 'close'. If the ws is already a
   * subscriber, this is a no-op (avoids duplicate listeners/broadcasts).
   */
  private attach(ws: WebSocket, conversationId: string): void {
    let set = this.subscribers.get(conversationId)
    if (!set) {
      set = new Set()
      this.subscribers.set(conversationId, set)
    }
    if (set.has(ws)) return // already attached — avoid duplicate listeners
    set.add(ws)
    this.cancelReaper(conversationId)
    const conv = this.mgr.get(conversationId)!

    const onEvent = (event: ProviderEvent) =>
      this.broadcast(conversationId, { type: 'CHAT_EVENT', conversationId, event })
    const onView = (p: { viewMode: ChatViewMode; tier: ChatPermissionTier }) =>
      this.broadcast(conversationId, { type: 'CHAT_VIEW_CHANGED', conversationId, ...p })
    const onTier = (tier: ChatPermissionTier) =>
      this.broadcast(conversationId, {
        type: 'CHAT_VIEW_CHANGED',
        conversationId,
        viewMode: conv.state.viewMode,
        tier,
      })
    const onCrash = (p: { message: string; resumable: boolean }) => {
      auditLog('CHAT_CRASHED', undefined, { conversationId, ...p })
      this.broadcast(conversationId, { type: 'CHAT_CRASHED', conversationId, ...p })
    }

    conv.on('event', onEvent)
    conv.on('viewChanged', onView)
    conv.on('tierChanged', onTier)
    conv.on('crashed', onCrash)

    const cleanup = () => {
      conv.off('event', onEvent)
      conv.off('viewChanged', onView)
      conv.off('tierChanged', onTier)
      conv.off('crashed', onCrash)
      const remaining = this.subscribers.get(conversationId)
      remaining?.delete(ws)
      this.detachCleanups.delete(key)
      if (remaining && remaining.size === 0) this.scheduleReaper(conversationId)
    }
    const key = `${(ws as WebSocket & { __id: string }).__id}:${conversationId}`
    this.detachCleanups.set(key, cleanup)
    ws.once('close', cleanup)
  }

  /**
   * Remove a WebSocket's subscription to a conversation without closing the WS.
   * Reuses the per-(ws,conversation) cleanup registered in `attach`; if no
   * subscribers remain, the reaper fires on its normal schedule.
   */
  private detach(ws: WebSocket, conversationId: string): void {
    const key = `${(ws as WebSocket & { __id: string }).__id}:${conversationId}`
    const fn = this.detachCleanups.get(key)
    if (fn) fn()
  }

  /**
   * Schedule destruction of a conversation once it has no subscribers. If a
   * client re-attaches (CHAT_RECONNECT) before the timer fires, cancelReaper
   * aborts it. This reclaims the headless claude process instead of leaking it.
   */
  private scheduleReaper(conversationId: string): void {
    if (this.reapers.has(conversationId)) return
    const timer = setTimeout(() => {
      this.reapers.delete(conversationId)
      this.subscribers.delete(conversationId)
      this.mgr.destroy(conversationId)
      pinoLogger.info({ conversationId }, 'Chat conversation reaped (idle, no subscribers)')
    }, CHAT_IDLE_TTL_MS)
    this.reapers.set(conversationId, timer)
  }

  private cancelReaper(conversationId: string): void {
    const timer = this.reapers.get(conversationId)
    if (timer) {
      clearTimeout(timer)
      this.reapers.delete(conversationId)
    }
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
