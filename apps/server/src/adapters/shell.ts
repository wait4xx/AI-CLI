import type { AgentStatus } from '@ai-cli/shared'
import type { CLIAdapter, StateCandidate, QuickAction } from './base.js'

export class ShellAdapter implements CLIAdapter {
  startCommand: string

  constructor() {
    this.startCommand = process.env.SHELL_CMD || 'bash'
  }

  parseStreamData(_data: string): StateCandidate | null {
    // Generic shell — always IDLE, no state detection
    return null
  }

  parseScreenSnapshot(_screen: string): AgentStatus | null {
    return null
  }

  getQuickActions(): QuickAction[] {
    return [
      { label: 'Cancel', payload: '\x03', description: 'Cancel current command (Ctrl+C)' },
    ]
  }

  supportsStructuredOutput(): boolean {
    return false
  }
}
