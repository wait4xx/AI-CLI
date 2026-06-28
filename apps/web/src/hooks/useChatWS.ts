import { useCallback, useRef, useState } from 'react'
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

function isValidChatMsg(data: unknown): data is { type: string; [key: string]: unknown } {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj.type === 'string' && CHAT_MSG_TYPES.has(obj.type)
}

const MAX_MESSAGE_BYTES = 256 * 1024

interface ConnectParams {
  claudeSessionId: string
  cwd: string
  existingConversationId: string | null
}

export interface UseChatWS {
  connect: (claudeSessionId: string, cwd: string, existingConversationId?: string | null) => void
  disconnect: () => void
  sendMessage: (text: string) => void
  escalate: (tier: ChatPermissionTier) => void
  switchView: (mode: ChatViewMode) => void
  reconnect: () => void
  isConnected: boolean
}

/**
 * useChatWS — single-channel WebSocket lifecycle for `/ws/chat`.
 *
 * Auth is done at the HTTP upgrade via the `?token=` query param (same as the
 * terminal channels). There is no CHAT_AUTH handshake: on open we send
 * CHAT_CREATE (new) or CHAT_RECONNECT (resume) directly.
 */
export function useChatWS(
  getAccessToken: () => string | null,
  onAuthFailure: () => void,
): UseChatWS {
  const wsRef = useRef<WebSocket | null>(null)
  const paramsRef = useRef<ConnectParams | null>(null)
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

  function send(msg: ChatClientMessage) {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  function handleMessage(data: ChatServerMessage) {
    if (!isValidChatMsg(data)) return
    switch (data.type) {
      case 'CHAT_CREATED':
        store.getState().setConversationId(data.conversationId)
        store.getState().setChatViewMode(data.viewMode)
        store.getState().setChatTier(data.tier)
        store.getState().setChatConnected('CONNECTED')
        setIsConnected(true)
        break
      case 'CHAT_HISTORY':
        store.getState().applyChatAction({ type: 'load-history', messages: data.messages })
        store.getState().setChatConnected('CONNECTED')
        setIsConnected(true)
        break
      case 'CHAT_EVENT':
        store.getState().applyChatAction({ type: 'event', event: data.event })
        break
      case 'CHAT_VIEW_CHANGED':
        store.getState().setChatViewMode(data.viewMode)
        store.getState().setChatTier(data.tier)
        break
      case 'CHAT_CRASHED':
        store.getState().applyChatAction({
          type: 'crashed',
          message: data.message,
          resumable: data.resumable,
        })
        break
      case 'CHAT_ERROR':
        console.error('[Chat WS] error:', data.message)
        break
      case 'CHAT_PONG':
      case 'CHAT_AUTH_OK':
        break
    }
  }

  const connectInternal = useCallback(
    (claudeSessionId: string, cwd: string, existingConversationId: string | null) => {
      const token = getAccessToken()
      if (!token) {
        onAuthFailure()
        return
      }
      paramsRef.current = { claudeSessionId, cwd, existingConversationId }
      store.getState().setChatConnected('CONNECTING')

      const ws = new WebSocket(`${WS_BASE}/ws/chat?token=${encodeURIComponent(token)}`)
      wsRef.current = ws

      ws.onopen = () => {
        if (existingConversationId) {
          send({ type: 'CHAT_RECONNECT', conversationId: existingConversationId })
        } else {
          send({
            type: 'CHAT_CREATE',
            cwd,
            claudeSessionId,
            providerId: 'claude-code',
            initialTier: 'Explore',
          })
        }
      }

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        try {
          handleMessage(JSON.parse(event.data) as ChatServerMessage)
        } catch {
          /* ignore malformed JSON */
        }
      }

      ws.onclose = (event) => {
        setIsConnected(false)
        store.getState().setChatConnected('DISCONNECTED')
        if (event.code === WS_CLOSE_CODE.AUTH_FAILED) onAuthFailure()
      }

      ws.onerror = () => {}
    },
    [getAccessToken, onAuthFailure],
  )

  const connect = useCallback(
    (claudeSessionId: string, cwd: string, existingConversationId?: string | null) => {
      closeSocket()
      connectInternal(claudeSessionId, cwd, existingConversationId ?? null)
    },
    [connectInternal],
  )

  const disconnect = useCallback(() => {
    paramsRef.current = null
    closeSocket()
    store.getState().setChatConnected('DISCONNECTED')
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback((text: string) => {
    const bytes = new TextEncoder().encode(text).length
    if (bytes > MAX_MESSAGE_BYTES) {
      console.warn(`[Chat WS] message exceeds ${MAX_MESSAGE_BYTES} bytes (${bytes}), not sent`)
      return
    }
    // Optimistic local display; the server does not echo user text.
    store.getState().applyChatAction({ type: 'user-message', text })
    const convId = store.getState().conversation?.conversationId
    if (!convId) {
      console.warn('[Chat WS] no conversationId yet; message shown locally only')
      return
    }
    send({ type: 'CHAT_SEND', conversationId: convId, text })
  }, [])

  const escalate = useCallback((tier: ChatPermissionTier) => {
    const convId = store.getState().conversation?.conversationId
    if (!convId) return
    send({ type: 'CHAT_ESCALATE', conversationId: convId, tier })
  }, [])

  const switchView = useCallback((mode: ChatViewMode) => {
    const convId = store.getState().conversation?.conversationId
    if (!convId) return
    send({ type: 'CHAT_SWITCH_VIEW', conversationId: convId, viewMode: mode })
  }, [])

  const reconnect = useCallback(() => {
    const p = paramsRef.current
    if (!p) return
    closeSocket()
    connectInternal(p.claudeSessionId, p.cwd, p.existingConversationId)
  }, [connectInternal])

  return { connect, disconnect, sendMessage, escalate, switchView, reconnect, isConnected }
}
