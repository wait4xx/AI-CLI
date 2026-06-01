import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'
// [M-#13修复] getUser 改为静态导入（模块启动时已加载）
import { getUser } from '../plugins/auth.js'

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

  // Kill a managed session by sessionId
  fastify.delete(
    '/api/sessions/:sessionId',
    {
      schema: {
        summary: '终止会话',
        description: '终止指定的终端会话（包括 tmux 进程和所有 WS 连接）',
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: { sessionId: { type: 'string' } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager) return reply.code(500).send({ error: 'SessionManager not available' })
      const user = request.user
      if (!user) return reply.code(401).send({ error: 'Unauthorized' })
      const { sessionId } = request.params as { sessionId: string }
      if (!sessionManager.hasSession(sessionId)) {
        return reply.code(404).send({ error: 'Session not found' })
      }
      // Admin can kill any session; others must be owner
      const owner = sessionManager.getOwner(sessionId)
      if (owner !== user.userId && user.role !== 'admin') {
        return reply.code(403).send({ error: 'Permission denied' })
      }
      sessionManager.destroySession(sessionId)
      return { ok: true }
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
    async (request) => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager || !request.user) return { sessions: [] }
      // [M-#3修复] 非 admin 用户只返回自己的会话和被共享的会话
      return {
        sessions: sessionManager.listSessionsForUser(request.user.userId, request.user.role),
      }
    },
  )

  // Get sessions shared with the current user
  fastify.get(
    '/api/sessions/shared',
    {
      schema: {
        summary: '列出共享给自己的会话',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request) => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager || !request.user) return { sessions: [] }
      const shared = sessionManager.getSharedSessions(request.user.userId)
      return {
        sessions: shared.map((s) => ({
          sessionId: s.sessionId,
          ownerName: s.ownerId,
          permission: s.permission,
        })),
      }
    },
  )

  // Share a session with another user
  fastify.post(
    '/api/sessions/:sessionId/share',
    {
      schema: {
        summary: '共享会话',
        body: {
          type: 'object',
          required: ['targetUsername', 'permission'],
          properties: {
            targetUsername: { type: 'string' },
            permission: { type: 'string', enum: ['read', 'write'] },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager || !request.user) return reply.code(500).send({ error: 'Server error' })
      const { sessionId } = request.params as { sessionId: string }
      const body = request.body as Record<string, unknown>
      const targetUsername = body.targetUsername as string
      const permission = body.permission as string

      const targetUser = getUser(targetUsername)
      if (!targetUser) return reply.code(404).send({ error: 'Target user not found' })

      const ok = sessionManager.shareSession(
        sessionId,
        request.user.userId,
        targetUser.userId,
        permission as 'read' | 'write',
      )
      if (!ok) return reply.code(403).send({ error: 'Not session owner' })
      return { success: true }
    },
  )

  // Unshare a session
  fastify.post(
    '/api/sessions/:sessionId/unshare',
    {
      schema: {
        summary: '取消共享',
        body: {
          type: 'object',
          required: ['targetUsername'],
          properties: {
            targetUsername: { type: 'string' },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const sessionManager = fastify.sessionManager
      if (!sessionManager || !request.user) return reply.code(500).send({ error: 'Server error' })
      const { sessionId } = request.params as { sessionId: string }
      const body = request.body as Record<string, unknown>
      const targetUsername = body.targetUsername as string

      const targetUser = getUser(targetUsername)
      if (!targetUser) return reply.code(404).send({ error: 'Target user not found' })

      const ok = sessionManager.unshareSession(sessionId, request.user.userId, targetUser.userId)
      if (!ok) return reply.code(403).send({ error: 'Not session owner' })
      return { success: true }
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
