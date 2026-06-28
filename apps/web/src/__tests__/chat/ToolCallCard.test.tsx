import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolCallCard } from '../../components/chat/ToolCallCard'
import type { ToolCallView } from '../../lib/chatReducer'

function card(overrides: Partial<ToolCallView> = {}): ToolCallView {
  return {
    callId: 'c1',
    toolName: 'Read',
    inputSummary: 'src/foo.ts',
    status: 'running',
    outputSnippet: '',
    ...overrides,
  }
}

describe('ToolCallCard', () => {
  it('shows tool name and running indicator while running', () => {
    render(<ToolCallCard call={card({ status: 'running' })} />)
    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.getByText('运行中…')).toBeInTheDocument()
  })

  it('toggles output snippet on click (success)', () => {
    const { container } = render(
      <ToolCallCard call={card({ status: 'success', outputSnippet: 'file body' })} />,
    )
    expect(screen.queryByText('file body')).toBeNull()
    fireEvent.click(screen.getByText('Read'))
    expect(screen.getByText('file body')).toBeInTheDocument()
    expect(container.querySelector('.text-green-400')).not.toBeNull()
  })

  it('renders red status color for error results', () => {
    const { container } = render(
      <ToolCallCard call={card({ status: 'error', outputSnippet: 'denied' })} />,
    )
    expect(container.querySelector('.text-red-400')).not.toBeNull()
  })
})
