import { describe, it, expect, vi } from 'vitest'

// vitest vi.fn().mockImplementation is NOT new-able; use a class-based mock.
vi.mock('../../chat/ChatSession.js', () => {
  class MockChatSession {
    start = vi.fn()
    send = vi.fn()
    kill = vi.fn()
  }
  return { ChatSession: MockChatSession }
})

import { ConversationManager } from '../../chat/ConversationManager.js'
import { ClaudeCodeProvider } from '../../chat/ClaudeCodeProvider.js'

const SID = '11111111-2222-3333-4444-555555555555'

describe('ConversationManager', () => {
  it('registers and retrieves providers', () => {
    const mgr = new ConversationManager()
    mgr.registerProvider(new ClaudeCodeProvider())
    expect(mgr.getProvider('claude-code')).toBeDefined()
    expect(mgr.getProvider('nope')).toBeUndefined()
  })

  it('creates, gets, and destroys conversations', () => {
    const mgr = new ConversationManager()
    mgr.registerProvider(new ClaudeCodeProvider())
    const c = mgr.create({ providerId: 'claude-code', cwd: '/tmp', claudeSessionId: SID })
    expect(c.state.conversationId).toBeTruthy()
    expect(mgr.get(c.state.conversationId)).toBe(c)
    expect(mgr.size()).toBe(1)
    mgr.destroy(c.state.conversationId)
    expect(mgr.get(c.state.conversationId)).toBeUndefined()
    expect(mgr.size()).toBe(0)
  })

  it('create throws on unknown provider', () => {
    const mgr = new ConversationManager()
    expect(() => mgr.create({ providerId: 'nope', cwd: '/tmp', claudeSessionId: SID })).toThrow(
      /unknown provider/i,
    )
  })
})
