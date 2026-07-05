import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../store/sessionStore'

describe('sessionStore chat extensions', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it('createConversation adds a placeholder with default Explore/chat', () => {
    const claudeSessionId = useSessionStore.getState().createConversation('/repo')
    const { conversations, chats, activeConversationId } = useSessionStore.getState()
    expect(conversations).toHaveLength(1)
    expect(conversations[0]).toEqual({
      conversationId: '',
      claudeSessionId,
      cwd: '/repo',
      viewMode: 'chat',
      tier: 'Explore',
      status: 'connecting',
      lastActivity: expect.any(Number),
    })
    // No chat slice until CHAT_CREATED backfills the conversationId.
    expect(chats).toEqual({})
    // Placeholder active id is '' until CHAT_CREATED resolves it.
    expect(activeConversationId).toBe('')
  })

  it('setConversationId backfills the server-assigned id and marks active', () => {
    const claudeSessionId = useSessionStore.getState().createConversation('/repo')
    useSessionStore.getState().setConversationId(claudeSessionId, 'conv-1')
    const { conversations, activeConversationId } = useSessionStore.getState()
    expect(conversations[0].conversationId).toBe('conv-1')
    expect(conversations[0].status).toBe('active')
    expect(activeConversationId).toBe('conv-1')
  })

  it('setConversationViewMode and setConversationTier update the conversation', () => {
    const claudeSessionId = useSessionStore.getState().createConversation('/repo')
    useSessionStore.getState().setConversationId(claudeSessionId, 'conv-1')
    useSessionStore.getState().setConversationViewMode('conv-1', 'terminal')
    useSessionStore.getState().setConversationTier('conv-1', 'Edit')
    const c = useSessionStore.getState().conversations[0]
    expect(c.viewMode).toBe('terminal')
    expect(c.tier).toBe('Edit')
  })

  it('setChatConnected tracks phase + boolean', () => {
    useSessionStore.getState().setChatConnected('CONNECTING')
    expect(useSessionStore.getState().chatConnectionPhase).toBe('CONNECTING')
    expect(useSessionStore.getState().chatConnected).toBe(false)
    useSessionStore.getState().setChatConnected('CONNECTED')
    expect(useSessionStore.getState().chatConnected).toBe(true)
  })

  it('applyChatAction routes by conversationId (user-message then event)', () => {
    const claudeSessionId = useSessionStore.getState().createConversation('/repo')
    useSessionStore.getState().setConversationId(claudeSessionId, 'conv-1')
    useSessionStore.getState().applyChatAction('conv-1', { type: 'user-message', text: 'hi' })
    useSessionStore
      .getState()
      .applyChatAction('conv-1', { type: 'event', event: { type: 'text-delta', text: 'Hello!' } })
    const turns = useSessionStore.getState().chats['conv-1'].turns
    expect(turns).toHaveLength(2)
    expect(turns[0].role).toBe('user')
    expect(turns[1].role).toBe('assistant')
    expect(turns[1].text).toBe('Hello!')
  })

  it('closeConversation removes the conversation and its chat slice', () => {
    const claudeSessionId = useSessionStore.getState().createConversation('/repo')
    useSessionStore.getState().setConversationId(claudeSessionId, 'conv-1')
    useSessionStore.getState().applyChatAction('conv-1', { type: 'user-message', text: 'hi' })
    useSessionStore.getState().closeConversation('conv-1')
    const { conversations, chats, activeConversationId } = useSessionStore.getState()
    expect(conversations).toHaveLength(0)
    expect(chats['conv-1']).toBeUndefined()
    expect(activeConversationId).toBeNull()
  })

  it('reset clears conversations and chats', () => {
    useSessionStore.getState().createConversation('/repo')
    useSessionStore.getState().setChatConnected('CONNECTED')
    useSessionStore.getState().reset()
    const { conversations, chats, chatConnected } = useSessionStore.getState()
    expect(conversations).toEqual([])
    expect(chats).toEqual({})
    expect(chatConnected).toBe(false)
  })

  it('chat WS refs default to null', () => {
    const s = useSessionStore.getState()
    expect(s.sendChatMessage).toBeNull()
    expect(s.chatEscalate).toBeNull()
    expect(s.chatSwitchView).toBeNull()
    expect(s.chatReconnect).toBeNull()
    expect(s.chatCreateConversation).toBeNull()
    expect(s.chatSwitchTo).toBeNull()
    expect(s.chatCloseConversation).toBeNull()
  })
})
