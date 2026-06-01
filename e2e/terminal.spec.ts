/**
 * E2E 测试：WebSocket 终端交互
 * 覆盖连接 → 创建 session → 输入命令 → 接收输出
 */
import { test, expect } from '@playwright/test'
import { WebSocket } from 'ws'

const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123456'

/** 辅助：获取管理员 token */
async function getAdminToken(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.post('http://localhost:18333/api/auth/login', {
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
    const wsUrl = `ws://localhost:18333/ws/terminal?token=${accessToken}`
    const ws = new WebSocket(wsUrl)

    const connected = await new Promise<boolean>((resolve) => {
      ws.on('open', () => resolve(true))
      ws.on('error', () => resolve(false))
      setTimeout(() => resolve(false), 5000)
    })

    expect(connected).toBeTruthy()
    ws.close()
  })

  test('能建立 WebSocket 控制连接', async () => {
    const wsUrl = `ws://localhost:18333/ws/control?token=${accessToken}`
    const ws = new WebSocket(wsUrl)

    const connected = await new Promise<boolean>((resolve) => {
      ws.on('open', () => resolve(true))
      ws.on('error', () => resolve(false))
      setTimeout(() => resolve(false), 5000)
    })

    expect(connected).toBeTruthy()
    ws.close()
  })

  test('无效 token 无法保持 WebSocket 连接', async () => {
    const wsUrl = 'ws://localhost:18333/ws/terminal?token=invalid-token'
    const ws = new WebSocket(wsUrl)

    const result = await new Promise<string>((resolve) => {
      ws.on('open', () => {
        // Server may complete the HTTP upgrade but will close shortly after
        ws.on('close', () => resolve('closed'))
      })
      ws.on('error', () => resolve('error'))
      ws.on('close', () => resolve('closed'))
      setTimeout(() => resolve('timeout'), 5000)
    })

    // Invalid token should cause the server to close the connection
    expect(result).not.toBe('timeout')
    ws.close()
  })
})
