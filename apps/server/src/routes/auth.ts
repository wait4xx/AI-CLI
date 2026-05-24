import { FastifyInstance } from 'fastify'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { TokenPair, JwtPayload } from '@ai-cli/shared'
import { users } from '../plugins/auth.js'

export function ensureAdminUser() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.warn('ADMIN_PASSWORD not set, skipping admin user creation')
    return
  }

  if (!users.has(adminUsername)) {
    const passwordHash = bcrypt.hashSync(adminPassword, 10)
    users.set(adminUsername, {
      userId: crypto.randomUUID(),
      username: adminUsername,
      passwordHash,
    })
    console.log(`Admin user "${adminUsername}" created`)
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
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const { username, password } = request.body as { username: string; password: string }

    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password required' })
    }

    const user = users.get(username)
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const valid = bcrypt.compareSync(password, user.passwordHash)
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const tokens = generateTokenPair(user.userId, user.username)
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
