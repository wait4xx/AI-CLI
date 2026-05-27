// 安全修复[W19]: Storage key 加入 sessionId 前缀，避免不同会话间的缓存互相覆盖
function getStorageKey(sessionId: string | null): string {
  const base = 'ai_cli_offline_cache'
  return sessionId ? `${base}_${sessionId}` : base
}
const MAX_QUEUED_INPUTS = 1000

interface CachedState {
  screenSnapshot: string
  timestamp: number
}

export class OfflineCache {
  private screenSnapshot: string = ''
  private inputQueue: Array<string | Uint8Array> = []
  private sessionId: string | null = null

  constructor(sessionId?: string) {
    this.sessionId = sessionId ?? null
    this.restore()
  }

  cacheScreen(data: string): void {
    this.screenSnapshot = data
    this.persist()
  }

  getCachedScreen(): string {
    return this.screenSnapshot
  }

  queueInput(data: string | Uint8Array): void {
    if (this.inputQueue.length >= MAX_QUEUED_INPUTS) {
      this.inputQueue.shift()
    }
    this.inputQueue.push(data)
    this.persist()
  }

  flushInputs(sendFn: (data: string | Uint8Array) => void): void {
    const queued = [...this.inputQueue]
    this.inputQueue = []
    for (const input of queued) {
      sendFn(input)
    }
    this.persist()
  }

  hasQueuedInputs(): boolean {
    return this.inputQueue.length > 0
  }

  clear(): void {
    this.screenSnapshot = ''
    this.inputQueue = []
    this.persist()
  }

  private persist(): void {
    try {
      // Only persist string inputs (Uint8Array can't be serialized to JSON easily)
      const serializableInputs = this.inputQueue.filter((i) => typeof i === 'string')
      sessionStorage.setItem(getStorageKey(this.sessionId), JSON.stringify({
        screenSnapshot: this.screenSnapshot,
        inputQueue: serializableInputs,
        sessionId: this.sessionId,
        timestamp: Date.now(),
      }))
    } catch {
      // sessionStorage may be full or unavailable
    }
  }

  private restore(): void {
    try {
      const raw = sessionStorage.getItem(getStorageKey(this.sessionId))
      if (!raw) return
      const data = JSON.parse(raw)
      if (data.sessionId === this.sessionId || !this.sessionId) {
        this.screenSnapshot = data.screenSnapshot ?? ''
        this.inputQueue = data.inputQueue ?? []
      }
    } catch {
      // Ignore parse errors
    }
  }
}
