import fs from 'fs'
import path from 'path'
import { readFile } from 'fs/promises'
import { getConfig } from '../lib/config.js'
import { pinoLogger } from '../lib/logger.js'

export interface FileChangeEvent {
  path: string
  oldContent: string
  newContent: string
}

type ChangeCallback = (event: FileChangeEvent) => void

const DEBOUNCE_MS = 300
const MAX_FILE_SIZE = 2 * 1024 * 1024
// [M-#6修复] 递归监听目录最大深度限制
const MAX_DEPTH = 10
const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  '.claude',
  'dist',
  '__pycache__',
  '.next',
  '.cache',
])
const IGNORED_EXTS = new Set(['.log', '.tmp', '.swp', '.swo', '.lock'])

function shouldIgnore(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  if (IGNORED_EXTS.has(ext)) return true
  const parts = filePath.split(path.sep)
  return parts.some((p) => IGNORED_DIRS.has(p))
}

export class FileWatcher {
  private static MAX_CACHE_SIZE = 500
  private watchers = new Map<string, fs.FSWatcher>()
  private contentCache = new Map<string, string>()
  private pending = new Map<string, ReturnType<typeof setTimeout>>()
  private callback: ChangeCallback | null = null

  start(callback: ChangeCallback): void {
    this.callback = callback
    const root = getConfig().PROJECT_ROOT

    try {
      this.watchDir(root)
      this.seedCache(root)
      pinoLogger.info({ root }, 'FileWatcher started (recursive manual mode)')
    } catch (err) {
      pinoLogger.warn({ err }, 'FileWatcher failed to start')
    }
  }

  private seedCache(_dirPath: string, _depth = 0): void {
    // Seeding the entire PROJECT_ROOT into memory causes OOM when root is ~.
    // Content cache is populated on-demand in handleChange instead.
  }

  // [M-#6修复] watchDir 添加 depth 参数，超过 MAX_DEPTH 时停止递归
  private watchDir(dirPath: string, depth: number = 0): void {
    if (depth > MAX_DEPTH) return
    if (this.watchers.has(dirPath)) return
    const basename = path.basename(dirPath)
    if (IGNORED_DIRS.has(basename)) return

    try {
      const watcher = fs.watch(dirPath, { persistent: false }, (eventType, filename) => {
        if (!filename) return
        const fullPath = path.join(dirPath, filename)

        if (eventType === 'rename') {
          // New directory created — watch it
          try {
            const stat = fs.statSync(fullPath)
            // [M-#6修复] 递归时 depth + 1
            if (stat.isDirectory()) this.watchDir(fullPath, depth + 1)
          } catch {
            /* deleted or inaccessible */
          }
        }

        if (shouldIgnore(fullPath)) return

        const existing = this.pending.get(fullPath)
        if (existing) clearTimeout(existing)

        this.pending.set(
          fullPath,
          setTimeout(() => {
            this.pending.delete(fullPath)
            this.handleChange(fullPath)
          }, DEBOUNCE_MS),
        )
      })

      watcher.on('error', () => {
        /* ignore per-dir errors */
      })
      this.watchers.set(dirPath, watcher)

      // Recursively watch existing subdirectories
      try {
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
          if (entry.isDirectory() && !IGNORED_DIRS.has(entry.name)) {
            // [M-#6修复] 递归时 depth + 1
            this.watchDir(path.join(dirPath, entry.name), depth + 1)
          }
        }
      } catch {
        /* permission denied, etc. */
      }
    } catch {
      /* dir may not exist */
    }
  }

  private async handleChange(fullPath: string): Promise<void> {
    if (!this.callback) return
    try {
      const stat = fs.statSync(fullPath)
      if (!stat.isFile() || stat.size > MAX_FILE_SIZE) return
    } catch {
      return
    }

    let newContent: string
    try {
      newContent = await readFile(fullPath, 'utf-8')
    } catch {
      return
    }

    const oldContent = this.contentCache.get(fullPath) ?? ''
    if (oldContent === newContent) return

    this.contentCache.set(fullPath, newContent)

    // Evict oldest entries when cache exceeds limit
    if (this.contentCache.size > FileWatcher.MAX_CACHE_SIZE) {
      const keysIter = this.contentCache.keys()
      const toDelete = this.contentCache.size - FileWatcher.MAX_CACHE_SIZE
      for (let i = 0; i < toDelete; i++) {
        const oldest = keysIter.next().value as string | undefined
        if (oldest && oldest !== fullPath) this.contentCache.delete(oldest)
      }
    }

    const root = getConfig().PROJECT_ROOT
    const relativePath = path.relative(root, fullPath)

    this.callback({ path: relativePath, oldContent, newContent })
  }

  stop(): void {
    for (const watcher of this.watchers.values()) watcher.close()
    this.watchers.clear()
    for (const timer of this.pending.values()) clearTimeout(timer)
    this.pending.clear()
    this.contentCache.clear()
    pinoLogger.info('FileWatcher stopped')
  }
}
