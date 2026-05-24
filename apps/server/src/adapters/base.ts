import type { AgentStatus } from '@ai-cli/shared'

export interface CLIAdapter {
  /** CLI 工具的启动命令，如 'claude' 或 'aider' */
  startCommand: string

  /** 解析流式数据中的状态信号（信号1：流式正则） */
  parseStreamData(data: string): StateCandidate | null

  /** 解析 capture-pane 屏幕快照（信号2：按需确认） */
  parseScreenSnapshot(screen: string): AgentStatus | null

  /** 获取快捷操作映射（如 Approve/Deny 对应的按键） */
  getQuickActions(): QuickAction[]

  /** 是否支持结构化 JSON 输出（预留接口） */
  supportsStructuredOutput(): boolean
}

export interface StateCandidate {
  status: AgentStatus
  confidence: number // 0-1, 正则匹配置信度
}

export interface QuickAction {
  label: string // 显示文本，如 "Approve"
  payload: string // 发送给 pty 的按键，如 "\r" (Enter)
  description: string // 说明
}
