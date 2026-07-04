import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ChatClientMessage,
  type ChatServerMessage,
  type ChatPermissionTier,
  type ChatViewMode,
  WS_CLOSE_CODE,
} from '@ai-cli/shared'
import { useSessionStore } from '../store/sessionStore'

const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  (() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${window.location.host}`
  })()

const CHAT_MSG_TYPES = new Set([
  'CHAT_AUTH_OK',
  'CHAT_PONG',
  'CHAT_CREATED',
  'CHAT_EVENT',
  'CHAT_VIEW_CHANGED',
  'CHAT_CRASHED',
  'CHAT_HISTORY',
  'CHAT_ERROR',
])

function isValidChatMsg(data: unknown): data is { type: string; [k: string]: unknown } {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj.type === 'string' && CHAT_MSG_TYPES.has(obj.type)
}

const MAX_MESSAGE_BYTES = 256 * 1024
const INITIAL_RECONNECT_DELAY = 1_000
const MAX_RECONNECT_DELAY = 30_000

export interface UseChatWS {
  createConversation: (cwd: string) => void
  switchTo: (conversationId: string) => void
  closeConversation: (conversationId: string) => void
  sendMessage: (text: string) => void
  escalate: (tier: ChatPermissionTier) => void
  switchView: (mode: ChatViewMode) => void
  reconnect: () => void
  isConnected: boolean
}

/**
 * useChatWS — single app-lifetime WebSocket for `/ws/chat`, multiplexed across
 * conversations. The socket is opened once on mount and closed on unmount; all
 * per-conversation actions (create / switch / close / send / escalate / switch
 * view) are dispatched through the same wire.
 *
 * On (re)connect, every `subscribedConversationIds` is re-subscribed (active
 * first) so the server replays history for all live conversations.
 */
export function useChatWS(
  getAccessToken: () => string | null,
  onAuthFailure: () => void,
): UseChatWS {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const [isConnected, setIsConnected] = useState(false)
  const store = useSessionStore

  function closeSocket() {
    const ws = wsRef.current
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close()
      wsRef.current = null
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }

  function send(msg: ChatClientMessage) {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  function handleMessage(data: ChatServerMessage) {
    if (!isValidChatMsg(data)) return
    switch (data.type) {
      case 'CHAT_CREATED': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_CREATED' }>
        store.getState().setConversationId(m.claudeSessionId, m.conversationId)
        store.getState().setConversationViewMode(m.conversationId, m.viewMode)
        store.getState().setConversationTier(m.conversationId, m.tier)
        store.getState().markSubscribed(m.conversationId)
        store.getState().setConversationStatus(m.conversationId, 'active')
        setIsConnected(true)
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        clearReconnectTimer()
        break
      }
      case 'CHAT_HISTORY': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_HISTORY' }>
        store
          .getState()
          .applyChatAction(m.conversationId, { type: 'load-history', messages: m.messages })
        store.getState().markSubscribed(m.conversationId)
        store.getState().setConversationStatus(m.conversationId, 'active')
        setIsConnected(true)
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        clearReconnectTimer()
        break
      }
      case 'CHAT_EVENT': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_EVENT' }>
        store.getState().applyChatAction(m.conversationId, { type: 'event', event: m.event })
        break
      }
      case 'CHAT_VIEW_CHANGED': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_VIEW_CHANGED' }>
        store.getState().setConversationViewMode(m.conversationId, m.viewMode)
        store.getState().setConversationTier(m.conversationId, m.tier)
        break
      }
      case 'CHAT_CRASHED': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_CRASHED' }>
        store.getState().setConversationStatus(m.conversationId, 'crashed')
        store.getState().applyChatAction(m.conversationId, {
          type: 'crashed',
          message: m.message,
          resumable: m.resumable,
        })
        break
      }
      case 'CHAT_ERROR':
        console.error('[Chat WS] error:', (data as { message: string }).message)
        break
      case 'CHAT_PONG':
      case 'CHAT_AUTH_OK':
        break
    }
  }

  const connectInternal = useCallback(() => {
    const token = getAccessToken()
    if (!token) {
      onAuthFailure()
      return
    }
    store.getState().setChatConnected('CONNECTING')
    const ws = new WebSocket(`${WS_BASE}/ws/chat?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      store.getState().setChatConnected('CONNECTED')
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
      clearReconnectTimer()
      // Re-subscribe all conversations on (re)connect; active first.
      const { subscribedConversationIds, activeConversationId } = store.getState()
      const ordered = activeConversationId
        ? [
            activeConversationId,
            ...subscribedConversationIds.filter((x) => x !== activeConversationId),
          ]
        : subscribedConversationIds
      for (const cid of ordered) send({ type: 'CHAT_RECONNECT', conversationId: cid })
    }

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        handleMessage(JSON.parse(event.data) as ChatServerMessage)
      } catch {
        /* malformed */
      }
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      store.getState().setChatConnected('DISCONNECTED')
      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) onAuthFailure()
      else scheduleReconnect()
    }
    ws.onerror = () => {}
  }, [getAccessToken, onAuthFailure, store])

  function scheduleReconnect() {
    if (reconnectTimerRef.current) return
    const delay = reconnectDelayRef.current
    const jittered = delay * (0.5 + Math.random() * 0.5)
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY)
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      closeSocket()
      connectInternal()
    }, jittered)
  }

  // Open once on app mount; close on unmount.
  useEffect(() => {
    connectInternal()
    return () => {
      clearReconnectTimer()
      closeSocket()
    }
  }, [connectInternal])

  const ensureSubscribed = useCallback(
    (conversationId: string) => {
      if (!conversationId) return
      const { subscribedConversationIds } = store.getState()
      if (subscribedConversationIds.includes(conversationId)) return
      send({ type: 'CHAT_RECONNECT', conversationId })
    },
    [store],
  )

  const createConversation = useCallback(
    (cwd: string) => {
      const claudeSessionId = store.getState().createConversation(cwd)
      send({
        type: 'CHAT_CREATE',
        cwd,
        claudeSessionId,
        providerId: 'claude-code',
        initialTier: 'Explore',
      })
    },
    [store],
  )

  const switchTo = useCallback(
    (conversationId: string) => {
      ensureSubscribed(conversationId)
      store.getState().switchTo(conversationId)
    },
    [ensureSubscribed, store],
  )

  const closeConversation = useCallback(
    (conversationId: string) => {
      send({ type: 'CHAT_DETACH', conversationId })
      store.getState().closeConversation(conversationId)
    },
    [store],
  )

  const sendMessage = useCallback(
    (text: string) => {
      const bytes = new TextEncoder().encode(text).length
      if (bytes > MAX_MESSAGE_BYTES) {
        console.warn(`[Chat WS] message exceeds ${MAX_MESSAGE_BYTES} bytes (${bytes}), not sent`)
        return
      }
      const { activeConversationId, conversations } = store.getState()
      const conv = conversations.find((c) => c.conversationId === activeConversationId)
      if (!conv?.conversationId) return
      store.getState().applyChatAction(conv.conversationId, { type: 'user-message', text })
      send({ type: 'CHAT_SEND', conversationId: conv.conversationId, text })
    },
    [store],
  )

  const escalate = useCallback((tier: ChatPermissionTier) => {
    const id = store.getState().activeConversationId
    if (id) send({ type: 'CHAT_ESCALATE', conversationId: id, tier })
  }, [])

  const switchView = useCallback(
    (mode: ChatViewMode) => {
      const id = store.getState().activeConversationId
      if (id) {
        send({ type: 'CHAT_SWITCH_VIEW', conversationId: id, viewMode: mode })
        store.getState().setConversationViewMode(id, mode)
      }
    },
    [store],
  )

  const reconnect = useCallback(() => {
    clearReconnectTimer()
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
    closeSocket()
    connectInternal()
  }, [connectInternal])

  return {
    createConversation,
    switchTo,
    closeConversation,
    sendMessage,
    escalate,
    switchView,
    reconnect,
    isConnected,
  }
}
