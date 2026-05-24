import { describe, it, expect, beforeAll } from 'vitest'
import Fastify from 'fastify'
import fs from 'fs/promises'
import authPlugin from '../plugins/auth.js'
import { fsRoutes } from '../routes/fs.js'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'
process.env.PROJECT_ROOT = '/tmp/ai-cli-test-workspace'

describe('Security', () => {
  let app: Fastify.FastifyInstance

  beforeAll(async () => {
    await fs.mkdir('/tmp/ai-cli-test-workspace', { recursive: true })
    app = Fastify()
    await app.register(authPlugin)
    await app.register(fsRoutes, { prefix: '/api/fs' })
    await app.ready()
  })

  it('should reject expired JWT', async () => {
    const expiredToken = jwt.sign(
      { userId: '1', username: 'test' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' }
    )

    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/tree',
      query: { path: '' },
      headers: { authorization: `Bearer ${expiredToken}` },
    })
    expect(res.statusCode).toBe(401)
  })

  it('should reject malformed JWT', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/tree',
      query: { path: '' },
      headers: { authorization: 'Bearer not.a.valid.jwt' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('should reject requests without auth header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/tree',
      query: { path: '' },
    })
    expect(res.statusCode).toBe(401)
  })
})
