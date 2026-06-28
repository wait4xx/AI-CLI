import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChatClientMessage } from '@ai-cli/shared'

const mockLogout = vi.fn()
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ logout: mockLogout }) }))

import { ChatView } from '../../components/chat/ChatView'
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
  send(d: string) {
    this.sent.push(d)
  }
  close() {
    this.readyState = 3
  }
  fireOpen() {
    this.onopen?.()
  }
  deliver(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
  lastSent(): ChatClientMessage {
    return JSON.parse(this.sent[this.sent.length - 1])
  }
}

function lastSent(): ChatClientMessage {
  return FakeWS.last().lastSent()
}

describe('ChatView', () => {
  beforeEach(() => {
    FakeWS.instances = []
    useSessionStore.getState().reset()
    useSessionStore.getState().setTokens('access-token', 'refresh-token')
    useSessionStore.getState().setCurrentUser({ userId: 'u', username: 'admin', role: 'admin' })
    useSessionStore.getState().startConversation('claude-1', '/repo')
    vi.stubGlobal('WebSocket', FakeWS)
  })

  it('connects on mount and sends CHAT_CREATE on open', () => {
    render(<ChatView />)
    expect(FakeWS.instances).toHaveLength(1)
    act(() => FakeWS.last().fireOpen())
    expect(lastSent().type).toBe('CHAT_CREATE')
  })

  it('renders assistant text from a CHAT_EVENT text-delta', () => {
    render(<ChatView />)
    act(() => FakeWS.last().fireOpen())
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_EVENT',
        conversationId: 'conv-1',
        event: { type: 'text-delta', text: 'Hello!' },
      }),
    )
    expect(screen.getByTestId('msg-assistant')).toHaveTextContent('Hello!')
  })

  it('shows a user bubble on send and emits CHAT_SEND', async () => {
    const user = userEvent.setup()
    render(<ChatView />)
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
    const ta = screen.getByPlaceholderText(/发消息/) as HTMLTextAreaElement
    await user.type(ta, 'ping{Enter}')
    expect(screen.getByTestId('msg-user')).toHaveTextContent('ping')
    expect(lastSent().type).toBe('CHAT_SEND')
  })

  it('admin escalating to Edit emits CHAT_ESCALATE', () => {
    render(<ChatView />)
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
    fireEvent.click(screen.getByText('编辑'))
    expect(lastSent().type).toBe('CHAT_ESCALATE')
  })

  it('shows crash banner and reconnects on click', () => {
    render(<ChatView />)
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
    act(() =>
      FakeWS.last().deliver({
        type: 'CHAT_CRASHED',
        conversationId: 'conv-1',
        message: 'process died',
        resumable: true,
      }),
    )
    expect(screen.getByTestId('crash-banner')).toHaveTextContent('process died')
    const before = FakeWS.instances.length
    fireEvent.click(screen.getByText('重新连接'))
    expect(FakeWS.instances.length).toBe(before + 1)
  })
})
