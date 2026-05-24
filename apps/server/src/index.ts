import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import path from 'path'
import fs from 'fs/promises'
import authPlugin from './plugins/auth.js'
import { authRoutes, ensureAdminUser } from './routes/auth.js'
import { ClaudeCodeAdapter } from './adapters/claude.js'
import { SessionManager } from './core/SessionManager.js'
import { WSGateway } from './core/WSGateway.js'
import { terminalRoutes } from './routes/terminal.js'
import { controlRoutes } from './routes/control.js'
import { fsRoutes } from './routes/fs.js'

const fastify = Fastify({ logger: true })

async function start() {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    console.error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be set')
    process.exit(1)
  }

  await fastify.register(cors, { origin: true })
  await fastify.register(websocket)
  await fastify.register(authPlugin)

  await fastify.register(authRoutes, { prefix: '/api/auth' })

  // Adapters
  const adapters = new Map()
  adapters.set('claude', new ClaudeCodeAdapter())

  // Session Manager
  const sessionManager = new SessionManager(adapters)

  // WS Gateway
  const wsGateway = new WSGateway(
    sessionManager,
    process.env.JWT_SECRET!,
    process.env.JWT_REFRESH_SECRET!,
  )
  ;(fastify as any).wsGateway = wsGateway

  // WS Routes (registered after gateway is attached)
  await fastify.register(terminalRoutes)
  await fastify.register(controlRoutes)
  await fastify.register(fsRoutes, { prefix: '/api/fs' })

  // Serve frontend static files (production only)
  const webDistPath = path.resolve(import.meta.dirname, '../../web/dist')
  try {
    await fs.access(webDistPath)
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    })
    // SPA fallback: all non-API, non-WS routes serve index.html
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/ws')) {
        reply.code(404).send({ error: 'Not found' })
        return
      }
      reply.type('text/html').sendFile('index.html')
    })
  } catch {
    // web/dist doesn't exist (dev mode), skip static serving
  }

  fastify.get('/health', async () => ({ status: 'ok', timestamp: Date.now() }))

  ensureAdminUser()

  const port = parseInt(process.env.PORT || '3000', 10)

  try {
    await fastify.listen({ port, host: '0.0.0.0' })
    console.log(`Server listening on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  await fastify.close()
  process.exit(0)
})
process.on('SIGTERM', async () => {
  await fastify.close()
  process.exit(0)
})

start()
