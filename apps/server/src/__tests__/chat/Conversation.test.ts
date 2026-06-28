import { describe, it, expect, vi } from 'vitest'
import type { ProviderEvent, ChatViewMode } from '@ai-cli/shared'
import type { SpawnOpts, ChatProvider } from '../../chat/ChatProvider.js'

// mock ChatSession,避免真实 spawn
vi.mock('../../chat/ChatSession.js', () => {
  class MockChatSession {
    start = vi.fn()
    send = vi.fn(() => true)
    kill = vi.fn()
  }
  return { ChatSession: MockChatSession }
})

import { Conversation } from '../../chat/Conversation.js'

function makeStubProvider(): ChatProvider & { spawnOpts: SpawnOpts[] } {
  const seen: SpawnOpts[] = []
  return {
    id: 'stub',
    spawnOpts: seen,
    spawnArgs: (o) => {
      seen.push(o)
      return ['--stub', o.tier]
    },
    sendMessage: (stdin, text) => {
      stdin.write(JSON.stringify({ text }) + '\n')
    },
    parseStreamLine: () => [],
    availableTiers: () => ['Explore', 'Edit'],
    supportsResume: () => true,
  }
}

const SID = '11111111-2222-3333-4444-555555555555'

describe('Conversation', () => {
  it('starts in chat/Explore and exposes state', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    expect(c.state.viewMode).toBe('chat')
    expect(c.state.tier).toBe('Explore')
    expect(c.state.conversationId).toBe('c1')
  })

  it('emit event forwards to listeners', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    const heard: ProviderEvent[] = []
    c.on('event', (e) => heard.push(e))
    c['onProviderEvent']({ type: 'text-delta', text: 'hi' } as ProviderEvent)
    expect(heard).toHaveLength(1)
  })

  it('send() appends user message to messageLog', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start()
    c.send('hello')
    expect(c.state.messageLog.some((m) => m.role === 'user' && m.text === 'hello')).toBe(true)
  })

  it('destroy() does not throw', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start()
    expect(() => c.destroy()).not.toThrow()
  })
})
