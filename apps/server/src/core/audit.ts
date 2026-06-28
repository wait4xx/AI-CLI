import { createWriteStream, WriteStream } from 'fs'
import path from 'path'
import { pinoLogger } from '../lib/logger.js'
import { getConfig } from '../lib/config.js'

function getAuditLogPath(): string {
  return path.join(getConfig().DATA_DIR, 'audit.log')
}

export type AuditEvent =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SESSION_CREATE'
  | 'SESSION_DESTROY'
  | 'FILE_READ'
  | 'FILE_WRITE'
  | 'FILE_WRITE_BLOCKED'
  | 'WS_CONNECT'
  | 'WS_DISCONNECT'
  | 'USER_LIST'
  | 'USER_CREATE'
  | 'USER_DELETE'
  | 'USER_PASSWORD_CHANGE'
  | 'USER_ROLE_CHANGE'
  | 'TMUX_KILL'
  | 'TMUX_RENAME'
  | 'FILE_DELETE'
  | 'MKDIR'
  | 'FILE_RENAME'
  | 'FILE_CREATE'
  | 'FILE_UPLOAD'
  | 'FILE_UPLOAD_DANGEROUS_EXT'
  | 'FILE_COMPRESS'
  | 'CHAT_CREATE'
  | 'CHAT_SEND'
  | 'CHAT_ESCALATE'
  | 'CHAT_SWITCH_VIEW'
  | 'CHAT_CRASHED'

// [S6修复] 使用 createWriteStream 异步写入，避免 appendFileSync 阻塞事件循环
let stream: WriteStream | null = null

function getStream(): WriteStream {
  if (!stream) {
    stream = createWriteStream(getAuditLogPath(), { flags: 'a' })
    stream.on('error', (err) => {
      pinoLogger.error({ err }, 'Audit log stream error')
      // Reset stream so next call creates a fresh one
      stream?.destroy()
      stream = null
    })
  }
  return stream
}

export function auditLog(
  event: AuditEvent,
  userId?: string,
  details?: Record<string, unknown>,
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    userId: userId ?? null,
    details: details ?? null,
  }

  const line = JSON.stringify(entry) + '\n'

  try {
    const ok = getStream().write(line)
    if (!ok) {
      // Backpressure: stream buffer is full, log a warning
      pinoLogger.warn('Audit log write returned false (backpressure)')
    }
  } catch (err) {
    pinoLogger.error({ err }, 'Failed to write audit log, retrying with fresh stream')
    // Destroy current stream and retry with a fresh one
    stream?.destroy()
    stream = null
    try {
      getStream().write(line)
    } catch (retryErr) {
      pinoLogger.error({ err: retryErr }, 'Audit log retry also failed')
    }
  }
}

/**
 * Close the audit log stream. Call on server shutdown to flush pending writes.
 * Uses end() to ensure all buffered data is flushed before closing.
 */
export function closeAuditLog(): Promise<void> {
  return new Promise((resolve) => {
    if (stream) {
      stream.end(() => {
        stream = null
        resolve()
      })
    } else {
      resolve()
    }
  })
}
