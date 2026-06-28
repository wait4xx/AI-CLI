import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatWS } from '../../hooks/useChatWS'
import { useSessionStore } from '../../store/sessionStore'

/** Minimal fake WebSocket capturing sent messages and exposing event delivery. */
class FakeWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeWS[] = []
  static last(): FakeWS {
    return FakeWS.instances[FakeWS.instances.length - 1]
  }
  url: string
  readyState = 1 // OPEN
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  closed = false
  constructor(url: string) {
    this.url = url
    FakeWS.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.closed = true
    this.readyState = 3
  }
  deliver(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
  fireClose(code: number) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  fireOpen() {
    this.onopen?.()
  }
}

describe('useChatWS', () => {
  beforeEach(() => {
    FakeWS.instances = []
    useSessionStore.getState().reset()
    vi.stubGlobal('WebSocket', FakeWS)
  })

  function render(onAuthFailure = vi.fn()) {
    return renderHook(() => useChatWS(() => 'access-token', onAuthFailure))
  }

  it('connect sends CHAT_CREATE on open for a new conversation', () => {
    const { result } = render()
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    const sent = JSON.parse(FakeWS.last().sent[0])
    expect(sent).toMatchObject({
      type: 'CHAT_CREATE',
      claudeSessionId: 'claude-1',
      cwd: '/repo',
      providerId: 'claude-code',
      initialTier: 'Explore',
    })
    expect(FakeWS.last().url).toContain('/ws/chat?token=access-token')
  })

  it('connect sends CHAT_RECONNECT when an existingConversationId is provided', () => {
    const { result } = render()
    act(() => result.current.connect('claude-1', '/repo', 'conv-99'))
    act(() => FakeWS.last().fireOpen())
    const sent = JSON.parse(FakeWS.last().sent[0])
    expect(sent).toMatchObject({ type: 'CHAT_RECONNECT', conversationId: 'conv-99' })
  })

  it('CHAT_CREATED stores conversationId/tier/viewMode and marks connected', () => {
    const { result } = render()
    useSessionStore.getState().startConversation('claude-1', '/repo')
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_CREATED',
        conversationId: 'conv-1',
        claudeSessionId: 'claude-1',
        tier: 'Explore',
        viewMode: 'chat',
      }),
    )
    expect(useSessionStore.getState().conversation?.conversationId).toBe('conv-1')
    expect(useSessionStore.getState().chatConnected).toBe(true)
    expect(result.current.isConnected).toBe(true)
  })

  it('CHAT_EVENT drives the reducer', () => {
    const { result } = render()
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_EVENT',
        conversationId: 'conv-1',
        event: { type: 'text-delta', text: 'Hello!' },
      }),
    )
    expect(useSessionStore.getState().chat.turns).toHaveLength(1)
    expect(useSessionStore.getState().chat.turns[0].text).toBe('Hello!')
  })

  it('CHAT_VIEW_CHANGED updates viewMode and tier', () => {
    const { result } = render()
    useSessionStore.getState().startConversation('claude-1', '/repo')
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_VIEW_CHANGED',
        conversationId: 'conv-1',
        viewMode: 'terminal',
        tier: 'Edit',
      }),
    )
    expect(useSessionStore.getState().conversation?.viewMode).toBe('terminal')
    expect(useSessionStore.getState().conversation?.tier).toBe('Edit')
  })

  it('CHAT_CRASHED sets the crashed flag', () => {
    const { result } = render()
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_CRASHED',
        conversationId: 'conv-1',
        message: 'boom',
        resumable: true,
      }),
    )
    expect(useSessionStore.getState().chat.crashed).toEqual({ message: 'boom', resumable: true })
  })

  it('CHAT_HISTORY loads turns and clears crashed (reconnect recovery)', () => {
    const { result } = render()
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_CRASHED',
        conversationId: 'conv-1',
        message: 'boom',
        resumable: true,
      }),
    )
    expect(useSessionStore.getState().chat.crashed).not.toBeNull()
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_HISTORY',
        conversationId: 'conv-1',
        messages: [
          { role: 'user', text: 'old', ts: 1 },
          { role: 'assistant', text: 'new', ts: 2 },
        ],
      }),
    )
    expect(useSessionStore.getState().chat.crashed).toBeNull()
    expect(useSessionStore.getState().chat.turns).toHaveLength(2)
  })

  it('sendMessage dispatches a local user-message and sends CHAT_SEND', () => {
    const { result } = render()
    useSessionStore.getState().startConversation('claude-1', '/repo')
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_CREATED',
        conversationId: 'conv-1',
        claudeSessionId: 'claude-1',
        tier: 'Explore',
        viewMode: 'chat',
      }),
    )
    act(() => result.current.sendMessage('hi there'))
    expect(useSessionStore.getState().chat.turns[0]).toMatchObject({
      role: 'user',
      text: 'hi there',
    })
    const sent = JSON.parse(FakeWS.last().sent[FakeWS.last().sent.length - 1])
    expect(sent).toMatchObject({ type: 'CHAT_SEND', conversationId: 'conv-1', text: 'hi there' })
  })

  it('escalate sends CHAT_ESCALATE with the conversationId', () => {
    const { result } = render()
    useSessionStore.getState().startConversation('claude-1', '/repo')
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_CREATED',
        conversationId: 'conv-1',
        claudeSessionId: 'claude-1',
        tier: 'Explore',
        viewMode: 'chat',
      }),
    )
    act(() => result.current.escalate('Edit'))
    const sent = JSON.parse(FakeWS.last().sent[FakeWS.last().sent.length - 1])
    expect(sent).toMatchObject({ type: 'CHAT_ESCALATE', conversationId: 'conv-1', tier: 'Edit' })
  })

  it('onclose with AUTH_FAILED code calls onAuthFailure', () => {
    const onAuthFailure = vi.fn()
    const { result } = render(onAuthFailure)
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    act(() => FakeWS.last().fireClose(4001))
    expect(onAuthFailure).toHaveBeenCalledTimes(1)
  })

  it('reconnect opens a new socket reusing the last connect params', () => {
    const { result } = render()
    act(() => result.current.connect('claude-1', '/repo'))
    act(() => FakeWS.last().fireOpen())
    const first = FakeWS.last()
    act(() => result.current.reconnect())
    expect(FakeWS.last()).not.toBe(first)
    act(() => FakeWS.last().fireOpen())
    const sent = JSON.parse(FakeWS.last().sent[0])
    expect(sent.type).toBe('CHAT_CREATE')
  })
})
