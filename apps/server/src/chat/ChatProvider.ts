import type { Writable } from 'node:stream'
import type { ChatPermissionTier, ProviderEvent } from '@ai-cli/shared'

export interface SpawnOpts {
  claudeSessionId: string // UUID,用于 --session-id 跨视图续接
  cwd: string
  tier: ChatPermissionTier // Explore=plan / Edit=acceptEdits
  resume: boolean // 首次启动 false;切换/重启续接 true
  model?: string // 可选,强制 --model 规避 resume 钉住旧 model
}

/**
 * ChatProvider —— 把各家 CLI 的 headless 输出归一化为 ProviderEvent。
 * 与终端路径的 CLIAdapter(PTY/正则)平行,职责不同,不复用。
 */
export interface ChatProvider {
  readonly id: string
  /** 构造 spawn 参数(不含可执行文件名) */
  spawnArgs(opts: SpawnOpts): string[]
  /** 把一条用户消息写进 stdin(各家 NDJSON/文本格式不同) */
  sendMessage(stdin: Writable, text: string): void
  /** 把 stdout 的一行原始 JSON 解析为 0..n 个归一化事件 */
  parseStreamLine(line: string): ProviderEvent[]
  /** 该 provider 支持的权限档位 */
  availableTiers(): ChatPermissionTier[]
  /** 是否支持 --resume 跨视图续接(Claude=true) */
  supportsResume(): boolean
}
