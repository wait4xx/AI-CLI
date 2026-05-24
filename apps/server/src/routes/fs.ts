import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs/promises'
import path from 'path'
import fsSync from 'fs'

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

    return {
      content,
      path: relativePath,
      size: stat.size,
      language: getLanguage(resolved),
    }
  })
}
