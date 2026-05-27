import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs/promises'
import path from 'path'
import fsSync from 'fs'
import rateLimit from '@fastify/rate-limit'
import { auditLog } from '../core/audit.js'

function getProjectRoot(): string {
  return process.env.PROJECT_ROOT || '/workspace'
}
const MAX_FILE_SIZE = 1048576 // 1MB

const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.html': 'html',
}

async function sanitizePath(inputPath: string): Promise<string | null> {
  if (inputPath.includes('\0')) return null
  const root = getProjectRoot()
  const resolved = path.resolve(root, inputPath)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null
  }
  try {
    const real = await fs.realpath(resolved)
    if (!real.startsWith(root + path.sep) && real !== root) {
      return null
    }
    return real
  } catch (err: any) {
    if (err.code === 'ENOENT') return resolved
    return null
  }
}

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return EXT_LANGUAGE_MAP[ext] || 'text'
}

function shouldHide(name: string): boolean {
  return name.startsWith('.') || name === 'node_modules'
}

export async function fsRoutes(fastify: FastifyInstance) {
  // [W6修复] 对文件系统路由添加速率限制，防止滥用
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    hook: 'preHandler',
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: '请求过于频繁，请稍后再试',
    }),
  })

  fastify.get('/tree', async (request: FastifyRequest, reply: FastifyReply) => {
    const relativePath = (request.query as any).path || ''

    const resolved = await sanitizePath(relativePath)
    if (!resolved) {
      return reply.code(403).send({ error: 'Path traversal detected' })
    }

    let stat: fsSync.Stats
    try {
      stat = await fs.stat(resolved)
    } catch {
      return reply.code(404).send({ error: 'Path not found' })
    }

    if (!stat.isDirectory()) {
      return reply.code(400).send({ error: 'Not a directory' })
    }

    let entries: fsSync.Dirent[]
    try {
      entries = await fs.readdir(resolved, { withFileTypes: true })
    } catch {
      return reply.code(500).send({ error: 'Failed to read directory' })
    }

    const result = (
      await Promise.all(
        entries.filter(e => !shouldHide(e.name)).map(async (e) => {
          const entryPath = path.join(relativePath, e.name)
          const fullPath = path.join(resolved, e.name)
          try {
            const s = await fs.stat(fullPath)
            return {
              name: e.name,
              path: entryPath,
              type: e.isDirectory() ? 'directory' : 'file',
              size: e.isFile() ? s.size : undefined,
              modified: s.mtime.toISOString(),
            }
          } catch {
            return null
          }
        }),
      )
    ).filter(Boolean)

    return { entries: result }
  })

  fastify.get('/file', async (request: FastifyRequest, reply: FastifyReply) => {
    const relativePath = (request.query as any).path
    if (!relativePath) {
      return reply.code(400).send({ error: 'Missing path parameter' })
    }

    const resolved = await sanitizePath(relativePath)
    if (!resolved) {
      return reply.code(403).send({ error: 'Path traversal detected' })
    }

    let stat: fsSync.Stats
    try {
      stat = await fs.stat(resolved)
    } catch {
      return reply.code(404).send({ error: 'File not found' })
    }

    if (!stat.isFile()) {
      return reply.code(400).send({ error: 'Not a file' })
    }

    if (stat.size > MAX_FILE_SIZE) {
      return reply.code(413).send({ error: 'File too large' })
    }

    let content: string
    try {
      content = await fs.readFile(resolved, 'utf-8')
    } catch {
      return reply.code(500).send({ error: 'Failed to read file' })
    }

    const userId = (request as any).user?.userId
    auditLog('FILE_READ', userId, { path: relativePath })

    return {
      content,
      path: relativePath,
      size: stat.size,
      language: getLanguage(resolved),
    }
  })

  // PUT /api/fs/file — write file
  fastify.put('/file', async (request: FastifyRequest, reply: FastifyReply) => {
    const { path: relativePath, content } = request.body as { path: string; content: string }

    if (!relativePath) {
      return reply.code(400).send({ error: 'Missing path parameter' })
    }

    if (typeof content !== 'string') {
      return reply.code(400).send({ error: 'Missing or invalid content' })
    }

    // Size check (1MB max)
    if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE) {
      return reply.code(413).send({ error: 'Content too large (max 1MB)' })
    }

    const resolved = await sanitizePath(relativePath)
    if (!resolved) {
      return reply.code(403).send({ error: 'Path traversal detected' })
    }

    // Create parent directories if needed
    const dir = path.dirname(resolved)
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch {
      return reply.code(500).send({ error: 'Failed to create directory' })
    }

    try {
      await fs.writeFile(resolved, content, 'utf-8')
    } catch {
      return reply.code(500).send({ error: 'Failed to write file' })
    }

    const userId = (request as any).user?.userId
    auditLog('FILE_WRITE', userId, { path: relativePath, size: Buffer.byteLength(content, 'utf-8') })

    return { success: true, path: relativePath }
  })
}
