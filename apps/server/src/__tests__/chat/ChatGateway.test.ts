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
      ;(handlers[t] ||= []).push(h)
    }),
    once: vi.fn((t: string, h: () => void) => {
      ;(handlers[t] ||= []).push(h as unknown as (d: unknown) => void)
    }),
    sent: [] as unknown[],
    emit(t: string, d: unknown) {
      ;(handlers[t] || []).forEach((h) => h(d))
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
