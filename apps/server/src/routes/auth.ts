import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import rateLimit from '@fastify/rate-limit'
import { TokenPair, JwtPayload } from '@ai-cli/shared'
import {
  getUser,
  hasUser,
  createUser,
  listUsers,
  updateUserPassword,
  updateUserRole,
  deleteUser,
  incrementTokenVersion,
  getTokenVersion,
} from '../plugins/auth.js'
import { auditLog } from '../core/audit.js'
import { pinoLogger } from '../lib/logger.js'
import { getConfig } from '../lib/config.js'

export async function ensureAdminUser() {
  const config = getConfig()
  const adminUsername = config.ADMIN_USERNAME
  const adminPassword = config.ADMIN_PASSWORD

  if (!adminPassword) {
    pinoLogger.fatal('ADMIN_PASSWORD not set, cannot create admin user')
    process.exit(1)
  }

  if (!hasUser(adminUsername)) {
    // [M13修复] 使用异步 bcrypt.hash 避免阻塞事件循环
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    await createUser(adminUsername, {
      userId: crypto.randomUUID(),
      username: adminUsername,
      passwordHash,
      role: 'admin',
      tokenVersion: 0,
      createdAt: new Date().toISOString(),
    })
    pinoLogger.info({ username: adminUsername }, 'Admin user created')
  }
}

function generateTokenPair(
  userId: string,
  username: string,
  role: string,
  tokenVersion: number,
): TokenPair {
  const config = getConfig()
  const accessToken = jwt.sign({ userId, username, role, tokenVersion }, config.JWT_SECRET, {
    expiresIn: '15m',
  })
  const refreshToken = jwt.sign(
    { userId, username, role, tokenVersion },
    config.JWT_REFRESH_SECRET,
    { expiresIn: '7d' },
  )
  return { accessToken, refreshToken }
}

export async function authRoutes(fastify: FastifyInstance) {
  // Rate limit 仅应用于登录接口，防止暴力破解（公网部署安全）
  // Refresh 和其他接口不限流，避免 token 自动续期被阻塞

  // Admin-only middleware
  async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user || request.user.role !== 'admin') {
      return reply.code(403).send({ error: 'Admin access required' })
    }
  }

  // GET /api/auth/users — list all users
  fastify.get(
    '/users',
    {
      preHandler: requireAdmin,
      schema: {
        summary: '获取用户列表',
        description: '管理员获取所有用户列表（不包含密码哈希）',
        response: {
          200: {
            type: 'object',
            properties: {
              users: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    userId: { type: 'string' },
                    username: { type: 'string' },
                    role: { type: 'string' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
          403: {
            type: 'object',
            properties: { error: { type: 'string' } },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const userList = listUsers().map(({ passwordHash: _, ...rest }) => rest)
      auditLog('USER_LIST', undefined, { count: userList.length })
      return { users: userList }
    },
  )

  // POST /api/auth/users — create a new user
  fastify.post(
    '/users',
    {
      preHandler: requireAdmin,
      schema: {
        summary: '创建新用户',
        description: '管理员创建新用户',
        body: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              minLength: 2,
              maxLength: 32,
              description: '用户名（2-32位字母数字下划线）',
            },
            password: { type: 'string', minLength: 6, description: '密码（至少6位）' },
            role: { type: 'string', enum: ['user', 'admin'], description: '用户角色（默认user）' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              userId: { type: 'string' },
              username: { type: 'string' },
              role: { type: 'string' },
              createdAt: { type: 'string' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          409: { type: 'object', properties: { error: { type: 'string' } } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>
      const username = typeof body.username === 'string' ? body.username : ''
      const password = typeof body.password === 'string' ? body.password : ''

      if (!username || !password) {
        return reply.code(400).send({ error: 'Username and password required' })
      }

      // [安全加固] 用户名格式校验
      if (username.length < 2 || username.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(username)) {
        return reply
          .code(400)
          .send({ error: 'Username must be 2-32 alphanumeric characters, dash, or underscore' })
      }

      // [安全加固] 密码最小长度校验
      if (password.length < 6) {
        return reply.code(400).send({ error: 'Password must be at least 6 characters' })
      }

      if (hasUser(username)) {
        return reply.code(409).send({ error: 'User already exists' })
      }

      const bodyRole =
        typeof body.role === 'string' && (body.role === 'admin' || body.role === 'user')
          ? body.role
          : 'user'
      const passwordHash = await bcrypt.hash(password, 10)
      const newUser = {
        userId: crypto.randomUUID(),
        username,
        passwordHash,
        role: bodyRole as 'admin' | 'user',
        tokenVersion: 0,
        createdAt: new Date().toISOString(),
      }
      await createUser(username, newUser)

      auditLog('USER_CREATE', request.user?.userId, { createdUser: username })
      pinoLogger.info({ by: request.user?.username, createdUser: username }, 'User created')

      const safe = { ...newUser }
      delete safe.passwordHash
      return reply.code(201).send(safe)
    },
  )

  // DELETE /api/auth/users/:username — delete a user
  fastify.delete(
    '/users/:username',
    {
      preHandler: requireAdmin,
      schema: {
        summary: '删除用户',
        description: '管理员删除指定用户（不能删除自己）',
        params: {
          type: 'object',
          properties: {
            username: { type: 'string', description: '要删除的用户名' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { username } = request.params as { username: string }

      if (!hasUser(username)) {
        return reply.code(404).send({ error: 'User not found' })
      }

      // Prevent deleting yourself
      if (request.user?.username === username) {
        return reply.code(400).send({ error: 'Cannot delete yourself' })
      }

      await deleteUser(username)
      auditLog('USER_DELETE', request.user?.userId, { deletedUser: username })
      pinoLogger.info({ by: request.user?.username, deletedUser: username }, 'User deleted')

      return { success: true }
    },
  )

  // PUT /api/auth/users/:username/password — change a user's password
  fastify.put(
    '/users/:username/password',
    {
      preHandler: requireAdmin,
      schema: {
        summary: '修改用户密码',
        description: '管理员修改指定用户密码',
        params: {
          type: 'object',
          properties: {
            username: { type: 'string', description: '目标用户名' },
          },
        },
        body: {
          type: 'object',
          required: ['newPassword'],
          properties: {
            newPassword: { type: 'string', minLength: 6, description: '新密码（至少6位）' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: { success: { type: 'boolean' } },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { username } = request.params as { username: string }
      const body = request.body as Record<string, unknown>
      const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''

      if (!newPassword) {
        return reply.code(400).send({ error: 'New password required' })
      }

      // [安全加固] 密码最小长度校验
      if (newPassword.length < 6) {
        return reply.code(400).send({ error: 'Password must be at least 6 characters' })
      }

      const user = getUser(username)
      if (!user) {
        return reply.code(404).send({ error: 'User not found' })
      }

      // [M13修复] 使用异步 bcrypt.hash 避免阻塞事件循环
      if (!(await updateUserPassword(username, await bcrypt.hash(newPassword, 10)))) {
        return reply.code(404).send({ error: 'User not found' })
      }
      await incrementTokenVersion(username)

      auditLog('USER_PASSWORD_CHANGE', request.user?.userId, { targetUser: username })
      pinoLogger.info({ by: request.user?.username, targetUser: username }, 'User password changed')

      return { success: true }
    },
  )

  // PUT /api/auth/users/:username/role — change a user's role
  fastify.put(
    '/users/:username/role',
    {
      preHandler: requireAdmin,
      schema: {
        summary: '修改用户角色',
        description: '管理员修改指定用户角色',
        params: {
          type: 'object',
          properties: {
            username: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['admin', 'user'], description: '新角色' },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const { username } = request.params as { username: string }
      const body = request.body as Record<string, unknown>
      const role = body.role as string

      if (!hasUser(username)) {
        return reply.code(404).send({ error: 'User not found' })
      }

      if (role !== 'admin' && role !== 'user') {
        return reply.code(400).send({ error: 'Invalid role' })
      }

      await updateUserRole(username, role as 'admin' | 'user')
      await incrementTokenVersion(username)
      auditLog('USER_ROLE_CHANGE', request.user?.userId, { targetUser: username, newRole: role })
      pinoLogger.info(
        { by: request.user?.username, targetUser: username, newRole: role },
        'User role changed',
      )

      return { success: true }
    },
  )

  // POST /api/auth/login — 登录接口单独限流，防暴力破解
  fastify.register(async function loginWithRateLimit(fastify) {
    await fastify.register(rateLimit, {
      max: process.env.NODE_ENV === 'test' ? 1000 : 5,
      timeWindow: '1 minute',
    })

    fastify.post(
      '/login',
      {
        schema: {
          summary: '用户登录',
          description: '使用用户名和密码登录，返回 access token 和 refresh token',
          security: [],
          body: {
            type: 'object',
            required: ['username', 'password'],
            properties: {
              username: { type: 'string', description: '用户名' },
              password: { type: 'string', description: '密码' },
            },
          },
          response: {
            200: {
              type: 'object',
              properties: {
                accessToken: { type: 'string', description: '访问令牌（15分钟有效）' },
                refreshToken: { type: 'string', description: '刷新令牌（7天有效）' },
              },
            },
            400: { type: 'object', properties: { error: { type: 'string' } } },
            401: { type: 'object', properties: { error: { type: 'string' } } },
          },
        },
      },
      async (request, reply) => {
        const body = request.body as Record<string, unknown>
        const username = typeof body.username === 'string' ? body.username : ''
        const password = typeof body.password === 'string' ? body.password : ''

        if (!username || !password) {
          return reply.code(400).send({ error: 'Username and password required' })
        }

        const user = getUser(username)
        if (!user) {
          auditLog('LOGIN_FAILED', undefined, {
            username,
            reason: 'user not found',
            ip: request.ip,
          })
          return reply.code(401).send({ error: 'Invalid credentials' })
        }

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) {
          auditLog('LOGIN_FAILED', user.userId, {
            username,
            reason: 'invalid password',
            ip: request.ip,
          })
          return reply.code(401).send({ error: 'Invalid credentials' })
        }

        const tokens = generateTokenPair(user.userId, user.username, user.role, user.tokenVersion)
        auditLog('LOGIN', user.userId, { username, ip: request.ip })
        return tokens
      },
    )
  }) // end loginWithRateLimit

  // POST /api/auth/refresh
  fastify.post(
    '/refresh',
    {
      schema: {
        summary: '刷新访问令牌',
        description: '使用 refresh token 获取新的 access token',
        security: [],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', description: '刷新令牌' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string', description: '新的访问令牌' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          401: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as Record<string, unknown>
      const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : ''

      if (!refreshToken) {
        return reply.code(400).send({ error: 'Refresh token required' })
      }

      try {
        const config = getConfig()
        const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as JwtPayload
        // Verify tokenVersion matches current user record
        const currentVersion = getTokenVersion(decoded.username)
        if (currentVersion !== -1 && decoded.tokenVersion !== currentVersion) {
          return reply.code(401).send({ error: 'Token revoked' })
        }
        const accessToken = jwt.sign(
          {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role,
            tokenVersion: decoded.tokenVersion,
          },
          config.JWT_SECRET,
          { expiresIn: '15m' },
        )
        return { accessToken }
      } catch {
        return reply.code(401).send({ error: 'Invalid or expired refresh token' })
      }
    },
  )
}
