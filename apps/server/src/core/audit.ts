import fs from 'fs'
import path from 'path'

const AUDIT_LOG_PATH = path.join(process.env.PROJECT_ROOT || '/workspace', '.audit.log')

export type AuditEvent =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SESSION_CREATE'
  | 'SESSION_DESTROY'
  | 'FILE_READ'
  | 'FILE_WRITE'
  | 'WS_CONNECT'
  | 'WS_DISCONNECT'
  | 'USER_LIST'
  | 'USER_CREATE'
  | 'USER_DELETE'
  | 'USER_PASSWORD_CHANGE'

export function auditLog(event: AuditEvent, userId?: string, details?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    userId: userId ?? null,
    details: details ?? null,
  }

  try {
    fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8')
  } catch (err) {
    import('../lib/logger.js').then(({ pinoLogger }) => pinoLogger.error({ err }, 'Failed to write audit log')).catch(() => {})
  }
}
