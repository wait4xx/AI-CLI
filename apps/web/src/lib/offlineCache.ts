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
    this.removeFromStorage()
  }

  // [M3修复] Uint8Array 转 base64 序列化
  private serializeInput(input: string | Uint8Array): { type: 'string' | 'uint8array'; value: string } {
    if (typeof input === 'string') return { type: 'string', value: input }
    // Uint8Array → base64
    let binary = ''
    for (let i = 0; i < input.length; i++) binary += String.fromCharCode(input[i])
    return { type: 'uint8array', value: btoa(binary) }
  }

  // [M3修复] base64 还原为 Uint8Array
  private deserializeInput(entry: { type: string; value: string }): string | Uint8Array {
    if (entry.type === 'string') return entry.value
    const binary = atob(entry.value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  private persist(): void {
    try {
      const serializableInputs = this.inputQueue.map((i) => this.serializeInput(i))
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
      // [Q1修复] TTL 过期机制：缓存超过 24 小时自动清理
      const TTL_MS = 24 * 60 * 60 * 1000
      if (data.timestamp && Date.now() - data.timestamp > TTL_MS) {
        this.removeFromStorage()
        return
      }
      if (data.sessionId === this.sessionId || !this.sessionId) {
        this.screenSnapshot = data.screenSnapshot ?? ''
        if (Array.isArray(data.inputQueue)) {
          this.inputQueue = data.inputQueue.map((entry: { type: string; value: string }) =>
            this.deserializeInput(entry),
          )
        } else {
          this.inputQueue = []
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // [Q1修复] 从 sessionStorage 彻底移除缓存条目
  private removeFromStorage(): void {
    try {
      sessionStorage.removeItem(getStorageKey(this.sessionId))
    } catch {
      // sessionStorage may be unavailable
    }
  }
}
