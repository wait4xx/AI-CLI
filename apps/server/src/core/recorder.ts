export interface RecordedChunk {
  data: Buffer
  timestamp: number
}

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
    const active = this.chunks.slice(this.head)
    if (active.length === 0) return 0
    return active[active.length - 1].timestamp - active[0].timestamp
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
