import type { AgentStatus } from '@ai-cli/shared'
import type { CLIAdapter, StateCandidate, QuickAction } from './base.js'

const IDLE_RE = /^>\s*$/
const RUNNING_RE = /Running\.\.\./i
const WAITING_RE = /\(Y\)es.*\(N\)o.*\(A\)ll/i

const SCREEN_IDLE_RE = /^>\s*$/m
const SCREEN_RUNNING_RE = /Running\.\.\./i
const SCREEN_WAITING_RE = /\(Y\)es.*\(N\)o/i

export class AiderAdapter implements CLIAdapter {
  startCommand = 'aider'

  parseStreamData(data: string): StateCandidate | null {
    if (WAITING_RE.test(data)) {
      return { status: 'WAITING_APPROVAL', confidence: 0.8 }
    }
    if (RUNNING_RE.test(data)) {
      return { status: 'RUNNING', confidence: 0.7 }
    }
    if (IDLE_RE.test(data)) {
      return { status: 'IDLE', confidence: 0.7 }
    }
    return null
  }

  parseScreenSnapshot(screen: string): AgentStatus | null {
    if (SCREEN_WAITING_RE.test(screen)) {
      return 'WAITING_APPROVAL'
    }
    if (SCREEN_RUNNING_RE.test(screen)) {
      return 'RUNNING'
    }
    if (SCREEN_IDLE_RE.test(screen)) {
      return 'IDLE'
    }
    return null
  }

  getQuickActions(): QuickAction[] {
    return [
      { label: 'Apply', payload: 'y\r', description: 'Apply changes (y)' },
      { label: 'Reject', payload: 'n\r', description: 'Reject changes (n)' },
      { label: 'Cancel', payload: '\x03', description: 'Cancel (Ctrl+C)' },
    ]
  }

  supportsStructuredOutput(): boolean {
    return false
  }
}
