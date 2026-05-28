export interface RecordedChunk {
  data: Buffer
  timestamp: number
}

const MAX_CHUNKS = 100_000 // Upper bound to prevent unbounded memory growth

export class SessionRecorder {
  private chunks: RecordedChunk[] = []
  private head = 0  // dequeue index pointer (S4 fix)
  private maxDurationMs: number
  private recording = false
  private startTime: number | null = null

  constructor(maxDurationMs: number = 30 * 60 * 1000) {
    this.maxDurationMs = maxDurationMs
  }

  start(): void {
    this.recording = true
    this.startTime = Date.now()
    this.chunks = []
    this.head = 0
  }

  stop(): void {
    this.recording = false
  }

  isRecording(): boolean {
    return this.recording
  }

  record(chunk: Buffer, timestamp: number): void {
    if (!this.recording) return

    // [R6修复] 防止无限增长：超过最大块数时丢弃最旧数据
    if (this.chunks.length >= MAX_CHUNKS) {
      this.head = Math.max(this.head, Math.floor(MAX_CHUNKS / 4))
      if (this.head > this.chunks.length / 2) {
        this.chunks = this.chunks.slice(this.head)
        this.head = 0
      }
    }

    this.chunks.push({ data: chunk, timestamp })

    // Auto-trim old data beyond max duration using index pointer
    const cutoff = Date.now() - this.maxDurationMs
    while (this.head < this.chunks.length && this.chunks[this.head].timestamp < cutoff) {
      this.head++
    }

    // Periodically compact the array to free memory
    if (this.head > this.chunks.length / 2) {
      this.chunks = this.chunks.slice(this.head)
      this.head = 0
    }
  }

  getPlayback(startTime?: number, endTime?: number): RecordedChunk[] {
    if (this.head >= this.chunks.length) return []
    let result = this.chunks.slice(this.head)

    if (startTime !== undefined) {
      result = result.filter((c) => c.timestamp >= startTime)
    }
    if (endTime !== undefined) {
      result = result.filter((c) => c.timestamp <= endTime)
    }

    return result
  }

  getDuration(): number {
    if (this.head >= this.chunks.length) return 0
    const first = this.chunks[this.head]
    const last = this.chunks[this.chunks.length - 1]
    return last.timestamp - first.timestamp
  }

  getStartTime(): number | null {
    return this.startTime
  }

  clear(): void {
    this.chunks = []
    this.head = 0
    this.recording = false
    this.startTime = null
  }
}
