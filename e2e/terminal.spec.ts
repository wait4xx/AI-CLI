/**
 * E2E 测试：WebSocket 终端交互
 * 覆盖连接 → 创建 session → 输入命令 → 接收输出
 *
 * 注意：WebSocket 测试需要后端服务运行且 JWT token 有效
 * 由于 Playwright 不直接支持 WS，使用 node:ws 进行连接测试
 */
import { test, expect } from '@playwright/test'
import { WebSocket } from 'ws'

const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123456'

/** 辅助：获取管理员 token */
async function getAdminToken(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const res = await request.post('http://localhost:3000/api/auth/login', {
    data: { username: ADMIN_USER, password: ADMIN_PASS },
  })
  const body = await res.json()
  return body.accessToken
}

test.describe('WebSocket 终端交互', () => {
  let accessToken: string

  test.beforeAll(async ({ request }) => {
    accessToken = await getAdminToken(request)
  })

  test('能建立 WebSocket 终端连接', async () => {
    const wsUrl = `ws://localhost:3000/ws/terminal?token=${accessToken}`
    const ws = new WebSocket(wsUrl)

    const connected = await new Promise<boolean>((resolve, reject) => {
      ws.on('open', () => {
        resolve(true)
      })
      ws.on('error', (err) => {
        reject(err)
      })
      setTimeout(() => resolve(false), 5000)
    })

    expect(connected).toBeTruthy()
    ws.close()
  })

  test('能建立 WebSocket 控制连接', async () => {
    const wsUrl = `ws://localhost:3000/ws/control?token=${accessToken}`
    const ws = new WebSocket(wsUrl)

    const connected = await new Promise<boolean>((resolve, reject) => {
      ws.on('open', () => {
        resolve(true)
      })
      ws.on('error', (err) => {
        reject(err)
      })
      setTimeout(() => resolve(false), 5000)
    })

    expect(connected).toBeTruthy()
    ws.close()
  })

  test('无效 token 无法连接 WebSocket', async () => {
    const wsUrl = 'ws://localhost:3000/ws/terminal?token=invalid-token'
    const ws = new WebSocket(wsUrl)

    const result = await new Promise<string>((resolve) => {
      ws.on('open', () => resolve('opened'))
      ws.on('error', () => resolve('error'))
      ws.on('close', () => resolve('closed'))
      setTimeout(() => resolve('timeout'), 5000)
    })

    // 无效 token 应该被拒绝（不会成功打开）
    expect(result).not.toBe('opened')
    ws.close()
  })

  test('终端连接后能接收初始数据', async () => {
    const wsUrl = `ws://localhost:3000/ws/terminal?token=${accessToken}`
    const ws = new WebSocket(wsUrl)

    // 等待连接
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve())
      ws.on('error', (err) => reject(err))
      setTimeout(() => reject(new Error('连接超时')), 5000)
    })

    // 等待接收消息（终端 prompt 等）
    const receivedMessage = await new Promise<boolean>((resolve) => {
      ws.on('message', () => {
        resolve(true)
      })
      setTimeout(() => resolve(false), 5000)
    })

    expect(receivedMessage).toBeTruthy()
    ws.close()
  })

  test('终端能发送输入并接收输出', async () => {
    const wsUrl = `ws://localhost:3000/ws/terminal?token=${accessToken}`
    const ws = new WebSocket(wsUrl)

    // 等待连接
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve())
      ws.on('error', (err) => reject(err))
      setTimeout(() => reject(new Error('连接超时')), 5000)
    })

    // 收集所有消息
    const messages: string[] = []
    ws.on('message', (data) => {
      messages.push(data.toString())
    })

    // 发送简单命令
    ws.send(JSON.stringify({ type: 'input', data: 'echo hello-e2e\n' }))

    // 等待输出
    await new Promise<void>((resolve) => {
      const check = () => {
        if (messages.some(m => m.includes('hello-e2e'))) {
          resolve()
        } else {
          setTimeout(check, 200)
        }
      }
      check()
      setTimeout(() => resolve(), 5000)
    })

    // 应该收到包含 hello-e2e 的输出
    expect(messages.some(m => m.includes('hello-e2e'))).toBeTruthy()
    ws.close()
  })
})
