/**
 * Regression test: /ws/chat must be in the auth-plugin whitelist.
 *
 * WS upgrades carry the token in the ?token= query param (verified by
 * verifyWsUpgradeToken at the route), NOT in an Authorization header. So the
 * onRequest bearer middleware must skip /ws/chat, or the upgrade is rejected
 * with 401. Found via a real /ws/chat smoke test.
 */
import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'

process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters'
process.env.DATA_DIR = '/tmp/ai-cli-auth-ws-whitelist-test'

vi.mock('../lib/logger.js', () => ({
  pinoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))

import authPlugin from '../plugins/auth.js'

describe('Auth plugin — WS route whitelist', () => {
  it('allows /ws/chat without an Authorization header', async () => {
    const app = Fastify()
    await app.register(authPlugin)
    app.get('/ws/chat', async () => 'ok')
    app.get('/api/secret', async () => 'ok')

    const chat = await app.inject({ method: 'GET', url: '/ws/chat' })
    expect(chat.statusCode).toBe(200)

    const secret = await app.inject({ method: 'GET', url: '/api/secret' })
    expect(secret.statusCode).toBe(401)

    await app.close()
  })

  it('also allows the other WS routes without an Authorization header', async () => {
    const app = Fastify()
    await app.register(authPlugin)
    app.get('/ws/terminal', async () => 'ok')
    app.get('/ws/control', async () => 'ok')

    expect((await app.inject({ method: 'GET', url: '/ws/terminal' })).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: '/ws/control' })).statusCode).toBe(200)

    await app.close()
  })
})
