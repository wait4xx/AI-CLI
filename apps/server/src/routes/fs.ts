import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs/promises'
import path from 'path'
import fsSync from 'fs'
import os from 'os'
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
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.svg': 'xml',
  '.proto': 'protobuf',
  '.diff': 'diff',
  '.patch': 'diff',
}

async function sanitizePath(inputPath: string): Promise<string | null> {
  if (inputPath.includes('\0')) return null
  const root = getProjectRoot()

  // Absolute paths: only allowed when FS_ALLOW_ABSOLUTE_PATHS is explicitly enabled
  if (inputPath.startsWith('/')) {
    if (!getConfig().FS_ALLOW_ABSOLUTE_PATHS) return null
    const resolved = path.resolve(inputPath)
    try {
      const real = await fs.realpath(resolved)
      return real
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException)?.code
      if (code === 'ENOENT') return resolved
      return null
    }
  }

  // Relative paths: resolve within PROJECT_ROOT (sandboxed)
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
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.ps1',
  '.vbs',
  '.dll',
  '.so',
  '.dylib',
  '.app',
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

  fastify.get(
    '/cwd',
    {
      schema: {
        summary: '获取当前工作目录',
        description: '获取指定会话的 tmux 终端当前工作目录（相对于项目根目录）',
        querystring: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string', description: '会话 ID' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              cwd: { type: 'string', description: '相对于项目根目录的路径' },
            },
          },
          400: { type: 'object', properties: { error: { type: 'string' } } },
          403: { type: 'object', properties: { error: { type: 'string' } } },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { sessionId } = request.query as { sessionId?: string }
      if (!sessionId) {
        return reply.code(400).send({ error: 'Missing sessionId parameter' })
      }

      const sessionManager = request.server.sessionManager
      if (!sessionManager) {
        return reply.code(500).send({ error: 'Session manager not available' })
      }

      if (!sessionManager.hasSession(sessionId)) {
        return reply.code(404).send({ error: 'Session not found' })
      }

      const owner = sessionManager.getOwner(sessionId)
      if (!owner || owner !== request.user?.userId) {
        return reply.code(403).send({ error: 'Permission denied' })
      }

      try {
        const cwd = await sessionManager.getCwd(sessionId)
        return { cwd }
      } catch {
        return { cwd: '' }
      }
    },
  )

  fastify.get(
    '/tree',
    {
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
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
          entries
            .filter((e) => !shouldHide(e.name))
            .map(async (e) => {
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
    },
  )

  fastify.get(
    '/file',
    {
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
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    },
  )

  // PUT /api/fs/file — write file
  fastify.put(
    '/file',
    {
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
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
        return reply
          .code(403)
          .send({ error: `File type '${ext}' is not allowed for security reasons` })
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
        await fs.unlink(tmpPath).catch(() => {
          /* cleanup — ignore if temp file doesn't exist */
        })
        return reply.code(500).send({ error: 'Failed to write file' })
      }

      auditLog('FILE_WRITE', request.user?.userId, {
        path: relativePath,
        size: Buffer.byteLength(content, 'utf-8'),
      })

      return { success: true, path: relativePath }
    },
  )

  // GET /api/fs/complete — path autocomplete for directories
  fastify.get(
    '/complete',
    {
      schema: {
        summary: '路径自动补全',
        description: '返回匹配的目录路径列表，用于前端路径输入框自动补全',
        querystring: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '部分路径' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              completions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    path: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      let inputPath = (request.query as Record<string, string | undefined>).path || ''

      // Expand ~ to home directory for autocomplete
      if (inputPath.startsWith('~')) {
        inputPath = inputPath.replace(/^~/, os.homedir())
      }

      // Parse directory part and prefix
      const lastSlash = inputPath.lastIndexOf('/')
      const dir = lastSlash >= 0 ? inputPath.slice(0, lastSlash + 1) || '/' : ''
      const prefix = lastSlash >= 0 ? inputPath.slice(lastSlash + 1) : inputPath

      const resolved = await sanitizePath(dir || '.')
      if (!resolved) {
        return { completions: [] }
      }

      let entries: fsSync.Dirent[]
      try {
        entries = await fs.readdir(resolved, { withFileTypes: true })
      } catch {
        return { completions: [] }
      }

      const lowerPrefix = prefix.toLowerCase()
      const completions = entries
        .filter(
          (e) =>
            e.isDirectory() &&
            !e.name.startsWith('.') &&
            e.name.toLowerCase().startsWith(lowerPrefix),
        )
        .slice(0, 20)
        .map((e) => ({
          name: e.name,
          path: (dir.endsWith('/') ? dir : dir + '/') + e.name,
        }))

      return { completions }
    },
  )

  // ========== File Management Routes ==========

  // DELETE /api/fs/file — delete file or empty directory
  fastify.delete(
    '/file',
    {
      schema: {
        summary: '删除文件或空目录',
        body: {
          type: 'object',
          required: ['path'],
          properties: { path: { type: 'string' } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { path: relativePath } = request.body as { path: string }
      if (!relativePath) return reply.code(400).send({ error: 'Missing path' })

      const resolved = await sanitizePath(relativePath)
      if (!resolved) return reply.code(403).send({ error: 'Path traversal detected' })

      let stat: fsSync.Stats
      try {
        stat = await fs.stat(resolved)
      } catch {
        return reply.code(404).send({ error: 'Not found' })
      }

      try {
        // [M-#14修复] IMPORTANT: 只删除空目录(rmdir)，禁止改为 recursive rm 以防目录树误删
        if (stat.isDirectory()) await fs.rmdir(resolved)
        else await fs.unlink(resolved)
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code
        if (code === 'ENOTEMPTY') return reply.code(400).send({ error: 'Directory not empty' })
        return reply.code(500).send({ error: 'Failed to delete' })
      }

      auditLog('FILE_DELETE', request.user?.userId, { path: relativePath })
      return { success: true }
    },
  )

  // POST /api/fs/mkdir — create directory
  fastify.post(
    '/mkdir',
    {
      schema: {
        summary: '创建目录',
        body: {
          type: 'object',
          required: ['path'],
          properties: { path: { type: 'string' } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { path: relativePath } = request.body as { path: string }
      if (!relativePath) return reply.code(400).send({ error: 'Missing path' })

      const resolved = await sanitizePath(relativePath)
      if (!resolved) return reply.code(403).send({ error: 'Path traversal detected' })

      try {
        await fs.mkdir(resolved, { recursive: true })
      } catch {
        return reply.code(500).send({ error: 'Failed to create directory' })
      }

      auditLog('MKDIR', request.user?.userId, { path: relativePath })
      return { success: true, path: relativePath }
    },
  )

  // POST /api/fs/rename — rename/move file or directory
  fastify.post(
    '/rename',
    {
      schema: {
        summary: '重命名文件或目录',
        body: {
          type: 'object',
          required: ['oldPath', 'newPath'],
          properties: { oldPath: { type: 'string' }, newPath: { type: 'string' } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { oldPath, newPath } = request.body as { oldPath: string; newPath: string }
      if (!oldPath || !newPath) return reply.code(400).send({ error: 'Missing oldPath or newPath' })

      const resolvedOld = await sanitizePath(oldPath)
      const resolvedNew = await sanitizePath(newPath)
      if (!resolvedOld || !resolvedNew)
        return reply.code(403).send({ error: 'Path traversal detected' })

      try {
        await fs.rename(resolvedOld, resolvedNew)
      } catch {
        return reply.code(500).send({ error: 'Failed to rename' })
      }

      auditLog('FILE_RENAME', request.user?.userId, { oldPath, newPath })
      return { success: true }
    },
  )

  // POST /api/fs/new-file — create empty file
  fastify.post(
    '/new-file',
    {
      schema: {
        summary: '创建空文件',
        body: {
          type: 'object',
          required: ['path'],
          properties: { path: { type: 'string' } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { path: relativePath } = request.body as { path: string }
      if (!relativePath) return reply.code(400).send({ error: 'Missing path' })

      const resolved = await sanitizePath(relativePath)
      if (!resolved) return reply.code(403).send({ error: 'Path traversal detected' })

      const ext = path.extname(resolved).toLowerCase()
      if (DANGEROUS_EXTENSIONS.has(ext))
        return reply.code(403).send({ error: `File type '${ext}' not allowed` })

      const dir = path.dirname(resolved)
      try {
        await fs.mkdir(dir, { recursive: true })
      } catch {
        return reply.code(500).send({ error: 'Failed to create parent directory' })
      }

      try {
        await fs.writeFile(resolved, '', 'utf-8')
      } catch {
        return reply.code(500).send({ error: 'Failed to create file' })
      }

      auditLog('FILE_CREATE', request.user?.userId, { path: relativePath })
      return { success: true, path: relativePath }
    },
  )

  // GET /api/fs/download — download file or directory (zip)
  fastify.get(
    '/download',
    {
      schema: {
        summary: '下载文件或目录',
        querystring: {
          type: 'object',
          required: ['path'],
          properties: { path: { type: 'string' } },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const relativePath = (request.query as Record<string, string | undefined>).path
      if (!relativePath) return reply.code(400).send({ error: 'Missing path' })

      const resolved = await sanitizePath(relativePath)
      if (!resolved) return reply.code(403).send({ error: 'Path traversal detected' })

      let stat: fsSync.Stats
      try {
        stat = await fs.stat(resolved)
      } catch {
        return reply.code(404).send({ error: 'Not found' })
      }

      const baseName = path.basename(resolved)

      if (stat.isFile()) {
        reply.header(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(baseName)}"`,
        )
        reply.header('Content-Type', 'application/octet-stream')
        try {
          const stream = fsSync.createReadStream(resolved)
          return reply.send(stream)
        } catch {
          return reply.code(500).send({ error: 'Failed to read file' })
        }
      }

      // Directory: zip on the fly
      reply.header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(baseName)}.zip"`,
      )
      reply.header('Content-Type', 'application/zip')

      const archiver = await import('archiver')
      const archive = archiver.default('zip', { zlib: { level: 6 } })
      archive.directory(resolved, baseName)
      archive.finalize()
      return reply.send(archive)
    },
  )

  // POST /api/fs/upload — upload files (multipart)
  fastify.post(
    '/upload',
    {
      schema: {
        summary: '上传文件',
        consumes: ['multipart/form-data'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parts = request.parts()
      const dir = (request.query as Record<string, string | undefined>).dir || ''
      const resolvedDir = await sanitizePath(dir || '.')
      if (!resolvedDir) return reply.code(403).send({ error: 'Path traversal detected' })

      await fs.mkdir(resolvedDir, { recursive: true })

      const uploaded: string[] = []

      for await (const part of parts) {
        if (part.type === 'file') {
          const safeName = path.basename(part.filename)
          if (!safeName) continue
          const targetPath = path.join(resolvedDir, safeName)
          const buffer = await part.toBuffer()
          await fs.writeFile(targetPath, buffer)
          uploaded.push(safeName)
          // Audit dangerous extensions on upload
          const ext = path.extname(safeName).toLowerCase()
          if (DANGEROUS_EXTENSIONS.has(ext)) {
            auditLog('FILE_UPLOAD_DANGEROUS_EXT', request.user?.userId, {
              filename: safeName,
              ext,
              dir,
            })
          }
        }
      }

      if (uploaded.length === 0) return reply.code(400).send({ error: 'No file uploaded' })

      auditLog('FILE_UPLOAD', request.user?.userId, { dir, count: uploaded.length })
      return { success: true, files: uploaded }
    },
  )

  // POST /api/fs/compress — compress paths into zip
  fastify.post(
    '/compress',
    {
      schema: {
        summary: '压缩文件/目录',
        body: {
          type: 'object',
          required: ['paths', 'output'],
          properties: {
            paths: { type: 'array', items: { type: 'string' } },
            output: { type: 'string' },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { paths: inputPaths, output } = request.body as { paths: string[]; output: string }
      if (!inputPaths?.length || !output)
        return reply.code(400).send({ error: 'Missing paths or output' })

      const resolvedOutput = await sanitizePath(output)
      if (!resolvedOutput) return reply.code(403).send({ error: 'Path traversal detected' })

      const outputDir = path.dirname(resolvedOutput)
      await fs.mkdir(outputDir, { recursive: true })

      const archiver = await import('archiver')
      const archive = archiver.default('zip', { zlib: { level: 6 } })
      const stream = fsSync.createWriteStream(resolvedOutput)
      archive.pipe(stream)

      for (const p of inputPaths) {
        const resolved = await sanitizePath(p)
        if (!resolved) continue
        let stat: fsSync.Stats
        try {
          stat = await fs.stat(resolved)
        } catch {
          continue
        }
        const baseName = path.basename(resolved)
        if (stat.isDirectory()) archive.directory(resolved, baseName)
        else archive.file(resolved, { name: baseName })
      }

      await archive.finalize()

      auditLog('FILE_COMPRESS', request.user?.userId, { paths: inputPaths, output })
      return { success: true, path: output }
    },
  )
}
