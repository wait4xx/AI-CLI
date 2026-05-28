/**
 * LoginForm 组件测试
 * 覆盖：渲染表单、输入用户名密码、提交、错误提示显示
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../components/LoginForm'

describe('LoginForm', () => {
  it('应渲染登录表单', () => {
    const onLogin = vi.fn()
    render(<LoginForm onLogin={onLogin} />)

    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
    expect(screen.getByText('AI CLI Mobile')).toBeInTheDocument()
  })

  it('输入用户名和密码后提交按钮可用', async () => {
    const onLogin = vi.fn()
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')

    const submitBtn = screen.getByRole('button', { name: '登录' })
    expect(submitBtn).toBeEnabled()
  })

  it('空用户名/密码时提交按钮禁用', () => {
    const onLogin = vi.fn()
    render(<LoginForm onLogin={onLogin} />)

    const submitBtn = screen.getByRole('button', { name: '登录' })
    expect(submitBtn).toBeDisabled()
  })

  it('密码不足6位时显示错误提示', async () => {
    const onLogin = vi.fn()
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), '12345') // 5位
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(screen.getByText(/密码长度不能少于 6 位/)).toBeInTheDocument()
    expect(onLogin).not.toHaveBeenCalled()
  })

  it('有效输入提交时调用 onLogin', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(onLogin).toHaveBeenCalledWith('testuser', 'password123')
  })

  it('onLogin 抛出错误时显示错误消息', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  it('提交中时按钮显示加载状态', async () => {
    // 创建一个永不 resolve 的 promise 来模拟加载状态
    let resolveLogin: () => void = () => {}
    const onLogin = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveLogin = resolve }))
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(screen.getByText('登录中...')).toBeInTheDocument()
    resolveLogin()
  })
})
