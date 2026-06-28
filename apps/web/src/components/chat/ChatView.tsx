import { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useChatWS } from '../../hooks/useChatWS'
import { useSessionStore } from '../../store/sessionStore'
import { useUiTheme } from '../../hooks/useUiTheme'
import { MessageBubble } from './MessageBubble'
import { ToolCallCard } from './ToolCallCard'
import { ChatInput } from './ChatInput'
import { ModeSwitch } from './ModeSwitch'

export function ChatView() {
  const ui = useUiTheme()
  const { logout } = useAuth()
  const conversation = useSessionStore((s) => s.conversation)
  const chat = useSessionStore((s) => s.chat)
  const role = useSessionStore((s) => s.currentUser?.role ?? 'user')

  const getAccessToken = useCallback(() => useSessionStore.getState().accessToken, [])
  const { connect, disconnect, sendMessage, escalate, switchView, reconnect } = useChatWS(
    getAccessToken,
    logout,
  )

  // Expose chat WS actions on the store for external triggers (e.g. the
  // "back to chat" affordance in the terminal view).
  useEffect(() => {
    useSessionStore.setState({
      sendChatMessage: sendMessage,
      chatEscalate: escalate,
      chatSwitchView: switchView,
      chatReconnect: reconnect,
    })
    return () => {
      useSessionStore.setState({
        sendChatMessage: null,
        chatEscalate: null,
        chatSwitchView: null,
        chatReconnect: null,
      })
    }
  }, [sendMessage, escalate, switchView, reconnect])

  const claudeSessionId = conversation?.claudeSessionId
  // Connect once per conversation. cwd/conversationId are read fresh at run-time
  // (not as deps) so a mid-conversation id/view change never re-triggers a connect.
  useEffect(() => {
    if (!claudeSessionId) return
    const c = useSessionStore.getState().conversation
    connect(claudeSessionId, c?.cwd ?? '', c?.conversationId ?? null)
    return () => disconnect()
  }, [claudeSessionId])

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    el?.scrollTo?.({ top: el.scrollHeight })
  }, [chat.turns])

  if (!conversation) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center text-sm ${ui.textDim}`}>
        No active conversation
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col" data-testid="chat-view">
      <ModeSwitch
        tier={conversation.tier}
        role={role}
        onEscalate={escalate}
        onSwitchView={switchView}
      />
      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-2 ${ui.panel}`}>
        {chat.turns.map((t) => (
          <div key={t.id}>
            {t.error ? (
              <MessageBubble role="assistant" text="" error={t.error} />
            ) : (
              <>
                {(t.text || t.role === 'user') && <MessageBubble role={t.role} text={t.text} />}
                {t.toolCalls.map((c) => (
                  <ToolCallCard key={c.callId} call={c} />
                ))}
              </>
            )}
          </div>
        ))}
        {(chat.status === 'working' || chat.status === 'thinking') && (
          <div className="flex items-center gap-1.5 px-1 py-1 text-xs text-gray-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            {chat.status === 'thinking' ? '思考中…' : '工作中…'}
          </div>
        )}
        {chat.crashed && (
          <div
            className="m-2 rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-300"
            data-testid="crash-banner"
          >
            <p>{chat.crashed.message}</p>
            {chat.crashed.resumable && (
              <button
                onClick={reconnect}
                className="mt-1 rounded bg-red-500/30 px-2 py-0.5 hover:bg-red-500/50"
              >
                重新连接
              </button>
            )}
          </div>
        )}
      </div>
      <ChatInput onSend={sendMessage} />
    </div>
  )
}
