import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ChatPermissionTier, ChatViewMode } from '@ai-cli/shared'
import { initialChatState } from '../../lib/chatReducer'

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ logout: vi.fn() }) }))

import { ChatView } from '../../components/chat/ChatView'
import { useSessionStore } from '../../store/sessionStore'

const CONV = {
  conversationId: 'conv-1',
  claudeSessionId: 'claude-1',
  cwd: '/repo',
  viewMode: 'chat' as const,
  tier: 'Explore' as const,
  status: 'active' as const,
  lastActivity: 1,
}

/**
 * Inject a minimal multi-conversation store state plus transport refs that
 * ChatView reads. In production these refs are populated by <ChatTransport />;
 * here we stub them so ChatView is exercised as a pure reader.
 */
function setup(overrides: Partial<typeof CONV> = {}) {
  const sendChatMessage = vi.fn()
  const chatEscalate = vi.fn()
  const chatSwitchView = vi.fn()
  const chatReconnect = vi.fn()
  useSessionStore.setState({
    conversations: [{ ...CONV, ...overrides }],
    chats: { 'conv-1': { ...initialChatState } },
    activeConversationId: 'conv-1',
    sendChatMessage,
    chatEscalate,
    chatSwitchView,
    chatReconnect,
  })
  return { sendChatMessage, chatEscalate, chatSwitchView, chatReconnect }
}

describe('ChatView', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
    useSessionStore.getState().setTokens('access-token', 'refresh-token')
    useSessionStore.getState().setCurrentUser({ userId: 'u', username: 'admin', role: 'admin' })
  })

  it('renders "No active conversation" when no active id', () => {
    render(<ChatView />)
    expect(screen.getByText('No active conversation')).toBeInTheDocument()
  })

  it('renders active conversation + accepts input via store ref', async () => {
    const user = userEvent.setup()
    const { sendChatMessage } = setup()
    render(<ChatView />)
    const ta = screen.getByPlaceholderText(/发消息/) as HTMLTextAreaElement
    await user.type(ta, 'ping{Enter}')
    expect(sendChatMessage).toHaveBeenCalledWith('ping')
  })

  it('escalate button invokes chatEscalate ref', () => {
    const { chatEscalate } = setup()
    render(<ChatView />)
    fireEvent.click(screen.getByText('编辑'))
    expect(chatEscalate).toHaveBeenCalled()
    const tier = chatEscalate.mock.calls[0][0] as ChatPermissionTier
    expect(tier).toBe('Edit')
  })

  it('switchView button invokes chatSwitchView ref', () => {
    const { chatSwitchView } = setup()
    render(<ChatView />)
    fireEvent.click(screen.getByLabelText('切换到终端视图'))
    expect(chatSwitchView).toHaveBeenCalledWith('terminal')
  })

  it('crash banner renders from chat.crashed and reconnect ref fires on click', () => {
    const { chatReconnect } = setup()
    useSessionStore.setState({
      chats: {
        'conv-1': {
          ...initialChatState,
          crashed: { message: 'process died', resumable: true },
        },
      },
    })
    render(<ChatView />)
    expect(screen.getByTestId('crash-banner')).toHaveTextContent('process died')
    fireEvent.click(screen.getByText('重新连接'))
    expect(chatReconnect).toHaveBeenCalled()
  })

  it('admin sees escalate buttons (role gating comes from currentUser)', () => {
    setup()
    render(<ChatView />)
    expect(screen.getByText('编辑')).toBeInTheDocument()
  })
})
