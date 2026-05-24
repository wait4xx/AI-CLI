import { describe, it, expect, beforeAll } from 'vitest'
import Fastify from 'fastify'
import authPlugin from '../plugins/auth.js'
import { authRoutes, ensureAdminUser } from '../routes/auth.js'

// 设置环境变量（测试前）
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'testpassword123'

async function buildServer() {
  const app = Fastify()
  await app.register(authPlugin)
  await app.register(authRoutes, { prefix: '/api/auth' })
  return app
}

describe('Auth Routes', () => {
  let app: Fastify.FastifyInstance

  beforeAll(async () => {
    app = await buildServer()
    ensureAdminUser()
  })

  it('should login with correct credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'testpassword123' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBeDefined()
    expect(body.refreshToken).toBeDefined()
  })

  it('should reject wrong password', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrongpassword' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('should reject missing fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    })
    expect(res.statusCode).toBe(400)
  })

  it('should refresh token with valid refreshToken', async () => {
    // First login to get tokens
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'testpassword123' },
    })
    const { refreshToken } = loginRes.json()

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.accessToken).toBeDefined()
  })

  it('should reject invalid refreshToken', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'invalid-token' },
    })
    expect(res.statusCode).toBe(401)
  })
})
