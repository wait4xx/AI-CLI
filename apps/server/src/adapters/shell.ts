import path from 'path'
import type { AgentStatus } from '@ai-cli/shared'
import type { CLIAdapter, StateCandidate, QuickAction } from './base.js'
import { getConfig } from '../lib/config.js'

const ALLOWED_SHELLS = new Set(['bash', 'sh', 'zsh', 'fish'])

// Claude Code detection patterns (shared with ClaudeCodeAdapter)
const CC_WAITING_RE = /Do you want to|Approve or deny|\[Y\/n\]|\[y\/N\]|\bY\/n\b|\by\/n\b/i
const CC_RUNNING_RE = /\bThinking\.{3}|\bGenerating\.{3}|\bWorking\.{3}/i
const CC_IDLE_RE = /(?:\$\s|>\s)$/
const CC_TEAM_SPAWN_RE =
  /\bSpawning (?:agent|teammate)\b|\bCreated teammate\b|\bDelegating to\b|\bHanding off to\b/i
const CC_TEAM_AGENT_RE = /[◆●][\s]*\w+.*(?:agent|teammate)/i
const CC_TEAM_RUNNING_RE = /\bagent\b.*\b(?:thinking|generating|working)\b|\bthinking\b.*\bagent\b/i
const CC_TEAM_FINISHED_RE =
  /\bAgent (?:finished|completed|done)\b|\bTeammate (?:finished|completed)\b/i
const CC_TEAM_WAITING_RE =
  /\bagent\b.*\b(?:approve|confirm|permission)\b|\bteammate\b.*\b(?:approve|confirm|permission)\b/i
const CC_SCREEN_RUNNING_RE = /\bThinking\b|\bGenerating\b|\bWorking\b|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/
const CC_SCREEN_WAITING_RE = /\bApprove\b|\bY\/n\b|\[Y\/n\]|\[y\/N\]/i
const CC_SCREEN_TEAM_RE = /◆.*(?:agent|teammate)|●.*(?:agent|teammate)|\bSpawning\b.*\bagent\b/i

export class ShellAdapter implements CLIAdapter {
  startCommand: string

  constructor() {
    const shell = getConfig().SHELL_CMD
    const base = path.basename(path.resolve(shell))
    if (!ALLOWED_SHELLS.has(base)) {
      throw new Error(`Shell not allowed: ${base}. Allowed: ${[...ALLOWED_SHELLS].join(', ')}`)
    }
    this.startCommand = shell
  }

  parseStreamData(data: string): StateCandidate | null {
    if (CC_WAITING_RE.test(data)) return { status: 'WAITING_APPROVAL', confidence: 0.7 }
    if (CC_TEAM_WAITING_RE.test(data)) return { status: 'WAITING_APPROVAL', confidence: 0.6 }
    if (CC_RUNNING_RE.test(data)) return { status: 'RUNNING', confidence: 0.7 }
    if (CC_TEAM_SPAWN_RE.test(data)) return { status: 'RUNNING', confidence: 0.8 }
    if (CC_TEAM_AGENT_RE.test(data) || CC_TEAM_RUNNING_RE.test(data))
      return { status: 'RUNNING', confidence: 0.7 }
    if (CC_TEAM_FINISHED_RE.test(data)) return { status: 'RUNNING', confidence: 0.5 }
    if (CC_IDLE_RE.test(data)) return { status: 'IDLE', confidence: 0.7 }
    return null
  }

  parseScreenSnapshot(screen: string): AgentStatus | null {
    const hasRunning = CC_SCREEN_RUNNING_RE.test(screen)
    const hasWaiting = CC_SCREEN_WAITING_RE.test(screen)
    const hasTeam = CC_SCREEN_TEAM_RE.test(screen)

    if (hasWaiting && !hasRunning) return 'WAITING_APPROVAL'
    if (hasRunning) return 'RUNNING'
    if (hasTeam) return 'RUNNING'
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
