/**
 * ConnectionOverlay 组件测试
 * 覆盖：断连状态渲染、重连中状态、连接成功时隐藏
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnectionOverlay } from '../components/ConnectionOverlay'

describe('ConnectionOverlay', () => {
  it('CONNECTED 状态时不渲染任何内容', () => {
    const { container } = render(
      <ConnectionOverlay phase="CONNECTED" reconnectCount={0} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('DISCONNECTED 状态显示断开连接消息', () => {
    render(<ConnectionOverlay phase="DISCONNECTED" reconnectCount={0} />)
    expect(screen.getByText('连接已断开')).toBeInTheDocument()
  })

  it('CONNECTING_TERM 状态显示终端连接消息', () => {
    render(<ConnectionOverlay phase="CONNECTING_TERM" reconnectCount={0} />)
    expect(screen.getByText('正在连接终端通道...')).toBeInTheDocument()
  })

  it('CONNECTING_CTRL 状态显示控制通道连接消息', () => {
    render(<ConnectionOverlay phase="CONNECTING_CTRL" reconnectCount={0} />)
    expect(screen.getByText('正在连接控制通道...')).toBeInTheDocument()
  })

  it('重连次数大于0时显示重连计数', () => {
    render(<ConnectionOverlay phase="CONNECTING_TERM" reconnectCount={3} />)
    expect(screen.getByText('第 3 次重连')).toBeInTheDocument()
  })

  it('重连次数为0时不显示重连计数', () => {
    render(<ConnectionOverlay phase="CONNECTING_TERM" reconnectCount={0} />)
    expect(screen.queryByText(/次重连/)).not.toBeInTheDocument()
  })

  it('有缓存屏幕且重连次数>0时显示缓存内容', () => {
    render(
      <ConnectionOverlay
        phase="CONNECTING_TERM"
        reconnectCount={1}
        cachedScreen="$ ls\nfile1.txt"
      />
    )
    expect(screen.getByText(/\$ ls/)).toBeInTheDocument()
  })

  it('有缓存屏幕但首次连接时不显示缓存', () => {
    render(
      <ConnectionOverlay
        phase="CONNECTING_TERM"
        reconnectCount={0}
        cachedScreen="$ ls\nfile1.txt"
      />
    )
    // 缓存背景只在 reconnectCount > 0 时显示
    // pointer-events-none 的 pre 元素不应存在
    const pre = screen.queryByText(/\$ ls/)
    expect(pre).not.toBeInTheDocument()
  })

  it('覆盖层有正确的 z-index 和样式', () => {
    const { container } = render(
      <ConnectionOverlay phase="DISCONNECTED" reconnectCount={0} />
    )
    const overlay = container.firstChild as HTMLElement
    expect(overlay.className).toContain('z-10')
    expect(overlay.className).toContain('absolute')
    expect(overlay.className).toContain('inset-0')
  })
})
