import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'

export async function terminalRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/terminal', {
    websocket: true,
    schema: {
      hide: true, // WebSocket 路由不在 Swagger UI 中显示
      summary: 'WebSocket 终端连接',
      description: '通过 WebSocket 连接到终端会话，需要 JWT token 作为查询参数',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'JWT access token' },
        },
      },
    },
  }, (socket, request) => {
    if (!verifyWsUpgradeToken(request, socket, 'Terminal')) return

    // [R9] wsGateway is type-safely declared in fastify.d.ts via decorate()
    fastify.wsGateway.handleTerminalConnection(socket)
  })
}
