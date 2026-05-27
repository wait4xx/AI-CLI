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
  deleteUser,
} from '../plugins/auth.js'
import { auditLog } from '../core/audit.js'
import { pinoLogger } from '../lib/logger.js'

export function ensureAdminUser() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    pinoLogger.fatal('ADMIN_PASSWORD not set, cannot create admin user')
    process.exit(1)
  }

  if (!hasUser(adminUsername)) {
    const passwordHash = bcrypt.hashSync(adminPassword, 10)
    createUser(adminUsername, {
      userId: crypto.randomUUID(),
      username: adminUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    })
    pinoLogger.info({ username: adminUsername }, 'Admin user created')
  }
}

function generateTokenPair(userId: string, username: string): TokenPair {
  const accessToken = jwt.sign(
    { userId, username },
    process.env.JWT_SECRET!,
    { expiresIn: '15m' }
  )
  const refreshToken = jwt.sign(
    { userId, username },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d' }
  )
  return { accessToken, refreshToken }
}

export async function authRoutes(fastify: FastifyInstance) {
  // Register rate limit plugin scoped to this route prefix
  await fastify.register(rateLimit, {
    max: 5,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  })

  // Admin-only middleware
  function requireAdmin(request: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void): void {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin'
    if (!request.user || (request.user as JwtPayload).username !== adminUsername) {
      reply.code(403).send({ error: 'Admin access required' })
      return
    }
    done()
  }

  // GET /api/auth/users — list all users
  fastify.get('/users', { preHandler: requireAdmin }, async () => {
    const userList = listUsers().map(({ passwordHash: _, ...rest }) => rest)
    auditLog('USER_LIST', undefined, { count: userList.length })
    return { users: userList }
  })

  // POST /api/auth/users — create a new user
  fastify.post('/users', { preHandler: requireAdmin }, async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }

    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password required' })
    }

    if (hasUser(username)) {
      return reply.code(409).send({ error: 'User already exists' })
    }

    const passwordHash = bcrypt.hashSync(password, 10)
    const newUser = {
      userId: crypto.randomUUID(),
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    }
    createUser(username, newUser)

    auditLog('USER_CREATE', request.user!.userId, { createdUser: username })
    pinoLogger.info({ by: request.user!.username, createdUser: username }, 'User created')

    const { passwordHash: _, ...safe } = newUser
    return reply.code(201).send(safe)
  })

  // DELETE /api/auth/users/:username — delete a user
  fastify.delete('/users/:username', { preHandler: requireAdmin }, async (request, reply) => {
    const { username } = request.params as { username: string }

    if (!hasUser(username)) {
      return reply.code(404).send({ error: 'User not found' })
    }

    // Prevent deleting yourself
    if (request.user!.username === username) {
      return reply.code(400).send({ error: 'Cannot delete yourself' })
    }

    deleteUser(username)
    auditLog('USER_DELETE', request.user!.userId, { deletedUser: username })
    pinoLogger.info({ by: request.user!.username, deletedUser: username }, 'User deleted')

    return { success: true }
  })

  // PUT /api/auth/users/:username/password — change a user's password
  fastify.put('/users/:username/password', { preHandler: requireAdmin }, async (request, reply) => {
    const { username } = request.params as { username: string }
    const { newPassword } = request.body as { newPassword: string }

    if (!newPassword) {
      return reply.code(400).send({ error: 'New password required' })
    }

    const user = getUser(username)
    if (!user) {
      return reply.code(404).send({ error: 'User not found' })
    }

    if (!updateUserPassword(username, bcrypt.hashSync(newPassword, 10))) {
      return reply.code(404).send({ error: 'User not found' })
    }

    auditLog('USER_PASSWORD_CHANGE', request.user!.userId, { targetUser: username })
    pinoLogger.info({ by: request.user!.username, targetUser: username }, 'User password changed')

    return { success: true }
  })

  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }

    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password required' })
    }

    const user = getUser(username)
    if (!user) {
      auditLog('LOGIN_FAILED', undefined, { username, reason: 'user not found', ip: request.ip })
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const valid = bcrypt.compareSync(password, user.passwordHash)
    if (!valid) {
      auditLog('LOGIN_FAILED', user.userId, { username, reason: 'invalid password', ip: request.ip })
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const tokens = generateTokenPair(user.userId, user.username)
    auditLog('LOGIN', user.userId, { username, ip: request.ip })
    return tokens
  })

  // POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string }

    if (!refreshToken) {
      return reply.code(400).send({ error: 'Refresh token required' })
    }

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload
      const accessToken = jwt.sign(
        { userId: decoded.userId, username: decoded.username },
        process.env.JWT_SECRET!,
        { expiresIn: '15m' }
      )
      return { accessToken }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' })
    }
  })
}
