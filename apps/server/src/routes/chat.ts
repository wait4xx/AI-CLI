import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/ws/chat',
    {
      websocket: true,
      schema: {
        hide: true,
        summary: 'WebSocket 对话视图连接',
        querystring: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string', description: 'JWT access token' } },
        },
      },
    },
    (socket, request) => {
      const user = verifyWsUpgradeToken(request, socket, 'Chat')
      if (!user) return
      fastify.chatGateway.handleChatConnection(socket, user)
    },
  )
}
