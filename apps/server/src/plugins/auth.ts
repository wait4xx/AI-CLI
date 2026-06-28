import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { JwtPayload } from '@ai-cli/shared'
import fs from 'fs'
import path from 'path'
import { pinoLogger } from '../lib/logger.js'
import { getConfig } from '../lib/config.js'

const WHITELIST_PATHS = [
  '/health',
  '/api/auth/login',
  '/api/auth/refresh',
  '/ws/terminal',
  '/ws/control',
  '/ws/chat', // auth via ?token= query param (verifyWsUpgradeToken), like other WS routes
]

export interface StoredUser {
  userId: string
  username: string
  passwordHash: string
  role: 'admin' | 'user'
  tokenVersion: number
  createdAt: string
}

function getUsersFilePath(): string {
  return path.join(getConfig().DATA_DIR, 'users.json')
}

const users = new Map<string, StoredUser>()

// [M-#5修复] 改为异步 loadUsers，使用 fs.promises.readFile 避免阻塞事件循环
export async function loadUsers(): Promise<void> {
  try {
    const usersFilePath = getUsersFilePath()
    const { promises: fsp } = fs
    const data = await fsp.readFile(usersFilePath, 'utf-8')
    const parsed: Record<string, StoredUser> = JSON.parse(data)
    for (const [key, value] of Object.entries(parsed)) {
      users.set(key, value)
    }
  } catch (err) {
    pinoLogger.error({ err }, 'Failed to load users file')
  }

  // Migrate missing fields after loading
  const adminUsername = getConfig().ADMIN_USERNAME
  let dirty = false
  for (const [username, user] of users) {
    if (!user.role) {
      user.role = username === adminUsername ? ('admin' as const) : ('user' as const)
      dirty = true
    }
    if (user.tokenVersion === undefined) {
      user.tokenVersion = 0
      dirty = true
    }
  }
  if (dirty) void saveUsers()
}

async function saveUsers(): Promise<void> {
  try {
    const usersFilePath = getUsersFilePath()
    const obj: Record<string, StoredUser> = {}
    for (const [key, value] of users.entries()) {
      obj[key] = value
    }
    const dir = path.dirname(usersFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    // [S4修复] write-then-rename 原子写入，防止写入中途崩溃导致数据损坏
    const tmpPath = usersFilePath + '.tmp'
    const { promises: fsp } = fs
    await fsp.writeFile(tmpPath, JSON.stringify(obj, null, 2), 'utf-8')
    await fsp.rename(tmpPath, usersFilePath)
  } catch (err) {
    pinoLogger.error({ err }, 'Failed to save users file')
    throw new Error('Failed to persist user data')
  }
}

// [M-#5修复] users 在 server start() 中通过 await loadUsers() 加载，不再在模块初始化时同步加载

export function getUser(username: string): StoredUser | undefined {
  return users.get(username)
}

export function hasUser(username: string): boolean {
  return users.has(username)
}

export async function createUser(username: string, user: StoredUser): Promise<void> {
  users.set(username, user)
  await saveUsers()
}

export function listUsers(): StoredUser[] {
  return [...users.values()]
}

export async function updateUserPassword(
  username: string,
  newPasswordHash: string,
): Promise<boolean> {
  const user = users.get(username)
  if (!user) return false
  user.passwordHash = newPasswordHash
  await saveUsers()
  return true
}

export async function deleteUser(username: string): Promise<boolean> {
  const deleted = users.delete(username)
  if (deleted) {
    await saveUsers()
  }
  return deleted
}

export async function updateUserRole(username: string, role: 'admin' | 'user'): Promise<boolean> {
  const user = users.get(username)
  if (!user) return false
  user.role = role
  await saveUsers()
  return true
}

export async function incrementTokenVersion(username: string): Promise<boolean> {
  const user = users.get(username)
  if (!user) return false
  user.tokenVersion = (user.tokenVersion || 0) + 1
  await saveUsers()
  return true
}

export function getTokenVersion(username: string): number {
  return users.get(username)?.tokenVersion ?? -1
}

export { saveUsers }

async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const urlPath = request.url.split('?')[0]
    if (WHITELIST_PATHS.some((p) => urlPath === p)) {
      return
    }

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, getConfig().JWT_SECRET) as JwtPayload
      // Verify tokenVersion matches current user record
      const currentVersion = getTokenVersion(decoded.username)
      if (currentVersion !== -1 && decoded.tokenVersion !== currentVersion) {
        return reply.code(401).send({ error: 'Token revoked' })
      }
      request.user = decoded
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }
  })
}

export default fp(authPlugin)
