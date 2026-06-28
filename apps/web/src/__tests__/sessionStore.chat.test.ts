import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../store/sessionStore'
import { initialChatState } from '../lib/chatReducer'

describe('sessionStore chat extensions', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it('startConversation sets default Explore/chat and resets chat state', () => {
    useSessionStore.getState().startConversation('claude-123', '/repo')
    const { conversation, chat } = useSessionStore.getState()
    expect(conversation).toEqual({
      conversationId: null,
      claudeSessionId: 'claude-123',
      cwd: '/repo',
      viewMode: 'chat',
      tier: 'Explore',
    })
    expect(chat).toEqual(initialChatState)
  })

  it('setConversationId updates the conversation id', () => {
    useSessionStore.getState().startConversation('claude-123', '/repo')
    useSessionStore.getState().setConversationId('conv-1')
    expect(useSessionStore.getState().conversation?.conversationId).toBe('conv-1')
  })

  it('setChatViewMode and setChatTier update conversation', () => {
    useSessionStore.getState().startConversation('claude-123', '/repo')
    useSessionStore.getState().setChatViewMode('terminal')
    useSessionStore.getState().setChatTier('Edit')
    const c = useSessionStore.getState().conversation
    expect(c?.viewMode).toBe('terminal')
    expect(c?.tier).toBe('Edit')
  })

  it('setChatConnected tracks phase + boolean', () => {
    useSessionStore.getState().setChatConnected('CONNECTING')
    expect(useSessionStore.getState().chatConnectionPhase).toBe('CONNECTING')
    expect(useSessionStore.getState().chatConnected).toBe(false)
    useSessionStore.getState().setChatConnected('CONNECTED')
    expect(useSessionStore.getState().chatConnected).toBe(true)
  })

  it('applyChatAction drives the chat reducer (user-message then event)', () => {
    useSessionStore.getState().startConversation('claude-123', '/repo')
    useSessionStore.getState().applyChatAction({ type: 'user-message', text: 'hi' })
    useSessionStore
      .getState()
      .applyChatAction({ type: 'event', event: { type: 'text-delta', text: 'Hello!' } })
    const turns = useSessionStore.getState().chat.turns
    expect(turns).toHaveLength(2)
    expect(turns[0].role).toBe('user')
    expect(turns[1].role).toBe('assistant')
    expect(turns[1].text).toBe('Hello!')
  })

  it('endConversation clears conversation and chat', () => {
    useSessionStore.getState().startConversation('claude-123', '/repo')
    useSessionStore.getState().applyChatAction({ type: 'user-message', text: 'hi' })
    useSessionStore.getState().endConversation()
    expect(useSessionStore.getState().conversation).toBeNull()
    expect(useSessionStore.getState().chat).toEqual(initialChatState)
    expect(useSessionStore.getState().chatConnected).toBe(false)
  })

  it('reset clears conversation and chat', () => {
    useSessionStore.getState().startConversation('claude-123', '/repo')
    useSessionStore.getState().setChatConnected('CONNECTED')
    useSessionStore.getState().reset()
    expect(useSessionStore.getState().conversation).toBeNull()
    expect(useSessionStore.getState().chat).toEqual(initialChatState)
    expect(useSessionStore.getState().chatConnected).toBe(false)
  })

  it('chat WS refs default to null', () => {
    const s = useSessionStore.getState()
    expect(s.sendChatMessage).toBeNull()
    expect(s.chatEscalate).toBeNull()
    expect(s.chatSwitchView).toBeNull()
    expect(s.chatReconnect).toBeNull()
  })
})
