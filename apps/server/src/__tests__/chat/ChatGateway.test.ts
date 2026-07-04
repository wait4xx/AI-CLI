import { describe, it, expect, vi } from 'vitest'
import type { WebSocket } from 'ws'

vi.mock('../../lib/logger.js', () => ({
  pinoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))
vi.mock('../../chat/ChatSession.js', () => {
  class MockChatSession {
    start = vi.fn()
    send = vi.fn()
    kill = vi.fn()
  }
  return { ChatSession: MockChatSession }
})

import { ChatGateway } from '../../chat/ChatGateway.js'
import { ConversationManager } from '../../chat/ConversationManager.js'
import { ClaudeCodeProvider } from '../../chat/ClaudeCodeProvider.js'

function fakeWs() {
  const handlers: Record<string, Array<(d: unknown) => void>> = {}
  const ws = {
    readyState: 1,
    send: vi.fn(function (this: { sent: unknown[] }, raw: string) {
      this.sent.push(JSON.parse(raw))
    }),
    close: vi.fn(),
    on: vi.fn((t: string, h: (d: unknown) => void) => {
      handlers[t] ||= []
      handlers[t].push(h)
    }),
    once: vi.fn((t: string, h: () => void) => {
      handlers[t] ||= []
      handlers[t].push(h as unknown as (d: unknown) => void)
    }),
    sent: [] as unknown[],
    emit(t: string, d: unknown) {
      const list = handlers[t] || []
      list.forEach((h) => h(d))
    },
  }
  return ws
}

const USER = { userId: 'u1', username: 'alice', role: 'admin', tokenVersion: 1, iat: 0, exp: 0 }

function setup() {
  const mgr = new ConversationManager()
  mgr.registerProvider(new ClaudeCodeProvider())
  const gw = new ChatGateway(
    mgr,
    'jwt-secret-at-least-32-characters-long',
    'refresh-secret-at-least-32-characters',
  )
  return { mgr, gw }
}

describe('ChatGateway', () => {
  it('CHAT_ATTACH to unknown conversation replies CHAT_ERROR', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as never)
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'CHAT_ATTACH', conversationId: 'nope' })))
    expect(ws.sent.some((m) => (m as { type: string }).type === 'CHAT_ERROR')).toBe(true)
  })

  it('CHAT_CREATE creates conversation and forwards events as CHAT_EVENT', () => {
    const { gw, mgr } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as never)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const created = ws.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as
      | { type: string; conversationId: string }
      | undefined
    expect(created).toBeDefined()
    const conv = mgr.get(created!.conversationId)!
    conv.emit('event', { type: 'text-delta', text: 'hi' })
    expect(
      ws.sent.some(
        (m) =>
          (m as { type: string; event?: { text?: string } }).type === 'CHAT_EVENT' &&
          (m as { event?: { text?: string } }).event?.text === 'hi',
      ),
    ).toBe(true)
  })

  it('CHAT_SWITCH_VIEW forwards CHAT_VIEW_CHANGED', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as never)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = (
      ws.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as {
        conversationId: string
      }
    ).conversationId
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({ type: 'CHAT_SWITCH_VIEW', conversationId: convId, viewMode: 'terminal' }),
      ),
    )
    expect(
      ws.sent.some(
        (m) =>
          (m as { type: string; viewMode?: string }).type === 'CHAT_VIEW_CHANGED' &&
          (m as { viewMode?: string }).viewMode === 'terminal',
      ),
    ).toBe(true)
  })

  it('CHAT_ESCALATE to Edit by non-admin replies CHAT_ERROR', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, { ...USER, role: 'user' } as never)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = (
      ws.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as {
        conversationId: string
      }
    ).conversationId
    ws.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'CHAT_ESCALATE', conversationId: convId, tier: 'Edit' })),
    )
    expect(
      ws.sent.some(
        (m) =>
          (m as { type: string; message?: string }).type === 'CHAT_ERROR' &&
          /admin/.test((m as { message?: string }).message ?? ''),
      ),
    ).toBe(true)
  })
})

describe('ChatGateway — review fixes', () => {
  it('does not duplicate broadcasts when the same ws attaches twice', () => {
    const { gw, mgr } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as never)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = (
      ws.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as {
        conversationId: string
      }
    ).conversationId
    // same ws attaches again (simulating CHAT_RECONNECT on the same conversation)
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'CHAT_ATTACH', conversationId: convId })))
    // clear sent so we only count broadcasts from this event
    ws.sent.length = 0
    mgr.get(convId)!.emit('event', { type: 'text-delta', text: 'once' })
    const eventCount = ws.sent.filter((m) => (m as { type: string }).type === 'CHAT_EVENT').length
    expect(eventCount).toBe(1) // NOT 2
  })

  it('escalate broadcasts CHAT_VIEW_CHANGED with the new tier', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as never) // USER.role === 'admin'
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = (
      ws.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as {
        conversationId: string
      }
    ).conversationId
    ws.sent.length = 0
    ws.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'CHAT_ESCALATE', conversationId: convId, tier: 'Edit' })),
    )
    const viewChanged = ws.sent.find(
      (m) => (m as { type: string }).type === 'CHAT_VIEW_CHANGED',
    ) as { tier?: string; viewMode?: string } | undefined
    expect(viewChanged).toBeDefined()
    expect(viewChanged!.tier).toBe('Edit')
  })

  it('rejects a non-owner (non-admin) from operating on another user conversation', () => {
    const { gw } = setup()
    // owner creates the conversation
    const ownerWs = fakeWs()
    gw.handleChatConnection(ownerWs as unknown as WebSocket, USER as never)
    ownerWs.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = (
      ownerWs.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as {
        conversationId: string
      }
    ).conversationId
    // a different non-admin user tries to send
    const otherWs = fakeWs()
    const OTHER = { ...USER, userId: 'u2', role: 'user' }
    gw.handleChatConnection(otherWs as unknown as WebSocket, OTHER as never)
    otherWs.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'CHAT_SEND', conversationId: convId, text: 'hi' })),
    )
    expect(
      otherWs.sent.some(
        (m) =>
          (m as { type: string; message?: string }).type === 'CHAT_ERROR' &&
          /owner/.test((m as { message?: string }).message ?? ''),
      ),
    ).toBe(true)
  })

  it('allows an admin (non-owner) to operate on another user conversation', () => {
    const { gw } = setup()
    // a non-admin owner creates
    const ownerWs = fakeWs()
    gw.handleChatConnection(
      ownerWs as unknown as WebSocket,
      { ...USER, userId: 'owner1', role: 'user' } as never,
    )
    ownerWs.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = (
      ownerWs.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as {
        conversationId: string
      }
    ).conversationId
    // a different admin sends — admin override
    const adminWs = fakeWs()
    const ADMIN = { ...USER, userId: 'adminX', role: 'admin' }
    gw.handleChatConnection(adminWs as unknown as WebSocket, ADMIN as never)
    adminWs.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'CHAT_SEND', conversationId: convId, text: 'hi' })),
    )
    expect(
      adminWs.sent.some(
        (m) =>
          (m as { type: string; message?: string }).type === 'CHAT_ERROR' &&
          /owner/.test((m as { message?: string }).message ?? ''),
      ),
    ).toBe(false)
  })

  it('rejects CHAT_CREATE whose cwd escapes PROJECT_ROOT', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as never)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '../outside',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    expect(
      ws.sent.some(
        (m) =>
          (m as { type: string; message?: string }).type === 'CHAT_ERROR' &&
          /project root/.test((m as { message?: string }).message ?? ''),
      ),
    ).toBe(true)
    expect(ws.sent.some((m) => (m as { type: string }).type === 'CHAT_CREATED')).toBe(false)
  })

  it('reaps an idle conversation after the grace period', () => {
    vi.useFakeTimers()
    const { gw, mgr } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as never)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = (
      ws.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as {
        conversationId: string
      }
    ).conversationId
    expect(mgr.get(convId)).toBeDefined()
    ws.emit('close', {}) // last subscriber leaves
    expect(mgr.get(convId)).toBeDefined() // not reaped immediately
    vi.advanceTimersByTime(60_000)
    expect(mgr.get(convId)).toBeUndefined() // reaped after grace period
    vi.useRealTimers()
  })

  it('cancels reaping when a subscriber re-attaches within the grace period', () => {
    vi.useFakeTimers()
    const { gw, mgr } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as never)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = (
      ws.sent.find((m) => (m as { type: string }).type === 'CHAT_CREATED') as {
        conversationId: string
      }
    ).conversationId
    ws.emit('close', {}) // last subscriber leaves → reaper scheduled
    const ws2 = fakeWs()
    gw.handleChatConnection(ws2 as unknown as WebSocket, USER as never)
    ws2.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'CHAT_ATTACH', conversationId: convId })),
    )
    vi.advanceTimersByTime(60_000)
    expect(mgr.get(convId)).toBeDefined() // NOT reaped — re-attach cancelled it
    vi.useRealTimers()
  })

  it('CHAT_DETACH removes the ws from subscribers (reaper eligible)', async () => {
    vi.useFakeTimers()
    const { gw, mgr } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '',
          claudeSessionId: 'c-1',
          providerId: 'claude-code',
        }),
      ),
    )
    await Promise.resolve()
    const convId = (ws.sent[0] as { conversationId: string }).conversationId
    expect(mgr.get(convId)).toBeDefined()

    ws.emit('message', Buffer.from(JSON.stringify({ type: 'CHAT_DETACH', conversationId: convId })))
    await Promise.resolve()
    expect(mgr.get(convId)).toBeDefined() // reaper 还没到期

    vi.advanceTimersByTime(31_000) // 超过 30s reaper
    expect(mgr.get(convId)).toBeUndefined()
    vi.useRealTimers()
  })
})
