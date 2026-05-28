/**
 * StatusBar 组件测试
 * 覆盖：连接状态显示（已连接/断开）、agent 状态标签、session label 渲染
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../components/StatusBar'
import { useSessionStore } from '../store/sessionStore'

describe('StatusBar', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it('断开连接时显示红色指示灯', () => {
    render(<StatusBar />)
    // 断开状态是默认值
    const dot = document.querySelector('.bg-red-500')
    expect(dot).toBeInTheDocument()
  })

  it('已连接时显示绿色指示灯', () => {
    useSessionStore.getState().setConnected('CONNECTED')
    render(<StatusBar />)
    const dot = document.querySelector('.bg-green-500')
    expect(dot).toBeInTheDocument()
  })

  it('连接中时显示黄色指示灯', () => {
    useSessionStore.getState().setConnected('CONNECTING_TERM')
    render(<StatusBar />)
    const dot = document.querySelector('.bg-yellow-500')
    expect(dot).toBeInTheDocument()
  })

  it('显示当前 agent 状态标签（IDLE）', () => {
    render(<StatusBar />)
    expect(screen.getByText('IDLE')).toBeInTheDocument()
  })

  it('显示 RUNNING 状态时带旋转图标', () => {
    useSessionStore.getState().setAgentStatus('RUNNING')
    render(<StatusBar />)
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
  })

  it('显示 WAITING_APPROVAL 状态', () => {
    useSessionStore.getState().setAgentStatus('WAITING_APPROVAL')
    render(<StatusBar />)
    expect(screen.getByText('APPROVAL')).toBeInTheDocument()
  })

  it('显示 ERROR 状态', () => {
    useSessionStore.getState().setAgentStatus('ERROR')
    render(<StatusBar />)
    expect(screen.getByText('ERROR')).toBeInTheDocument()
  })

  it('显示当前活跃 session 的 label', () => {
    useSessionStore.getState().setSession('my-session-123')
    render(<StatusBar />)
    // sessionStore 使用 id.slice(0, 8) 作为 label
    expect(screen.getByText('my-sessi')).toBeInTheDocument()
  })

  it('无活跃 session 时不显示 label', () => {
    render(<StatusBar />)
    // 没有 session 时不应有 truncate 元素
    const label = screen.queryByText(/my-sess/)
    expect(label).not.toBeInTheDocument()
  })

  it('渲染 actionsSlot 插槽', () => {
    render(<StatusBar actionsSlot={<button>自定义按钮</button>} />)
    expect(screen.getByText('自定义按钮')).toBeInTheDocument()
  })
})
