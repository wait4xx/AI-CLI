import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../store/sessionStore'
import { initialChatState } from '../../lib/chatReducer'

beforeEach(() => useSessionStore.getState().reset())

describe('multi-conversation store', () => {
  it('createConversation adds a placeholder + sets active', () => {
    const s = useSessionStore.getState()
    s.createConversation('/repo')
    const st = useSessionStore.getState()
    expect(st.conversations).toHaveLength(1)
    expect(st.conversations[0].status).toBe('connecting')
  })

  it('switchTo changes activeConversationId', () => {
    const s = useSessionStore.getState()
    const claudeA = s.createConversation('/a')
    const claudeB = s.createConversation('/b')
    // Backfill server-assigned ids so switchTo targets a real conversationId
    // (placeholders have conversationId: '' until CHAT_CREATED arrives).
    s.setConversationId(claudeA, 'conv-a')
    s.setConversationId(claudeB, 'conv-b')
    // The most recently created conversation is active.
    expect(useSessionStore.getState().activeConversationId).toBe('conv-b')
    s.switchTo('conv-a')
    expect(useSessionStore.getState().activeConversationId).toBe('conv-a')
  })

  it('closeConversation removes from conversations/chats/subscriptions', () => {
    const s = useSessionStore.getState()
    useSessionStore.setState({
      conversations: [
        {
          conversationId: 'c1',
          claudeSessionId: 'x',
          cwd: '/a',
          viewMode: 'chat',
          tier: 'Explore',
          status: 'active',
          lastActivity: 1,
        },
      ],
      chats: { c1: { ...initialChatState } },
      subscribedConversationIds: ['c1'],
    })
    s.closeConversation('c1')
    const st = useSessionStore.getState()
    expect(st.conversations.find((c) => c.conversationId === 'c1')).toBeUndefined()
    expect(st.chats['c1']).toBeUndefined()
    expect(st.subscribedConversationIds).not.toContain('c1')
  })

  it('closing the active conversation switches active to the last remaining', () => {
    const s = useSessionStore.getState()
    useSessionStore.setState({
      conversations: [
        {
          conversationId: 'c1',
          claudeSessionId: 'x',
          cwd: '/a',
          viewMode: 'chat',
          tier: 'Explore',
          status: 'active',
          lastActivity: 1,
        },
        {
          conversationId: 'c2',
          claudeSessionId: 'y',
          cwd: '/b',
          viewMode: 'chat',
          tier: 'Explore',
          status: 'active',
          lastActivity: 2,
        },
      ],
      chats: { c1: { ...initialChatState }, c2: { ...initialChatState } },
      activeConversationId: 'c1',
    })
    s.closeConversation('c1')
    const st = useSessionStore.getState()
    expect(st.conversations).toHaveLength(1)
    expect(st.activeConversationId).toBe('c2')
  })

  it('LRU closes oldest when exceeding maxConversations', () => {
    const s = useSessionStore.getState()
    s.setMaxConversations(2)
    const claudeA = s.createConversation('/a')
    s.createConversation('/b')
    s.createConversation('/c') // exceeds cap → evicts /a (oldest by lastActivity)
    const st = useSessionStore.getState()
    expect(st.conversations).toHaveLength(2)
    expect(st.conversations.find((c) => c.claudeSessionId === claudeA)).toBeUndefined()
    expect(st.conversations.some((c) => c.cwd === '/c')).toBe(true)
  })

  it('applyChatAction routes by conversationId', () => {
    const s = useSessionStore.getState()
    useSessionStore.setState({
      conversations: [
        {
          conversationId: 'c1',
          claudeSessionId: 'x',
          cwd: '/a',
          viewMode: 'chat',
          tier: 'Explore',
          status: 'active',
          lastActivity: 1,
        },
        {
          conversationId: 'c2',
          claudeSessionId: 'y',
          cwd: '/b',
          viewMode: 'chat',
          tier: 'Explore',
          status: 'active',
          lastActivity: 2,
        },
      ],
      chats: { c1: { ...initialChatState }, c2: { ...initialChatState } },
    })
    s.applyChatAction('c1', { type: 'user-message', text: 'hi' })
    const st = useSessionStore.getState()
    expect(st.chats['c1'].turns).toHaveLength(1)
    expect(st.chats['c2'].turns).toHaveLength(0)
  })

  it('maxConversations persists via partialize', () => {
    useSessionStore.getState().setMaxConversations(7)
    const partialize = (
      useSessionStore as unknown as {
        persist: { getOptions: () => { partialize: (s: unknown) => Record<string, unknown> } }
      }
    ).persist.getOptions().partialize
    const persisted = partialize(useSessionStore.getState())
    expect(persisted.maxConversations).toBe(7)
  })
})
