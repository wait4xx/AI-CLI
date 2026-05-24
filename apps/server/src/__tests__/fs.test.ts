import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import fs from 'fs/promises'
import authPlugin from '../plugins/auth.js'
import { authRoutes, ensureAdminUser } from '../routes/auth.js'
import { fsRoutes } from '../routes/fs.js'

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'
process.env.ADMIN_USERNAME = 'admin'
process.env.ADMIN_PASSWORD = 'testpassword123'
process.env.PROJECT_ROOT = '/tmp/ai-cli-test-workspace'

let accessToken: string

async function buildServer() {
  const app = Fastify()
  await app.register(authPlugin)
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(fsRoutes, { prefix: '/api/fs' })
  await app.ready()
  return app
}

describe('FS Routes', () => {
  let app: Fastify.FastifyInstance

  beforeAll(async () => {
    // Create test workspace
    await fs.mkdir('/tmp/ai-cli-test-workspace', { recursive: true })
    await fs.writeFile('/tmp/ai-cli-test-workspace/test.txt', 'hello world')
    await fs.mkdir('/tmp/ai-cli-test-workspace/subdir', { recursive: true })
    await fs.writeFile('/tmp/ai-cli-test-workspace/subdir/nested.py', 'print("hi")')

    app = await buildServer()
    ensureAdminUser()

    // Get access token
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'testpassword123' },
    })
    accessToken = loginRes.json().accessToken
  })

  afterAll(async () => {
    // Don't remove workspace — security.test.ts may still need it
  })

  it('should list directory contents', async () => {
    await fs.mkdir('/tmp/ai-cli-test-workspace', { recursive: true })
    await fs.writeFile('/tmp/ai-cli-test-workspace/test.txt', 'hello world')

    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/tree',
      query: { path: '' },
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.entries).toBeDefined()
    expect(body.entries.length).toBeGreaterThan(0)
  })

  it('should read file content', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file?path=test.txt',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.content).toBe('hello world')
    expect(body.language).toBe('text')
  })

  it('should detect language from extension', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file?path=subdir/nested.py',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().language).toBe('python')
  })

  it('should block path traversal', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file?path=../../../etc/passwd',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('should return 404 for non-existent file', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file?path=nonexistent.txt',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('should require auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/tree?path=',
    })
    expect(res.statusCode).toBe(401)
  })
})
