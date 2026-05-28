/**
 * E2E 测试：认证流程
 * 覆盖注册 → 登录 → 获取 token → 刷新 token → 验证 token 有效
 */
import { test, expect } from '@playwright/test'

// 管理员凭证（与 playwright.config.ts 中环境变量一致）
const ADMIN_USER = 'admin'
const ADMIN_PASS = 'admin123456'

test.describe('认证流程', () => {
  const testUser = `e2e_user_${Date.now()}`
  const testPassword = 'test123456'

  test('管理员登录并获取 token', async ({ request }) => {
    // 管理员登录
    const loginRes = await request.post('http://localhost:3000/api/auth/login', {
      data: { username: ADMIN_USER, password: ADMIN_PASS },
    })
    expect(loginRes.ok()).toBeTruthy()
    const body = await loginRes.json()
    expect(body.accessToken).toBeDefined()
    expect(body.refreshToken).toBeDefined()
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
  })

  test('登录失败时返回 401', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/auth/login', {
      data: { username: ADMIN_USER, password: 'wrong-password' },
    })
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  test('缺少字段时返回 400', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/auth/login', {
      data: { username: ADMIN_USER },
    })
    expect(res.status()).toBe(400)
  })

  test('刷新 token', async ({ request }) => {
    // 先登录获取 token
    const loginRes = await request.post('http://localhost:3000/api/auth/login', {
      data: { username: ADMIN_USER, password: ADMIN_PASS },
    })
    const { refreshToken } = await loginRes.json()

    // 使用 refresh token 获取新的 access token
    const refreshRes = await request.post('http://localhost:3000/api/auth/refresh', {
      data: { refreshToken },
    })
    expect(refreshRes.ok()).toBeTruthy()
    const refreshBody = await refreshRes.json()
    expect(refreshBody.accessToken).toBeDefined()
  })

  test('无效 refresh token 返回 401', async ({ request }) => {
    const res = await request.post('http://localhost:3000/api/auth/refresh', {
      data: { refreshToken: 'invalid-token' },
    })
    expect(res.status()).toBe(401)
  })

  test('管理员创建用户 → 新用户登录 → 验证有效', async ({ request }) => {
    // 1. 管理员登录
    const adminLogin = await request.post('http://localhost:3000/api/auth/login', {
      data: { username: ADMIN_USER, password: ADMIN_PASS },
    })
    const { accessToken } = await adminLogin.json()

    // 2. 创建新用户
    const createRes = await request.post('http://localhost:3000/api/auth/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { username: testUser, password: testPassword },
    })
    expect(createRes.status()).toBe(201)
    const created = await createRes.json()
    expect(created.username).toBe(testUser)

    // 3. 新用户登录
    const userLogin = await request.post('http://localhost:3000/api/auth/login', {
      data: { username: testUser, password: testPassword },
    })
    expect(userLogin.ok()).toBeTruthy()
    const userTokens = await userLogin.json()
    expect(userTokens.accessToken).toBeDefined()

    // 4. 验证 token 可访问受保护路由（如获取用户列表应返回 403，因为不是管理员）
    const protectedRes = await request.get('http://localhost:3000/api/auth/users', {
      headers: { Authorization: `Bearer ${userTokens.accessToken}` },
    })
    // 非管理员访问管理员接口应返回 403
    expect(protectedRes.status()).toBe(403)
  })

  test('管理员可列出用户', async ({ request }) => {
    const loginRes = await request.post('http://localhost:3000/api/auth/login', {
      data: { username: ADMIN_USER, password: ADMIN_PASS },
    })
    const { accessToken } = await loginRes.json()

    const usersRes = await request.get('http://localhost:3000/api/auth/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(usersRes.ok()).toBeTruthy()
    const body = await usersRes.json()
    expect(Array.isArray(body.users)).toBeTruthy()
    // 至少有 admin 用户
    expect(body.users.length).toBeGreaterThanOrEqual(1)
  })

  test('无 token 访问受保护路由返回 401', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/auth/users')
    expect(res.status()).toBe(401)
  })

  test('健康检查端点', async ({ request }) => {
    const res = await request.get('http://localhost:3000/health')
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})
