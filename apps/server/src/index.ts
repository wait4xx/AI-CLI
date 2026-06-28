import dotenv from 'dotenv'
import path from 'path'
// 显式指定 monorepo 根目录的 .env，无论从哪个目录启动都能正确加载
dotenv.config({ path: path.resolve(import.meta.dirname, '../../../.env') })
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import authPlugin, { loadUsers } from './plugins/auth.js'
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
import { FileWatcher } from './core/FileWatcher.js'
import { closeAuditLog } from './core/audit.js'
import { ConversationManager } from './chat/ConversationManager.js'
import { ChatGateway } from './chat/ChatGateway.js'
import { ClaudeCodeProvider } from './chat/ClaudeCodeProvider.js'
import { chatRoutes } from './routes/chat.js'

const fastify = Fastify({ loggerInstance: pinoLogger })
let serverStarted = false
let sessionManager: SessionManager | null = null
let fileWatcher: FileWatcher | null = null

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

  // Ensure DATA_DIR exists for runtime data files
  const dataDir = config.DATA_DIR
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }

  // [W1修复] CORS 白名单：从环境变量 CORS_ORIGINS 读取，多个 origin 用逗号分隔，开发模式下允许所有
  const corsOrigins = config.CORS_ORIGINS
  if (corsOrigins) {
    await fastify.register(cors, {
      origin: corsOrigins.split(',').map((s) => s.trim()),
    })
  } else if (config.NODE_ENV === 'development') {
    await fastify.register(cors, { origin: true })
  } else {
    // Production without CORS_ORIGINS: only same-origin
    await fastify.register(cors, { origin: false })
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
  await fastify.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })
  await fastify.register(authPlugin)
  // [M-#5修复] 异步加载用户数据，避免同步阻塞事件循环
  await loadUsers()

  // 注册 Swagger/OpenAPI 文档插件（仅开发环境启用，生产环境禁用）
  const isDev = config.NODE_ENV !== 'production'
  if (isDev) {
    await fastify.register(swagger, {
      openapi: {
        openapi: '3.0.0',
        info: {
          title: 'AI-CLI Mobile API',
          description: 'Mobile AI Programming CLI Gateway 后端 API 文档',
          version: '0.1.0',
        },
        servers: [{ url: 'http://localhost:18333', description: '开发环境' }],
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
  }

  await fastify.register(authRoutes, { prefix: '/api/auth' })

  // Adapters
  const adapters = new Map<string, import('./adapters/base.js').CLIAdapter>()
  adapters.set('claude', new ClaudeCodeAdapter())
  adapters.set('aider', new AiderAdapter())
  adapters.set('shell', new ShellAdapter())

  // Session Manager
  sessionManager = new SessionManager(adapters)
  // [M-#5修复] 异步初始化：加载持久化会话、检查 tmux、清理孤儿会话
  await sessionManager.init()

  // WS Gateway
  // [R9] Use Fastify's type-safe decorate() instead of `as any` cast
  const wsGateway = new WSGateway(sessionManager, config.JWT_SECRET, config.JWT_REFRESH_SECRET)
  fastify.decorate('wsGateway', wsGateway)
  fastify.decorate('sessionManager', sessionManager)

  // Chat Gateway — WebSocket handler for /ws/chat
  const conversationManager = new ConversationManager()
  conversationManager.registerProvider(new ClaudeCodeProvider())
  const chatGateway = new ChatGateway(
    conversationManager,
    config.JWT_SECRET,
    config.JWT_REFRESH_SECRET,
  )
  fastify.decorate('chatGateway', chatGateway)
  fastify.decorate('conversationManager', conversationManager)

  // File watcher — broadcast changes to control WS clients
  fileWatcher = new FileWatcher()
  fileWatcher.start((event) => wsGateway.broadcastFileChange(event))

  // WS Routes (registered after gateway is attached)
  await fastify.register(terminalRoutes)
  await fastify.register(controlRoutes)
  await fastify.register(chatRoutes)
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
  fastify.get(
    '/health',
    {
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
    },
    async () => ({ status: 'ok' }),
  )

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
  if (fileWatcher) fileWatcher.stop()
  if (gateway) {
    gateway.destroy()
  }
  if (sessionManager) {
    await sessionManager.destroy()
  }
  if (fastify.conversationManager) fastify.conversationManager.destroyAll()
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
