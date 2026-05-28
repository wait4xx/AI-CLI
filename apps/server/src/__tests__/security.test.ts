import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import fs from 'fs/promises'
import path from 'path'
import authPlugin from '../plugins/auth.js'
import { fsRoutes } from '../routes/fs.js'
import jwt from 'jsonwebtoken'

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'
process.env.PROJECT_ROOT = '/tmp/ai-cli-security-test-workspace'

const TEST_DIR = '/tmp/ai-cli-security-test-workspace'
const SECRET_FILE = path.join(TEST_DIR, 'secret.txt')

describe('Security', () => {
  let app: Fastify.FastifyInstance
  let validToken: string

  beforeAll(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true })
    await fs.writeFile(SECRET_FILE, 'this is a secret', 'utf-8')
    // Create a subdirectory with a file
    await fs.mkdir(path.join(TEST_DIR, 'public'), { recursive: true })
    await fs.writeFile(path.join(TEST_DIR, 'public', 'info.txt'), 'public info', 'utf-8')

    app = Fastify()
    await app.register(authPlugin)
    await app.register(fsRoutes, { prefix: '/api/fs' })
    await app.ready()

    validToken = jwt.sign(
      { userId: '1', username: 'test' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    )
  })

  afterAll(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true })
  })

  // === Auth tests ===

  it('should reject expired JWT', async () => {
    const expiredToken = jwt.sign(
      { userId: '1', username: 'test' },
      process.env.JWT_SECRET!,
      { expiresIn: '-1s' },
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

  // === Path traversal tests ===

  it('should reject path traversal with ../', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file',
      query: { path: '../../../etc/passwd' },
      headers: { authorization: `Bearer ${validToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('should reject path traversal with absolute path outside root', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file',
      query: { path: '/etc/passwd' },
      headers: { authorization: `Bearer ${validToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('should reject path traversal via tree endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/tree',
      query: { path: '../../' },
      headers: { authorization: `Bearer ${validToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('should allow access to files within root', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file',
      query: { path: 'secret.txt' },
      headers: { authorization: `Bearer ${validToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().content).toBe('this is a secret')
  })

  it('should allow access to nested files within root', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file',
      query: { path: 'public/info.txt' },
      headers: { authorization: `Bearer ${validToken}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().content).toBe('public info')
  })

  it('should reject null byte in path', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/fs/file',
      query: { path: 'secret.txt\0.jpg' },
      headers: { authorization: `Bearer ${validToken}` },
    })
    expect(res.statusCode).toBe(403)
  })

  // === File write security ===

  it('should reject writing dangerous file types (.exe)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/fs/file',
      headers: { authorization: `Bearer ${validToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'malware.exe', content: 'MZ' }),
    })
    expect(res.statusCode).toBe(403)
  })

  it('should reject writing .bat files', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/fs/file',
      headers: { authorization: `Bearer ${validToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'script.bat', content: '@echo off' }),
    })
    expect(res.statusCode).toBe(403)
  })

  it('should reject writing files with path traversal', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/fs/file',
      headers: { authorization: `Bearer ${validToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ path: '../../tmp/evil.txt', content: 'hacked' }),
    })
    expect(res.statusCode).toBe(403)
  })

  it('should reject oversized content', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/fs/file',
      headers: { authorization: `Bearer ${validToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'big.txt', content: 'x'.repeat(1048577) }),
    })
    expect(res.statusCode).toBe(413)
  })

  it('should allow writing code files (.ts)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/fs/file',
      headers: { authorization: `Bearer ${validToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ path: 'test.ts', content: 'console.log("hello")' }),
    })
    expect(res.statusCode).toBe(200)

    // Verify it was written
    const readRes = await app.inject({
      method: 'GET',
      url: '/api/fs/file',
      query: { path: 'test.ts' },
      headers: { authorization: `Bearer ${validToken}` },
    })
    expect(readRes.json().content).toBe('console.log("hello")')
  })
})
