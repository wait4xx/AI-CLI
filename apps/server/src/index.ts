import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import path from 'path'
import fs from 'fs/promises'
import authPlugin from './plugins/auth.js'
import { authRoutes, ensureAdminUser } from './routes/auth.js'
import { ClaudeCodeAdapter } from './adapters/claude.js'
import { AiderAdapter } from './adapters/aider.js'
import { ShellAdapter } from './adapters/shell.js'
import { SessionManager } from './core/SessionManager.js'
import { terminalRoutes } from './routes/terminal.js'
import { controlRoutes } from './routes/control.js'
import { fsRoutes } from './routes/fs.js'
import { pinoLogger } from './lib/logger.js'
import { validateConfig } from './lib/config.js'
import { WSGateway } from './core/WSGateway.js'
import { closeAuditLog } from './core/audit.js'

const fastify = Fastify({ loggerInstance: pinoLogger })
let serverStarted = false
let sessionManager: SessionManager | null = null

async function start() {
  // [M14修复] 启动时使用 zod 校验所有环境变量，失败则打印详细错误并退出
  let config
  try {
    config = validateConfig()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    pinoLogger.fatal(message)
    process.exit(1)
  }

  // [W1修复] CORS 白名单：从环境变量 CORS_ORIGINS 读取，多个 origin 用逗号分隔，开发模式下允许所有
  const corsOrigins = config.CORS_ORIGINS
  if (corsOrigins) {
    await fastify.register(cors, {
      origin: corsOrigins.split(',').map(s => s.trim()),
    })
  } else {
    await fastify.register(cors, { origin: true })
  }
  // [S8修复] 添加 Helmet 安全中间件，配置生产环境 CSP
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
  await fastify.register(websocket)
  await fastify.register(authPlugin)

  // 注册 Swagger/OpenAPI 文档插件
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'AI-CLI Mobile API',
        description: 'Mobile AI Programming CLI Gateway 后端 API 文档',
        version: '0.1.0',
      },
      servers: [
        { url: 'http://localhost:3000', description: '开发环境' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  })

  await fastify.register(authRoutes, { prefix: '/api/auth' })

  // Adapters
  const adapters = new Map<string, import('./adapters/base.js').CLIAdapter>()
  adapters.set('claude', new ClaudeCodeAdapter())
  adapters.set('aider', new AiderAdapter())
  adapters.set('shell', new ShellAdapter())

  // Session Manager
  sessionManager = new SessionManager(adapters)

  // WS Gateway
  // [R9] Use Fastify's type-safe decorate() instead of `as any` cast
  const wsGateway = new WSGateway(
    sessionManager,
    config.JWT_SECRET,
    config.JWT_REFRESH_SECRET,
  )
  fastify.decorate('wsGateway', wsGateway)
  fastify.decorate('sessionManager', sessionManager)

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
      try {
        reply.type('text/html').sendFile('index.html')
      } catch {
        reply.code(404).send({ error: 'Not found' })
      }
    })
  } catch {
    // web/dist doesn't exist (dev mode), skip static serving
  }

  // [W18修复] 移除 timestamp 避免信息泄露
  fastify.get('/health', {
    schema: {
      summary: '健康检查',
      description: '返回服务健康状态',
      security: [],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
          },
        },
      },
    },
  }, async () => ({ status: 'ok' }))

  await ensureAdminUser()

  const port = config.PORT

  try {
    await fastify.listen({ port, host: '0.0.0.0' })
    serverStarted = true
    pinoLogger.info({ port }, 'Server listening')
  } catch (err) {
    pinoLogger.error(err, 'Failed to start server')
    process.exit(1)
  }
}

async function shutdown() {
  // [R9] Destroy WSGateway to clear keep-alive timers (type-safe via fastify.d.ts)
  const gateway = fastify.wsGateway
  if (gateway) {
    gateway.destroy()
  }
  if (sessionManager) {
    sessionManager.destroy()
  }
  // Flush and close audit log stream (awaits completion)
  await closeAuditLog()
  if (serverStarted) {
    await fastify.close()
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
process.on('unhandledRejection', (reason) => {
  pinoLogger.error({ err: reason }, 'Unhandled promise rejection')
})

start()
