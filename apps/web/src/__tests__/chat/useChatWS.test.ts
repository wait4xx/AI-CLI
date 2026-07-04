import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatWS } from '../../hooks/useChatWS'
import { useSessionStore } from '../../store/sessionStore'

class FakeWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeWS[] = []
  static last() {
    return FakeWS.instances[FakeWS.instances.length - 1]
  }
  url: string
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  constructor(url: string) {
    this.url = url
    FakeWS.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = 3
  }
  deliver(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
  fireOpen() {
    this.onopen?.()
  }
  fireClose(code: number) {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

beforeEach(() => {
  FakeWS.instances = []
  useSessionStore.getState().reset()
  vi.stubGlobal('WebSocket', FakeWS)
})

function render() {
  return renderHook(() => useChatWS(() => 'access-token', vi.fn()))
}

it('createConversation sends CHAT_CREATE', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
  act(() => result.current.createConversation('/repo'))
  const sent = JSON.parse(FakeWS.last().sent[0])
  expect(sent.type).toBe('CHAT_CREATE')
  expect(sent.cwd).toBe('/repo')
})

it('switchTo sends CHAT_RECONNECT for an unsubscribed conversation', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
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
  })
  act(() => result.current.switchTo('c1'))
  const reconnects = FakeWS.last()
    .sent.map((s) => JSON.parse(s))
    .filter((m) => m.type === 'CHAT_RECONNECT')
  expect(reconnects).toHaveLength(1)
})

it('ensureSubscribed is idempotent (no duplicate CHAT_RECONNECT)', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
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
    subscribedConversationIds: ['c1'],
  })
  act(() => result.current.switchTo('c1'))
  const reconnects = FakeWS.last()
    .sent.map((s) => JSON.parse(s))
    .filter((m) => m.type === 'CHAT_RECONNECT')
  expect(reconnects).toHaveLength(0)
})

it('closeConversation sends CHAT_DETACH', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
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
    subscribedConversationIds: ['c1'],
    activeConversationId: 'c1',
  })
  act(() => result.current.closeConversation('c1'))
  const detaches = FakeWS.last()
    .sent.map((s) => JSON.parse(s))
    .filter((m) => m.type === 'CHAT_DETACH')
  expect(detaches).toHaveLength(1)
})

it('reconnect re-subscribes all subscribedConversationIds', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
  useSessionStore.setState({ subscribedConversationIds: ['c1', 'c2'] })
  act(() => result.current.reconnect())
  act(() => FakeWS.last().fireOpen())
  const reconnects = FakeWS.last()
    .sent.map((s) => JSON.parse(s))
    .filter((m) => m.type === 'CHAT_RECONNECT')
  expect(reconnects).toHaveLength(2)
})
