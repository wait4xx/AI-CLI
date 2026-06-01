import fs from 'fs'
import path from 'path'
import { pinoLogger } from '../lib/logger.js'
import { getConfig } from '../lib/config.js'

export interface PersistedSession {
  sessionId: string
  adapterName: string
  tmuxSessionName: string
  status: string
  ownerId: string // [C1修复] 持久化会话归属用户ID
  createdAt: string
  lastActive: string
}

function getSessionsFilePath(): string {
  return path.join(getConfig().DATA_DIR, 'sessions.json')
}

export class SessionStore {
  private data = new Map<string, PersistedSession>()
  private dirty = false
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private static SAVE_DEBOUNCE_MS = 500 // Debounce saves to reduce disk I/O

  // [M-#5修复] 改为异步 load，使用 fs.promises.readFile 避免阻塞事件循环
  async load(): Promise<void> {
    try {
      const sessionsFilePath = getSessionsFilePath()
      const { promises: fsp } = fs
      const raw = await fsp.readFile(sessionsFilePath, 'utf-8')
      const parsed: Record<string, PersistedSession> = JSON.parse(raw)
      for (const [key, value] of Object.entries(parsed)) {
        this.data.set(key, value)
      }
    } catch {
      // File doesn't exist or is invalid — start fresh
    }
  }

  private async writeToFile(): Promise<void> {
    try {
      const sessionsFilePath = getSessionsFilePath()
      const dir = path.dirname(sessionsFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const obj: Record<string, PersistedSession> = {}
      for (const [key, value] of this.data.entries()) {
        obj[key] = value
      }
      // [S5修复] write-then-rename 原子写入，防止写入中途崩溃导致数据损坏
      const tmpPath = sessionsFilePath + '.tmp'
      const { promises: fsp } = fs
      await fsp.writeFile(tmpPath, JSON.stringify(obj, null, 2), 'utf-8')
      await fsp.rename(tmpPath, sessionsFilePath)
      this.dirty = false
    } catch (err) {
      pinoLogger.error({ err }, 'Failed to persist session store')
    }
  }

  /**
   * Schedule a debounced save. Multiple rapid mutations coalesce into one write.
   */
  private scheduleSave(): void {
    this.dirty = true
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      if (this.dirty) {
        void this.writeToFile()
      }
    }, SessionStore.SAVE_DEBOUNCE_MS)
  }

  /**
   * Force immediate save (e.g., on shutdown).
   */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
      this.saveTimer = null
    }
    if (this.dirty) {
      await this.writeToFile()
    }
  }

  get(sessionId: string): PersistedSession | undefined {
    return this.data.get(sessionId)
  }

  set(sessionId: string, data: PersistedSession): void {
    this.data.set(sessionId, data)
    this.scheduleSave()
  }

  delete(sessionId: string): boolean {
    const existed = this.data.delete(sessionId)
    if (existed) this.scheduleSave()
    return existed
  }

  entries(): IterableIterator<[string, PersistedSession]> {
    return this.data.entries()
  }

  has(sessionId: string): boolean {
    return this.data.has(sessionId)
  }
}
