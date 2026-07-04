import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useChatWS } from '../hooks/useChatWS'
import { useSessionStore } from '../store/sessionStore'

/**
 * ChatTransport — owns the single /ws/chat connection for the whole app.
 * Renders nothing. Exposes chat actions on the store so any component
 * (NewSessionDrawer, ChatView, terminal "back to chat" button) can trigger
 * them without re-instantiating useChatWS.
 *
 * This decouples WS lifetime from ChatView mount/unmount (audit P1 #9).
 */
export function ChatTransport() {
  const { logout } = useAuth()
  const getAccessToken = () => useSessionStore.getState().accessToken
  const {
    createConversation,
    switchTo,
    closeConversation,
    sendMessage,
    escalate,
    switchView,
    reconnect,
  } = useChatWS(getAccessToken, logout)

  useEffect(() => {
    useSessionStore.setState({
      chatCreateConversation: createConversation,
      chatSwitchTo: switchTo,
      chatCloseConversation: closeConversation,
      sendChatMessage: sendMessage,
      chatEscalate: escalate,
      chatSwitchView: switchView,
      chatReconnect: reconnect,
    })
    return () => {
      useSessionStore.setState({
        chatCreateConversation: null,
        chatSwitchTo: null,
        chatCloseConversation: null,
        sendChatMessage: null,
        chatEscalate: null,
        chatSwitchView: null,
        chatReconnect: null,
      })
    }
  }, [
    createConversation,
    switchTo,
    closeConversation,
    sendMessage,
    escalate,
    switchView,
    reconnect,
  ])

  return null
}
