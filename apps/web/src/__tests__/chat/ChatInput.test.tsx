import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from '../../components/chat/ChatInput'

describe('ChatInput', () => {
  it('Enter sends and clears the input', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput onSend={onSend} />)
    const ta = screen.getByPlaceholderText(/发消息/) as HTMLTextAreaElement
    await user.type(ta, 'hello{Enter}')
    expect(onSend).toHaveBeenCalledWith('hello')
    expect(ta.value).toBe('')
  })

  it('Shift+Enter inserts a newline without sending', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput onSend={onSend} />)
    const ta = screen.getByPlaceholderText(/发消息/) as HTMLTextAreaElement
    await user.type(ta, 'hi{Shift>}{Enter}{/Shift}')
    expect(onSend).not.toHaveBeenCalled()
    expect(ta.value).toContain('\n')
  })

  it('does not send empty/whitespace text', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput onSend={onSend} />)
    const ta = screen.getByPlaceholderText(/发消息/) as HTMLTextAreaElement
    await user.type(ta, '   {Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatInput onSend={vi.fn()} />)
    expect(screen.getByLabelText('发送')).toBeDisabled()
  })

  it('disabled prop disables sending', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput onSend={onSend} disabled />)
    const ta = screen.getByPlaceholderText(/发消息/) as HTMLTextAreaElement
    await user.type(ta, 'hello{Enter}')
    expect(onSend).not.toHaveBeenCalled()
  })
})
