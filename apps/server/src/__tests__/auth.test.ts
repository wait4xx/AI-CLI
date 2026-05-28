import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import Fastify from 'fastify'
import authPlugin from '../plugins/auth.js'
import { authRoutes, ensureAdminUser } from '../routes/auth.js'
import { createUser, deleteUser } from '../plugins/auth.js'

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
    await ensureAdminUser()
  })

  beforeEach(async () => {
    app = await buildServer()
  })

  // === Login ===

  describe('POST /login', () => {
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

    it('should reject non-existent user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'ghost', password: 'whatever' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('should return valid JWT tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const body = res.json()
      // Tokens should be strings with 3 parts (header.payload.signature)
      expect(body.accessToken.split('.')).toHaveLength(3)
      expect(body.refreshToken.split('.')).toHaveLength(3)
    })
  })

  // === Refresh ===

  describe('POST /refresh', () => {
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

    it('should reject missing refreshToken', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })
  })

  // === User Management (Admin CRUD) ===

  describe('GET /users (admin)', () => {
    it('should list users for admin', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.users).toBeDefined()
      expect(Array.isArray(body.users)).toBe(true)
      // Users should not contain passwordHash
      for (const user of body.users) {
        expect(user).not.toHaveProperty('passwordHash')
      }
    })

    it('should reject non-admin users', async () => {
      // First create a non-admin user
      const adminLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const adminToken = adminLogin.json().accessToken

      await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { username: 'regularuser', password: 'password123' },
      })

      // Login as regular user
      const userLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'regularuser', password: 'password123' },
      })
      const userToken = userLogin.json().accessToken

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(403)

      // Cleanup
      deleteUser('regularuser')
    })

    it('should reject unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/users',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /users (admin)', () => {
    it('should create a new user', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'newuser', password: 'password123' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.username).toBe('newuser')
      expect(body).not.toHaveProperty('passwordHash')
      expect(body.userId).toBeDefined()

      // Cleanup
      deleteUser('newuser')
    })

    it('should reject duplicate username', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'admin', password: 'password123' },
      })
      expect(res.statusCode).toBe(409)
    })

    it('should reject short username (< 2 chars)', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'a', password: 'password123' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should reject long username (> 32 chars)', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'a'.repeat(33), password: 'password123' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should reject username with special characters', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'user@evil', password: 'password123' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should reject short password (< 6 chars)', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'validuser', password: '12345' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should reject missing username or password', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res1 = await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { password: 'password123' },
      })
      expect(res1.statusCode).toBe(400)

      const res2 = await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'validuser' },
      })
      expect(res2.statusCode).toBe(400)
    })
  })

  describe('DELETE /users/:username (admin)', () => {
    it('should delete a user', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      // Create user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'todelete', password: 'password123' },
      })

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/auth/users/todelete',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json().success).toBe(true)
    })

    it('should reject deleting non-existent user', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/auth/users/nonexistent',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(res.statusCode).toBe(404)
    })

    it('should reject self-deletion', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/auth/users/admin',
        headers: { authorization: `Bearer ${accessToken}` },
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('PUT /users/:username/password (admin)', () => {
    it('should change a user password', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      // Create user first
      await app.inject({
        method: 'POST',
        url: '/api/auth/users',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { username: 'pwchange', password: 'password123' },
      })

      const res = await app.inject({
        method: 'PUT',
        url: '/api/auth/users/pwchange/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { newPassword: 'newpassword456' },
      })
      expect(res.statusCode).toBe(200)

      // Login with new password should work
      const newLogin = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'pwchange', password: 'newpassword456' },
      })
      expect(newLogin.statusCode).toBe(200)

      // Cleanup
      deleteUser('pwchange')
    })

    it('should reject short new password', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'PUT',
        url: '/api/auth/users/admin/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { newPassword: '12345' },
      })
      expect(res.statusCode).toBe(400)
    })

    it('should reject missing new password', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'PUT',
        url: '/api/auth/users/admin/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {},
      })
      expect(res.statusCode).toBe(400)
    })

    it('should reject non-existent user', async () => {
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { username: 'admin', password: 'testpassword123' },
      })
      const { accessToken } = loginRes.json()

      const res = await app.inject({
        method: 'PUT',
        url: '/api/auth/users/nonexistent/password',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { newPassword: 'newpassword456' },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
