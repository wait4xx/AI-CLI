import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'

export async function controlRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/control', {
    websocket: true,
    schema: {
      hide: true, // WebSocket 路由不在 Swagger UI 中显示
      summary: 'WebSocket 控制连接',
      description: '通过 WebSocket 连接到控制通道（用于会话管理），需要 JWT token 作为查询参数',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'JWT access token' },
        },
      },
    },
  }, (socket, request) => {
    if (!verifyWsUpgradeToken(request, socket, 'Control')) return

    // [R9] wsGateway is type-safely declared in fastify.d.ts via decorate()
    fastify.wsGateway.handleControlConnection(socket)
  })
}
