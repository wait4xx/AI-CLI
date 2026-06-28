import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModeSwitch } from '../../components/chat/ModeSwitch'

describe('ModeSwitch', () => {
  it('admin can escalate to Edit', () => {
    const onEscalate = vi.fn()
    render(
      <ModeSwitch tier="Explore" role="admin" onEscalate={onEscalate} onSwitchView={vi.fn()} />,
    )
    fireEvent.click(screen.getByText('编辑'))
    expect(onEscalate).toHaveBeenCalledWith('Edit')
  })

  it('admin can switch back to Explore', () => {
    const onEscalate = vi.fn()
    render(<ModeSwitch tier="Edit" role="admin" onEscalate={onEscalate} onSwitchView={vi.fn()} />)
    fireEvent.click(screen.getByText('探索'))
    expect(onEscalate).toHaveBeenCalledWith('Explore')
  })

  it('non-admin Edit button is disabled and does not escalate', () => {
    const onEscalate = vi.fn()
    render(<ModeSwitch tier="Explore" role="user" onEscalate={onEscalate} onSwitchView={vi.fn()} />)
    const editBtn = screen.getByText('编辑')
    expect(editBtn).toBeDisabled()
    fireEvent.click(editBtn)
    expect(onEscalate).not.toHaveBeenCalled()
    expect(editBtn.getAttribute('title')).toBe('需要管理员权限')
  })

  it('terminal button triggers onSwitchView', () => {
    const onSwitchView = vi.fn()
    render(
      <ModeSwitch tier="Explore" role="admin" onEscalate={vi.fn()} onSwitchView={onSwitchView} />,
    )
    fireEvent.click(screen.getByLabelText('切换到终端视图'))
    expect(onSwitchView).toHaveBeenCalledWith('terminal')
  })

  it('highlights the active tier', () => {
    const { getByText } = render(
      <ModeSwitch tier="Edit" role="admin" onEscalate={vi.fn()} onSwitchView={vi.fn()} />,
    )
    expect(getByText('编辑').className).toContain('bg-blue-500/20')
    expect(getByText('探索').className).not.toContain('bg-blue-500/20')
  })
})
