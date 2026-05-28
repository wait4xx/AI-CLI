import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs/promises'
import path from 'path'
import fsSync from 'fs'
import rateLimit from '@fastify/rate-limit'
import { auditLog } from '../core/audit.js'
import { getConfig } from '../lib/config.js'

function getProjectRoot(): string {
  return getConfig().PROJECT_ROOT
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
  // [Q5修复] 补充常见编程语言扩展名
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  '.h': 'c',
  '.hpp': 'cpp',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.kt': 'kotlin',
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
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return resolved
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

// [R7] Moved to module-level to avoid recreation on every PUT request
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi',
  '.ps1', '.vbs', '.dll', '.so', '.dylib', '.app',
])

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

  fastify.get('/tree', {
    schema: {
      summary: '获取目录列表',
      description: '获取指定路径下的文件和目录列表',
      querystring: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '相对路径（默认为根目录）' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            entries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  path: { type: 'string' },
                  type: { type: 'string', enum: ['file', 'directory'] },
                  size: { type: 'number' },
                  modified: { type: 'string' },
                },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const relativePath = (request.query as Record<string, string | undefined>).path || ''

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

  fastify.get('/file', {
    schema: {
      summary: '读取文件内容',
      description: '读取指定文件的内容，支持代码高亮语言识别',
      querystring: {
        type: 'object',
        required: ['path'],
        properties: {
          path: { type: 'string', description: '文件相对路径' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            content: { type: 'string', description: '文件内容' },
            path: { type: 'string', description: '文件路径' },
            size: { type: 'number', description: '文件大小（字节）' },
            language: { type: 'string', description: '代码语言' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
        413: { type: 'object', properties: { error: { type: 'string' } } },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const relativePath = (request.query as Record<string, string | undefined>).path
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

    auditLog('FILE_READ', request.user?.userId, { path: relativePath })

    return {
      content,
      path: relativePath,
      size: stat.size,
      language: getLanguage(resolved),
    }
  })

  // PUT /api/fs/file — write file
  fastify.put('/file', {
    schema: {
      summary: '写入文件',
      description: '创建或覆盖文件内容（自动创建父目录，禁止可执行文件类型）',
      body: {
        type: 'object',
        required: ['path', 'content'],
        properties: {
          path: { type: 'string', description: '文件相对路径' },
          content: { type: 'string', description: '文件内容（最大 1MB）' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            path: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        403: { type: 'object', properties: { error: { type: 'string' } } },
        413: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>
    const relativePath = typeof body.path === 'string' ? body.path : ''
    const content = typeof body.content === 'string' ? body.content : ''

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

    // [M12修复/N2修正] 仅阻止真正可执行/危险文件，不阻止代码文件（.js/.py/.ts 等）
    const ext = path.extname(resolved).toLowerCase()
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      auditLog('FILE_WRITE_BLOCKED', request.user?.userId, { path: relativePath, ext })
      return reply.code(403).send({ error: `File type '${ext}' is not allowed for security reasons` })
    }

    // Create parent directories if needed
    const dir = path.dirname(resolved)
    try {
      await fs.mkdir(dir, { recursive: true })
    } catch {
      return reply.code(500).send({ error: 'Failed to create directory' })
    }

    // [R2修复] 使用 write-then-rename 原子写入，防止崩溃时文件截断
    const tmpPath = resolved + '.tmp'
    try {
      await fs.writeFile(tmpPath, content, 'utf-8')
      await fs.rename(tmpPath, resolved)
    } catch {
      // 清理可能残留的临时文件
      await fs.unlink(tmpPath).catch(() => { /* cleanup — ignore if temp file doesn't exist */ })
      return reply.code(500).send({ error: 'Failed to write file' })
    }

    auditLog('FILE_WRITE', request.user?.userId, { path: relativePath, size: Buffer.byteLength(content, 'utf-8') })

    return { success: true, path: relativePath }
  })
}
