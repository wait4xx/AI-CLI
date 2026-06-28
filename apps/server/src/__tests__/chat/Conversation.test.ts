import { describe, it, expect, vi } from 'vitest'
import type { ProviderEvent, ChatViewMode } from '@ai-cli/shared'
import type { SpawnOpts, ChatProvider } from '../../chat/ChatProvider.js'

// mock ChatSession,避免真实 spawn
vi.mock('../../chat/ChatSession.js', () => {
  class MockChatSession {
    static instances: Array<{ resume: boolean; tier: string }> = []
    constructor(
      _provider: unknown,
      opts: { resume: boolean; tier: string },
      _onEvent?: unknown,
      _onCrash?: unknown,
    ) {
      MockChatSession.instances.push({ resume: opts.resume, tier: opts.tier })
    }
    start = vi.fn()
    send = vi.fn(() => true)
    kill = vi.fn()
  }
  return { ChatSession: MockChatSession }
})

import { Conversation } from '../../chat/Conversation.js'
import { ChatSession as MockChatSession } from '../../chat/ChatSession.js'

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

describe('Conversation — switch / escalate / crash', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(MockChatSession as unknown as { instances: unknown[] }).instances.length = 0
  })

  it('switchView to terminal kills session and emits viewChanged', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start()
    const seen: ChatViewMode[] = []
    c.on('viewChanged', (p: { viewMode: ChatViewMode }) => seen.push(p.viewMode))
    c.switchView('terminal')
    expect(c.state.viewMode).toBe('terminal')
    expect(seen).toEqual(['terminal'])
  })

  it('switchView back to chat respawns with resume=true', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start() // spawnSession(false) → resume false
    c.switchView('terminal') // kills session
    c.switchView('chat') // spawnSession(true) → resume true
    const resumes = (
      MockChatSession as unknown as { instances: Array<{ resume: boolean }> }
    ).instances.map((i) => i.resume)
    expect(resumes).toEqual([false, true])
  })

  it('escalate to Edit changes tier', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start()
    c.escalate('Edit')
    expect(c.state.tier).toBe('Edit')
  })

  it('escalate rejects unsupported tier', () => {
    const p = makeStubProvider()
    p.availableTiers = () => ['Explore']
    const c = new Conversation(p, { conversationId: 'c1', claudeSessionId: SID, cwd: '/tmp' })
    c.start()
    c.escalate('Edit')
    expect(c.state.tier).toBe('Explore')
  })

  it('onCrash emits crashed with resumable=true', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    let crashed: { resumable: boolean } | null = null
    c.on('crashed', (p) => (crashed = p))
    c['onCrash'](1, 'boom')
    expect(crashed).not.toBeNull()
    expect(crashed!.resumable).toBe(true)
  })
})
