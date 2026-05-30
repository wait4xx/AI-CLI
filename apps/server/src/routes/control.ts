import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'
import fs from 'fs/promises'
import path from 'path'

export async function controlRoutes(fastify: FastifyInstance) {
  // List active sessions managed by the app (for frontend restore after login)
  fastify.get('/api/sessions', {
    schema: {
      summary: '列出活跃会话',
      description: '返回所有由应用管理的活跃终端会话',
      response: {
        200: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  sessionId: { type: 'string' },
                  status: { type: 'string' },
                  tmuxSessionName: { type: 'string' },
                  adapterName: { type: 'string' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const sessionManager = fastify.sessionManager
    if (!sessionManager) return { sessions: [] }
    return { sessions: sessionManager.listSessions() }
  })

  // List available tmux sessions not managed by the app
  fastify.get('/api/sessions/tmux', {
    schema: {
      summary: '列出可用的 tmux 会话',
      description: '返回当前未被应用管理的 tmux 会话列表',
      response: {
        200: {
          type: 'object',
          properties: {
            sessions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  windows: { type: 'number' },
                  attached: { type: 'number' },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async () => {
    const sessionManager = fastify.sessionManager
    if (!sessionManager) return { sessions: [] }
    const sessions = await sessionManager.listAvailableTmuxSessions()
    return { sessions }
  })

  fastify.get('/ws/control', {
    websocket: true,
    schema: {
      hide: true,
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
    const user = verifyWsUpgradeToken(request, socket, 'Control')
    if (!user) return

    fastify.wsGateway.handleControlConnection(socket, user)
  })
}
