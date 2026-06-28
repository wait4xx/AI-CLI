import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MessageBubble } from '../../components/chat/MessageBubble'

describe('MessageBubble', () => {
  it('renders assistant markdown (bold → strong)', () => {
    const { container, getByTestId } = render(<MessageBubble role="assistant" text={'**bold**'} />)
    expect(getByTestId('msg-assistant')).toBeInTheDocument()
    expect(container.querySelector('strong')?.textContent).toBe('bold')
  })

  it('renders user text as plain text (no markdown parsing)', () => {
    const { container, getByTestId } = render(<MessageBubble role="user" text={'**not bold**'} />)
    expect(getByTestId('msg-user')).toBeInTheDocument()
    expect(container.querySelector('strong')).toBeNull()
    expect(getByTestId('msg-user').textContent).toContain('**not bold**')
  })

  it('renders an error bubble for assistant errors', () => {
    const { getByTestId } = render(
      <MessageBubble role="assistant" text="" error="something broke" />,
    )
    const el = getByTestId('msg-error')
    expect(el).toBeInTheDocument()
    expect(el.textContent).toContain('something broke')
    // red styling lives on the inner bubble
    expect(el.innerHTML).toContain('red-500')
  })

  it('user and assistant bubbles use different alignment classes', () => {
    const u = render(<MessageBubble role="user" text="hi" />).getByTestId('msg-user')
    const a = render(<MessageBubble role="assistant" text="hi" />).getByTestId('msg-assistant')
    expect(u.className).toContain('justify-end')
    expect(a.className).toContain('justify-start')
  })
})
