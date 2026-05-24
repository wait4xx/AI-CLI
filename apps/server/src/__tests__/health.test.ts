import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'

describe('Health endpoint', () => {
  it('should return ok status', async () => {
    const app = Fastify()
    app.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }))

    const res = await app.inject({
      method: 'GET',
      url: '/health',
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('ok')
    expect(res.json().timestamp).toBeDefined()
  })
})
