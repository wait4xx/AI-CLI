import path from 'path'
import type { AgentStatus } from '@ai-cli/shared'
import type { CLIAdapter, StateCandidate, QuickAction } from './base.js'
import { getConfig } from '../lib/config.js'

const ALLOWED_SHELLS = new Set(['bash', 'sh', 'zsh', 'fish'])

export class ShellAdapter implements CLIAdapter {
  startCommand: string

  constructor() {
    const shell = getConfig().SHELL_CMD
    // [N5修复] 先 resolve 防止路径遍历绕过（如 /usr/bin/../../../bin/bash），再取 basename
    const base = path.basename(path.resolve(shell))
    if (!ALLOWED_SHELLS.has(base)) {
      throw new Error(`Shell not allowed: ${base}. Allowed: ${[...ALLOWED_SHELLS].join(', ')}`)
    }
    this.startCommand = shell
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
