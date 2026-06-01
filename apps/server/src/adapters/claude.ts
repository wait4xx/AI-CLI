import type { AgentStatus } from '@ai-cli/shared'
import type { CLIAdapter, StateCandidate, QuickAction } from './base.js'

const WAITING_APPROVAL_RE = /Do you want to|Approve or deny|\[Y\/n\]|\[y\/N\]|\bY\/n\b|\by\/n\b/i
const RUNNING_RE = /\bThinking\.{3}|\bGenerating\.{3}|\bWorking\.{3}/i
const IDLE_RE = /(?:\$\s|>\s)$/

const TEAM_SPAWN_RE =
  /\bSpawning (?:agent|teammate)\b|\bCreated teammate\b|\bDelegating to\b|\bHanding off to\b/i
const TEAM_AGENT_RE = /◆[\s]*\w+.*(?:agent|teammate)/i
const TEAM_RUNNING_RE = /\bagent\b.*\b(?:thinking|generating|working)\b|\bthinking\b.*\bagent\b/i
const TEAM_FINISHED_RE =
  /\bAgent (?:finished|completed|done)\b|\bTeammate (?:finished|completed)\b/i
const TEAM_WAITING_RE =
  /\bagent\b.*\b(?:approve|confirm|permission)\b|\bteammate\b.*\b(?:approve|confirm|permission)\b/i

const SCREEN_WAITING_APPROVAL_RE = /\bApprove\b|\bY\/n\b|\[Y\/n\]|\[y\/N\]/i
const SCREEN_RUNNING_RE = /\bThinking\b|\bGenerating\b|\bWorking\b|[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/
const SCREEN_IDLE_RE = /\$\s*$|>\s*$/
const SCREEN_TEAM_RE = /◆.*(?:agent|teammate)|●.*(?:agent|teammate)|\bSpawning\b.*\bagent\b/i

export interface ParsedOptions {
  status: AgentStatus | null
  options?: Array<{ label: string; payload: string }>
}

export class ClaudeCodeAdapter implements CLIAdapter {
  startCommand = 'claude'

  parseStreamData(data: string): StateCandidate | null {
    if (WAITING_APPROVAL_RE.test(data)) return { status: 'WAITING_APPROVAL', confidence: 0.7 }
    if (TEAM_WAITING_RE.test(data)) return { status: 'WAITING_APPROVAL', confidence: 0.6 }
    if (RUNNING_RE.test(data)) return { status: 'RUNNING', confidence: 0.7 }
    if (TEAM_SPAWN_RE.test(data)) return { status: 'RUNNING', confidence: 0.8 }
    if (TEAM_AGENT_RE.test(data) || TEAM_RUNNING_RE.test(data))
      return { status: 'RUNNING', confidence: 0.7 }
    if (TEAM_FINISHED_RE.test(data)) return { status: 'RUNNING', confidence: 0.5 }
    if (IDLE_RE.test(data)) return { status: 'IDLE', confidence: 0.7 }
    return null
  }

  parseScreenSnapshot(screen: string): ParsedOptions {
    const hasRunning = SCREEN_RUNNING_RE.test(screen)
    const hasWaitingApproval = SCREEN_WAITING_APPROVAL_RE.test(screen)
    const hasTeam = SCREEN_TEAM_RE.test(screen)

    if (hasWaitingApproval && !hasRunning) {
      return { status: 'WAITING_APPROVAL', options: this.extractOptions(screen) }
    }
    if (hasRunning) return { status: 'RUNNING' }
    if (hasTeam) return { status: 'RUNNING' }
    if (SCREEN_IDLE_RE.test(screen)) return { status: 'IDLE' }
    return { status: null }
  }

  private extractOptions(screen: string): Array<{ label: string; payload: string }> | undefined {
    const options: Array<{ label: string; payload: string }> = []
    const seen = new Set<string>()

    // Match (y)es/(n)o/(a)lways/(s)kip patterns
    const pattern = /\((\w)\)(\w*)/g
    let match
    while ((match = pattern.exec(screen)) !== null) {
      const key = match[1].toLowerCase()
      const rest = match[2]
      if (seen.has(key)) continue
      seen.add(key)
      options.push({ label: rest ? `${key})${rest}` : key, payload: `${key}\r` })
    }

    // Fallback: [Y/n] style
    if (options.length === 0) {
      const bracketMatch = screen.match(/\[([^\]]+)\]/)
      if (bracketMatch) {
        for (const part of bracketMatch[1].split('/')) {
          const isDefault = part === part.toUpperCase()
          const key = part.toLowerCase().trim()
          if (!seen.has(key)) {
            seen.add(key)
            options.push({ label: isDefault ? `${key} (default)` : key, payload: `${key}\r` })
          }
        }
      }
    }

    return options.length > 0 ? options : undefined
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
