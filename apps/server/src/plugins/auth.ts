import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@ai-cli/shared'
import fs from 'fs'
import path from 'path'
import { pinoLogger } from '../lib/logger.js'

const WHITELIST_PATHS = ['/health', '/api/auth/login', '/api/auth/refresh']

export interface StoredUser {
  userId: string
  username: string
  passwordHash: string
  createdAt: string
}

const USERS_FILE_PATH = path.join(process.env.PROJECT_ROOT || '/workspace', '.users.json')

const users = new Map<string, StoredUser>()

function loadUsers(): void {
  try {
    if (fs.existsSync(USERS_FILE_PATH)) {
      const data = fs.readFileSync(USERS_FILE_PATH, 'utf-8')
      const parsed: Record<string, StoredUser> = JSON.parse(data)
      for (const [key, value] of Object.entries(parsed)) {
        users.set(key, value)
      }
    }
  } catch (err) {
    pinoLogger.error({ err }, 'Failed to load users file')
  }
}

function saveUsers(): void {
  try {
    const obj: Record<string, StoredUser> = {}
    for (const [key, value] of users.entries()) {
      obj[key] = value
    }
    const dir = path.dirname(USERS_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(obj, null, 2), 'utf-8')
  } catch (err) {
    pinoLogger.error({ err }, 'Failed to save users file')
  }
}

// Load existing users on module init
loadUsers()

export function getUser(username: string): StoredUser | undefined {
  return users.get(username)
}

export function hasUser(username: string): boolean {
  return users.has(username)
}

export function createUser(username: string, user: StoredUser): void {
  users.set(username, user)
  saveUsers()
}

export function listUsers(): StoredUser[] {
  return [...users.values()]
}

export function updateUserPassword(username: string, newPasswordHash: string): boolean {
  const user = users.get(username)
  if (!user) return false
  user.passwordHash = newPasswordHash
  saveUsers()
  return true
}

export function deleteUser(username: string): boolean {
  const deleted = users.delete(username)
  if (deleted) {
    saveUsers()
  }
  return deleted
}

export { saveUsers }

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
