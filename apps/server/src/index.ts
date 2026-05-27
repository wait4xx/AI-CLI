import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import path from 'path'
import fs from 'fs/promises'
import authPlugin from './plugins/auth.js'
import { authRoutes, ensureAdminUser } from './routes/auth.js'
import { ClaudeCodeAdapter } from './adapters/claude.js'
import { AiderAdapter } from './adapters/aider.js'
import { ShellAdapter } from './adapters/shell.js'
import { SessionManager } from './core/SessionManager.js'
import { WSGateway } from './core/WSGateway.js'
import { terminalRoutes } from './routes/terminal.js'
import { controlRoutes } from './routes/control.js'
import { fsRoutes } from './routes/fs.js'
import { pinoLogger } from './lib/logger.js'

const fastify = Fastify({ logger: pinoLogger as any })
let serverStarted = false

async function start() {
  if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
    pinoLogger.fatal('JWT_SECRET and JWT_REFRESH_SECRET must be set')
    process.exit(1)
  }

  // [W1修复] CORS 白名单：从环境变量 CORS_ORIGINS 读取，多个 origin 用逗号分隔，开发模式下允许所有
  const corsOrigins = process.env.CORS_ORIGINS
  if (corsOrigins) {
    await fastify.register(cors, {
      origin: corsOrigins.split(',').map(s => s.trim()),
    })
  } else {
    await fastify.register(cors, { origin: true })
  }
  // [S8修复] 添加 Helmet 安全中间件
  await fastify.register(helmet)
  await fastify.register(websocket)
  await fastify.register(authPlugin)

  await fastify.register(authRoutes, { prefix: '/api/auth' })

  // Adapters
  const adapters = new Map()
  adapters.set('claude', new ClaudeCodeAdapter())
  adapters.set('aider', new AiderAdapter())
  adapters.set('shell', new ShellAdapter())

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

  // [W18修复] 移除 timestamp 避免信息泄露
  fastify.get('/health', async () => ({ status: 'ok' }))

  ensureAdminUser()

  const port = parseInt(process.env.PORT || '3000', 10)

  try {
    await fastify.listen({ port, host: '0.0.0.0' })
    serverStarted = true
    pinoLogger.info({ port }, 'Server listening')
  } catch (err) {
    pinoLogger.error(err, 'Failed to start server')
    process.exit(1)
  }
}

process.on('SIGINT', async () => {
  if (serverStarted) {
    await fastify.close()
  }
  process.exit(0)
})
process.on('SIGTERM', async () => {
  if (serverStarted) {
    await fastify.close()
  }
  process.exit(0)
})

start()
