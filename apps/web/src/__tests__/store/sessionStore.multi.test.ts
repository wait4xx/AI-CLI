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
    s.createConversation('/a')
    s.createConversation('/b')
    const [first] = useSessionStore.getState().conversations
    s.switchTo(first.conversationId)
    expect(useSessionStore.getState().activeConversationId).toBe(first.conversationId)
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

  it('LRU closes oldest when exceeding maxConversations', () => {
    const s = useSessionStore.getState()
    s.setMaxConversations(2)
    s.createConversation('/a')
    s.createConversation('/b')
    s.createConversation('/c')
    const st = useSessionStore.getState()
    expect(st.conversations).toHaveLength(2)
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
