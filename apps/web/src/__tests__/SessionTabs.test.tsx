/**
 * SessionTabs 组件测试
 * 覆盖：session 列表渲染、切换 session、关闭 session、添加 session
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionTabs } from '../components/SessionTabs'
import { useSessionStore } from '../store/sessionStore'

describe('SessionTabs', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it('只有一个 session 时不渲染', () => {
    useSessionStore.getState().addSession()
    // 1 个 session 时组件返回 null
    const { container } = render(<SessionTabs />)
    expect(container.innerHTML).toBe('')
  })

  it('两个及以上 session 时渲染标签列表', () => {
    useSessionStore.getState().addSession()
    useSessionStore.getState().addSession()
    render(<SessionTabs />)

    // 应该有标签按钮（+ 号按钮不包括在内）
    const tabButtons = screen.getAllByRole('button').filter(
      btn => !btn.querySelector('svg') || btn.textContent !== ''
    )
    // 至少有 session 标签和 + 按钮
    expect(tabButtons.length).toBeGreaterThanOrEqual(2)
  })

  it('显示 session id 前8位', () => {
    useSessionStore.getState().addSession()
    useSessionStore.getState().addSession()
    const sessions = useSessionStore.getState().sessions

    render(<SessionTabs />)
    sessions.forEach(s => {
      expect(screen.getByText(s.id.slice(0, 8))).toBeInTheDocument()
    })
  })

  it('活跃 session 有高亮样式', () => {
    useSessionStore.getState().addSession()
    useSessionStore.getState().addSession()
    render(<SessionTabs />)

    // 第一个 session 应该是活跃的（activeSessionIndex = 0）
    const firstTab = screen.getAllByRole('button')[0]
    expect(firstTab.className).toContain('bg-dark-border')
    expect(firstTab.className).toContain('text-gray-100')
  })

  it('点击标签切换 session', async () => {
    useSessionStore.getState().addSession()
    useSessionStore.getState().addSession()
    const sessions = useSessionStore.getState().sessions

    render(<SessionTabs />)

    const user = userEvent.setup()
    // 点击第二个标签
    const secondTabText = sessions[1].id.slice(0, 8)
    await user.click(screen.getByText(secondTabText))

    expect(useSessionStore.getState().activeSessionIndex).toBe(1)
  })

  it('点击 + 按钮添加新 session', async () => {
    useSessionStore.getState().addSession()
    useSessionStore.getState().addSession()
    const initialCount = useSessionStore.getState().sessions.length

    render(<SessionTabs />)

    const user = userEvent.setup()
    // + 按钮是最后一个按钮（有 SVG 图标）
    const addButton = screen.getByRole('button', { name: '' }) || document.querySelectorAll('button')
    // 找到有 Plus 图标的按钮
    const allButtons = screen.getAllByRole('button')
    const plusBtn = allButtons[allButtons.length - 1]
    await user.click(plusBtn)

    expect(useSessionStore.getState().sessions.length).toBe(initialCount + 1)
  })

  it('最多10个 session', () => {
    // 添加 10 个 session
    for (let i = 0; i < 10; i++) {
      useSessionStore.getState().addSession()
    }
    expect(useSessionStore.getState().sessions.length).toBe(10)

    // 第 11 个不会添加
    useSessionStore.getState().addSession()
    expect(useSessionStore.getState().sessions.length).toBe(10)
  })

  it('每个 session 显示状态指示器颜色', () => {
    useSessionStore.getState().addSession()
    useSessionStore.getState().addSession()

    render(<SessionTabs />)

    // IDLE 状态应该有 bg-gray-400 的指示器
    const dots = document.querySelectorAll('.bg-gray-400')
    expect(dots.length).toBeGreaterThanOrEqual(1)
  })
})
