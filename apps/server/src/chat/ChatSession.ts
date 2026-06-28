import { spawn, type ChildProcess } from 'node:child_process'
import type { ProviderEvent } from '@ai-cli/shared'
import { pinoLogger } from '../lib/logger.js'
import type { ChatProvider, SpawnOpts } from './ChatProvider.js'

export type EventCallback = (event: ProviderEvent) => void
export type CrashCallback = (code: number | null, message: string) => void

export class ChatSession {
  private child: ChildProcess | null = null
  private killed = false
  private lastStderr = ''

  constructor(
    private readonly provider: ChatProvider,
    private readonly opts: SpawnOpts,
    private readonly onEvent: EventCallback,
    private readonly onCrash?: CrashCallback,
  ) {}

  start(): void {
    const args = this.provider.spawnArgs(this.opts)
    pinoLogger.info({ args: args.join(' '), cwd: this.opts.cwd }, 'ChatSession spawn')
    this.child = spawn('claude', args, {
      cwd: this.opts.cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child.stdout?.setEncoding('utf8')
    this.child.stderr?.setEncoding('utf8')
    this.child.stdout?.on('data', (chunk: string) => this.handleStdout(chunk))
    this.child.stderr?.on('data', (chunk: string) => this.handleStderr(chunk))
    this.child.on('exit', (code, signal) => this.handleExit(code, signal))
    this.child.on('error', (err) => {
      pinoLogger.error({ err }, 'ChatSession spawn error')
      this.onCrash?.(null, err.message)
    })
  }

  send(text: string): boolean {
    if (text.length > 256 * 1024) {
      pinoLogger.warn({ len: text.length }, 'ChatSession.send rejected: oversized')
      return false
    }
    if (!this.child?.stdin || !this.child.stdin.writable) return false
    this.provider.sendMessage(this.child.stdin, text)
    return true
  }

  kill(): void {
    this.killed = true
    if (this.child) {
      try {
        this.child.stdin?.end()
      } catch {
        /* ignore */
      }
      this.child.kill('SIGTERM')
    }
  }

  private handleStdout(chunk: string): void {
    for (const line of chunk.split('\n')) {
      if (!line) continue
      for (const event of this.provider.parseStreamLine(line)) this.onEvent(event)
    }
  }

  private handleStderr(chunk: string): void {
    if (/No conversation/i.test(chunk)) this.lastStderr = chunk
    pinoLogger.warn({ chunk }, 'ChatSession stderr')
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    pinoLogger.info({ code, signal, killed: this.killed }, 'ChatSession exit')
    if (this.killed || code === 0) return
    const msg = this.lastStderr || `claude exited with code ${code}`
    this.onCrash?.(code, msg)
  }
}
