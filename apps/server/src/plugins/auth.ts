import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@ai-cli/shared'

const WHITELIST_PATHS = ['/health', '/api/auth/login', '/api/auth/refresh']

export interface StoredUser {
  userId: string
  username: string
  passwordHash: string
}

export const users = new Map<string, StoredUser>()

async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const urlPath = request.url.split('?')[0]
    if (WHITELIST_PATHS.some(p => urlPath === p)) {
      return
    }

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
      request.user = decoded
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }
  })
}

export default fp(authPlugin)
