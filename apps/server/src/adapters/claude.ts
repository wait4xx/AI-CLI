import type { AgentStatus } from '@ai-cli/shared'
import type { CLIAdapter, StateCandidate, QuickAction } from './base.js'

const WAITING_APPROVAL_RE =
  /Do you want to|Approve or deny|\[Y\/n\]|\[y\/N\]|\bY\/n\b|\by\/n\b/i
const RUNNING_RE = /\bThinking\.{3}|\bGenerating\.{3}|\bWorking\.{3}/i
const IDLE_RE = /(?:\$\s|>\s)$/

const SCREEN_WAITING_APPROVAL_RE = /\bApprove\b|\bY\/n\b|\[Y\/n\]|\[y\/N\]/i
const SCREEN_RUNNING_RE =
  /\bThinking\b|\bGenerating\b|\bWorking\b|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/ // spinner chars
const SCREEN_IDLE_RE = /\$\s*$|>\s*$/

export class ClaudeCodeAdapter implements CLIAdapter {
  startCommand = 'claude'

  parseStreamData(data: string): StateCandidate | null {
    if (WAITING_APPROVAL_RE.test(data)) {
      return { status: 'WAITING_APPROVAL', confidence: 0.7 }
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
    const hasRunning = SCREEN_RUNNING_RE.test(screen)
    const hasWaitingApproval = SCREEN_WAITING_APPROVAL_RE.test(screen)

    if (hasWaitingApproval && !hasRunning) {
      return 'WAITING_APPROVAL'
    }
    if (hasRunning) {
      return 'RUNNING'
    }
    if (SCREEN_IDLE_RE.test(screen)) {
      return 'IDLE'
    }
    return null
  }

  getQuickActions(): QuickAction[] {
    return [
      { label: 'Approve', payload: '\r', description: '确认操作 (Enter)' },
      { label: 'Deny', payload: 'n\r', description: '拒绝操作 (n + Enter)' },
      { label: 'Cancel', payload: '\x03', description: '取消当前操作 (Ctrl+C)' },
    ]
  }

  supportsStructuredOutput(): boolean {
    return false
  }
}
