import fs from 'fs'
import path from 'path'

export interface PersistedSession {
  sessionId: string
  adapterName: string
  tmuxSessionName: string
  status: string
  ownerId: string   // [C1修复] 持久化会话归属用户ID
  createdAt: string
  lastActive: string
}

const SESSIONS_FILE_PATH = path.join(
  process.env.PROJECT_ROOT || '/workspace',
  '.sessions.json',
)

export class SessionStore {
  private data = new Map<string, PersistedSession>()

  load(): void {
    try {
      if (fs.existsSync(SESSIONS_FILE_PATH)) {
        const raw = fs.readFileSync(SESSIONS_FILE_PATH, 'utf-8')
        const parsed: Record<string, PersistedSession> = JSON.parse(raw)
        for (const [key, value] of Object.entries(parsed)) {
          this.data.set(key, value)
        }
      }
    } catch {
      // File doesn't exist or is invalid — start fresh
    }
  }

  save(): void {
    try {
      const dir = path.dirname(SESSIONS_FILE_PATH)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const obj: Record<string, PersistedSession> = {}
      for (const [key, value] of this.data.entries()) {
        obj[key] = value
      }
      fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(obj, null, 2), 'utf-8')
    } catch {
      // Best-effort persistence
    }
  }

  get(sessionId: string): PersistedSession | undefined {
    return this.data.get(sessionId)
  }

  set(sessionId: string, data: PersistedSession): void {
    this.data.set(sessionId, data)
    this.save()
  }

  delete(sessionId: string): boolean {
    const existed = this.data.delete(sessionId)
    if (existed) this.save()
    return existed
  }

  entries(): IterableIterator<[string, PersistedSession]> {
    return this.data.entries()
  }

  has(sessionId: string): boolean {
    return this.data.has(sessionId)
  }
}
