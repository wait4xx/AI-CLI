import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'

export async function controlRoutes(fastify: FastifyInstance) {
  // List all tmux sessions with full details (managed + external)
  fastify.get(
    '/api/tmux',
    {
      schema: {
        summary: '列出所有 tmux 会话',
        description: '返回所有 tmux 会话详情（含应用管理的和外部会话）',
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
                    created: { type: 'string' },
                    isManaged: { type: 'boolean' },
                    adapterName: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager) return { sessions: [] }
      const sessions = await sessionManager.listAllTmuxSessions()
      return { sessions }
    },
  )

  // Kill a tmux session
  fastify.delete(
    '/api/tmux/:name',
    {
      schema: {
        summary: '终止 tmux 会话',
        description: '终止指定的 tmux 会话（应用管理的会话需验证归属权限）',
        params: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager) return reply.code(500).send({ error: 'SessionManager not available' })
      const user = request.user
      if (!user) return reply.code(401).send({ error: 'Unauthorized' })
      const name = (request.params as { name: string }).name
      try {
        await sessionManager.killTmuxSession(name, user.userId)
        return { ok: true }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        const code = message === 'Permission denied' ? 403 : 400
        return reply.code(code).send({ error: message })
      }
    },
  )

  // Rename a tmux session
  fastify.patch(
    '/api/tmux/:name',
    {
      schema: {
        summary: '重命名 tmux 会话',
        description: '重命名指定的 tmux 会话',
        params: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['newName'],
          properties: { newName: { type: 'string', minLength: 1 } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager) return reply.code(500).send({ error: 'SessionManager not available' })
      const user = request.user
      if (!user) return reply.code(401).send({ error: 'Unauthorized' })
      const name = (request.params as { name: string }).name
      const body = request.body as { newName: string }
      try {
        await sessionManager.renameTmuxSession(name, body.newName, user.userId)
        return { ok: true, newName: body.newName }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        const code = message === 'Permission denied' ? 403 : 400
        return reply.code(code).send({ error: message })
      }
    },
  )

  // List active sessions managed by the app (for frontend restore after login)
  fastify.get(
    '/api/sessions',
    {
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
    },
    async () => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager) return { sessions: [] }
      return { sessions: sessionManager.listSessions() }
    },
  )

  // List available tmux sessions not managed by the app
  fastify.get(
    '/api/sessions/tmux',
    {
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
    },
    async () => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager) return { sessions: [] }
      const sessions = await sessionManager.listAvailableTmuxSessions()
      return { sessions }
    },
  )

  fastify.get(
    '/ws/control',
    {
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
    },
    (socket, request) => {
      const user = verifyWsUpgradeToken(request, socket, 'Control')
      if (!user) return

      fastify.wsGateway.handleControlConnection(socket, user)
    },
  )
}
