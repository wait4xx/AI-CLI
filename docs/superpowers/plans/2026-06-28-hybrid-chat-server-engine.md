# 混合对话视图 —— 服务端对话引擎 实现计划 (Plan 1/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可独立测试的服务端「对话引擎」—— 用 headless `claude -p stream-json` 驱动对话会话,产出归一化事件,支持终端/对话视图切换与权限提权,经 WS 暴露给前端。

**Architecture:** 新建 `apps/server/src/chat/` 模块(平行于现有 `adapters/` + `core/SessionManager`,完全不改动终端路径)。`ChatProvider` 接口把各家 CLI 的 headless 输出归一化为 `ProviderEvent`;`ClaudeCodeProvider` 是首个实现;`ChatSession` 管理一个 headless 子进程;`Conversation` 是主体实体(持有 claudeSessionId,协调视图切换/提权);`ConversationManager` 是注册表;`ChatGateway` 经 `/ws/chat` 暴露给前端。

**Tech Stack:** TypeScript、Node.js `child_process.spawn`、Fastify `@fastify/websocket`、Vitest。设计依据见 `docs/superpowers/specs/2026-06-28-hybrid-chat-view-design.md` §2(实测验证的技术地基)。

**范围说明:** 本计划只做服务端。前端 UI(ChatView/MessageBubble/ToolCallCard/ChatInput/ModeSwitch + store + NewSessionDrawer 接入)是 Plan 2,待本计划落地后另开。

---

## File Structure

| 文件                                              | 责任                                                                | 动作 |
| ------------------------------------------------- | ------------------------------------------------------------------- | ---- |
| `packages/shared/src/protocol.ts`                 | 协议类型(追加 chat 相关类型)                                        | 修改 |
| `apps/server/src/chat/ChatProvider.ts`            | `ChatProvider` 接口 + `SpawnOpts`/`ProviderEvent` 复导出            | 创建 |
| `apps/server/src/chat/ClaudeCodeProvider.ts`      | Claude Code 的 headless 实现(spawnArgs/sendMessage/parseStreamLine) | 创建 |
| `apps/server/src/chat/ChatSession.ts`             | 管理 headless 子进程(spawn/stdin/stdout 行解析/exit/背压)           | 创建 |
| `apps/server/src/chat/Conversation.ts`            | 主体实体(claudeSessionId/视图/提权/切换/发消息/崩溃恢复)            | 创建 |
| `apps/server/src/chat/ConversationManager.ts`     | Conversation 注册表 + provider 注册表                               | 创建 |
| `apps/server/src/chat/ChatGateway.ts`             | `/ws/chat` 连接处理(鉴权/分发/广播)                                 | 创建 |
| `apps/server/src/routes/chat.ts`                  | `/ws/chat` Fastify 路由                                             | 创建 |
| `apps/server/src/index.ts`                        | 装配 ConversationManager/ChatGateway + 注册路由                     | 修改 |
| `apps/server/src/__tests__/chat/fixtures/*.jsonl` | 真实 stream-json 样本                                               | 创建 |
| `apps/server/src/__tests__/chat/*.test.ts`        | 单测                                                                | 创建 |

**约定:** 所有新文件用 ESM + `.js` 扩展名 import(项目用 NodeNext,见现有 `adapters/claude.js` 写法)。日志用 `pinoLogger`(见 `lib/logger.ts`)。

---

## Task 0: 捕获真实 stream-json fixture

真实样本驱动后续解析器 TDD。`claude` stream-json 的 `init` 事件会 dump 全部 skill/tool(单行 >40KB),必须过滤。

**Files:**

- Create: `apps/server/src/__tests__/chat/fixtures/capture.mjs`
- Create: `apps/server/src/__tests__/chat/fixtures/claude-stream-sample.jsonl`

- [ ] **Step 1: 写捕获脚本(过滤超长 init/hook 行,只留消息与工具事件)**

Create `apps/server/src/__tests__/chat/fixtures/capture.mjs`:

```js
// 捕获 Claude Code headless stream-json 样本,过滤超长 system 行,只保留
// assistant/user/result 事件,作为解析器测试 fixture。用法: node capture.mjs
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'

const out = createWriteStream(new URL('./claude-stream-sample.jsonl', import.meta.url))
const args = [
  '-p',
  '--output-format',
  'stream-json',
  '--include-partial-messages',
  '--verbose',
  '--permission-mode',
  'acceptEdits',
]
const child = spawn('claude', args, { cwd: process.cwd() })
child.stdin.write('Read the file package.json and list its top-level keys as a one-line summary.\n')
child.stdin.end()

let kept = 0
child.stdout.on('data', (chunk) => {
  for (const line of chunk.toString().split('\n')) {
    if (!line.startsWith('{')) continue
    if (line.length > 2000) continue
    try {
      const ev = JSON.parse(line)
      if (!['assistant', 'user', 'result'].includes(ev.type)) continue
      out.write(line + '\n')
      kept++
    } catch {
      /* 非 JSON 行,丢弃 */
    }
  }
})
child.on('close', () => {
  out.end()
  console.log(`captured ${kept} lines`)
})
```

- [ ] **Step 2: 运行捕获**

Run: `cd apps/server && node src/__tests__/chat/fixtures/capture.mjs`
Expected: 输出 `captured N lines` (N 通常 10–60),`claude-stream-sample.jsonl` 生成且每行 < 2KB。

- [ ] **Step 3: 人工核对样本包含关键事件**

Run: `grep -oE '"type":"[a-z_]+"' apps/server/src/__tests__/chat/fixtures/claude-stream-sample.jsonl | sort | uniq -c`
Expected: 至少出现 `assistant`、`user`、`result`,以及内容块类型 `text`/`tool_use`/`tool_result`(在 `message.content` 里)。**记下实际的内容块结构**(后续 Task 4 解析器据此调整)。

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/__tests__/chat/fixtures/
git commit -m "test(chat): capture real claude stream-json fixtures"
```

---

## Task 1: 共享协议类型

**Files:**

- Modify: `packages/shared/src/protocol.ts`(在文件末尾追加)

- [ ] **Step 1: 追加 chat 协议类型**

在 `packages/shared/src/protocol.ts` 末尾追加:

```ts
// ============================================================
// Hybrid Chat View (Tier 3) —— 混合对话视图协议
// ============================================================

// headless 对话权限档位(实测: plan 干净只读 / acceptEdits 干净自动编辑;
// default 在 headless 下死等挂起,永不暴露)。见设计文档 §2.2
export type ChatPermissionTier = 'Explore' | 'Edit'

// 视图模式: terminal=交互式 PTY(现有路径) / chat=headless 对话
export type ChatViewMode = 'terminal' | 'chat'

// ChatProvider 归一化事件(无 transport 关切;gateway 会包上 conversationId)
export type ProviderEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call-start'; callId: string; toolName: string; inputSummary: string }
  | { type: 'tool-result'; callId: string; status: 'success' | 'error'; outputSnippet: string }
  | { type: 'status'; state: 'thinking' | 'working' | 'idle' }
  | { type: 'error'; message: string }
  | { type: 'done' }

// 对话历史条目(messageLog 用)
export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  ts: number
}

// Chat 通道 客户端 → 服务端
export type ChatClientMessage =
  | { type: 'CHAT_AUTH'; accessToken: string; protocolVersion: string }
  | {
      type: 'CHAT_CREATE'
      cwd: string
      claudeSessionId: string
      providerId?: string
      initialTier?: ChatPermissionTier
    }
  | { type: 'CHAT_ATTACH'; conversationId: string }
  | { type: 'CHAT_RECONNECT'; conversationId: string }
  | { type: 'CHAT_SEND'; conversationId: string; text: string }
  | { type: 'CHAT_SWITCH_VIEW'; conversationId: string; viewMode: ChatViewMode }
  | { type: 'CHAT_ESCALATE'; conversationId: string; tier: ChatPermissionTier }
  | { type: 'CHAT_PING' }

// Chat 通道 服务端 → 客户端
export type ChatServerMessage =
  | { type: 'CHAT_AUTH_OK' }
  | { type: 'CHAT_PONG' }
  | {
      type: 'CHAT_CREATED'
      conversationId: string
      claudeSessionId: string
      tier: ChatPermissionTier
      viewMode: ChatViewMode
    }
  | { type: 'CHAT_EVENT'; conversationId: string; event: ProviderEvent }
  | {
      type: 'CHAT_VIEW_CHANGED'
      conversationId: string
      viewMode: ChatViewMode
      tier: ChatPermissionTier
    }
  | {
      type: 'CHAT_CRASHED'
      conversationId: string
      message: string
      resumable: boolean
    }
  | { type: 'CHAT_HISTORY'; conversationId: string; messages: ChatMessage[] }
  | { type: 'CHAT_ERROR'; message: string }
```

- [ ] **Step 2: 确认 shared 包导出这些类型**

Run: `grep -n "export" packages/shared/src/index.ts`
Expected: 若 `index.ts` 用 `export * from './protocol.js'` 则已自动导出;否则补 `export type { ProviderEvent, ChatPermissionTier, ChatViewMode, ChatClientMessage, ChatServerMessage, ChatMessage } from './protocol.js'`。核实后按需修改。

- [ ] **Step 3: 构建 shared 包确认类型无误**

Run: `cd packages/shared && pnpm build`
Expected: `tsc` 无错(产出到 `dist/`)。

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/protocol.ts packages/shared/src/index.ts packages/shared/dist/
git commit -m "feat(shared): add hybrid chat view protocol types"
```

---

## Task 2: ChatProvider 接口

**Files:**

- Create: `apps/server/src/chat/ChatProvider.ts`

- [ ] **Step 1: 写接口定义**

Create `apps/server/src/chat/ChatProvider.ts`:

```ts
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
```

- [ ] **Step 2: 确认类型可编译**

Run: `cd apps/server && npx tsc --noEmit`
Expected: 无错。

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/chat/ChatProvider.ts
git commit -m "feat(chat): add ChatProvider interface"
```

---

## Task 3: ClaudeCodeProvider —— spawnArgs / tiers / supportsResume

**Files:**

- Create: `apps/server/src/chat/ClaudeCodeProvider.ts`
- Create: `apps/server/src/__tests__/chat/ClaudeCodeProvider.test.ts`

- [ ] **Step 1: 写失败测试(spawnArgs / tiers / supportsResume)**

Create `apps/server/src/__tests__/chat/ClaudeCodeProvider.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ClaudeCodeProvider } from '../../chat/ClaudeCodeProvider.js'

describe('ClaudeCodeProvider — basics', () => {
  const p = new ClaudeCodeProvider()

  it('id is claude-code', () => {
    expect(p.id).toBe('claude-code')
  })

  it('supports Explore and Edit tiers', () => {
    expect(p.availableTiers().sort()).toEqual(['Edit', 'Explore'])
  })

  it('supports resume', () => {
    expect(p.supportsResume()).toBe(true)
  })

  describe('spawnArgs', () => {
    const base = { claudeSessionId: '11111111-2222-3333-4444-555555555555', cwd: '/tmp' }

    it('Explore tier uses --permission-mode plan and pins session-id', () => {
      const args = p.spawnArgs({ ...base, tier: 'Explore', resume: false })
      expect(args).toContain('--permission-mode')
      expect(args[args.indexOf('--permission-mode') + 1]).toBe('plan')
      expect(args).toContain('--session-id')
      expect(args[args.indexOf('--session-id') + 1]).toBe(base.claudeSessionId)
      expect(args).toContain('-p')
      expect(args).toContain('--output-format')
      expect(args).toContain('stream-json')
    })

    it('Edit tier uses --permission-mode acceptEdits', () => {
      const args = p.spawnArgs({ ...base, tier: 'Edit', resume: false })
      expect(args[args.indexOf('--permission-mode') + 1]).toBe('acceptEdits')
    })

    it('resume=true adds --resume with the session id', () => {
      const args = p.spawnArgs({ ...base, tier: 'Explore', resume: true })
      expect(args).toContain('--resume')
      expect(args[args.indexOf('--resume') + 1]).toBe(base.claudeSessionId)
    })

    it('never emits default permission mode', () => {
      for (const tier of p.availableTiers()) {
        const args = p.spawnArgs({ ...base, tier, resume: false })
        const i = args.indexOf('--permission-mode')
        expect(args[i + 1]).not.toBe('default')
      }
    })

    it('passes --model when provided', () => {
      const args = p.spawnArgs({ ...base, tier: 'Explore', resume: false, model: 'sonnet' })
      expect(args[args.indexOf('--model') + 1]).toBe('sonnet')
    })
  })
})
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ClaudeCodeProvider.test.ts`
Expected: FAIL(`ClaudeCodeProvider` 未定义)。

- [ ] **Step 3: 写最小实现(basics 部分;parseStreamLine 留空数组,下一任务实现)**

Create `apps/server/src/chat/ClaudeCodeProvider.ts`:

```ts
import type { Writable } from 'node:stream'
import type { ChatPermissionTier, ProviderEvent } from '@ai-cli/shared'
import type { ChatProvider, SpawnOpts } from './ChatProvider.js'

const TIER_FLAG: Record<ChatPermissionTier, string> = {
  Explore: 'plan',
  Edit: 'acceptEdits',
}

export class ClaudeCodeProvider implements ChatProvider {
  readonly id = 'claude-code'

  spawnArgs(opts: SpawnOpts): string[] {
    const args = [
      '-p',
      '--session-id',
      opts.claudeSessionId,
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
      '--permission-mode',
      TIER_FLAG[opts.tier],
    ]
    if (opts.model) args.push('--model', opts.model)
    if (opts.resume) args.push('--resume', opts.claudeSessionId)
    return args
  }

  sendMessage(stdin: Writable, text: string): void {
    const envelope = {
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text }] },
    }
    stdin.write(JSON.stringify(envelope) + '\n')
  }

  parseStreamLine(_line: string): ProviderEvent[] {
    return [] // Task 4 实现
  }

  availableTiers(): ChatPermissionTier[] {
    return ['Explore', 'Edit']
  }

  supportsResume(): boolean {
    return true
  }
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ClaudeCodeProvider.test.ts`
Expected: PASS(basics 全绿)。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/chat/ClaudeCodeProvider.ts apps/server/src/__tests__/chat/ClaudeCodeProvider.test.ts
git commit -m "feat(chat): ClaudeCodeProvider spawnArgs/tiers/resume"
```

---

## Task 4: ClaudeCodeProvider —— parseStreamLine(用真实 fixture)

**Files:**

- Modify: `apps/server/src/chat/ClaudeCodeProvider.ts`
- Modify: `apps/server/src/__tests__/chat/ClaudeCodeProvider.test.ts`

> 说明:Claude Code stream-json 每行是 NDJSON,顶层 `type` 为 `assistant`/`user`/`result`/`system`;`assistant`/`user` 行的 `message.content` 是内容块数组,块类型 `text`/`tool_use`/`tool_result`/`thinking`。**若你的 fixture(Task 0)显示真实结构不同(例如带 `stream_event` 包裹或 `content_block_*` 字段),以 fixture 为准调整下面的字段路径。**

- [ ] **Step 1: 写失败测试(解析各事件类型)**

追加到 `ClaudeCodeProvider.test.ts` 顶部 import 之后:

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

describe('ClaudeCodeProvider — parseStreamLine', () => {
  const p = new ClaudeCodeProvider()

  it('parses assistant text content block to text-delta', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'hello world' }] },
    })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'text-delta', text: 'hello world' }))
  })

  it('parses tool_use block to tool-call-start', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'call_1', name: 'Read', input: { file_path: '/a/b.ts' } },
        ],
      },
    })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(
      expect.objectContaining({ type: 'tool-call-start', callId: 'call_1', toolName: 'Read' }),
    )
  })

  it('parses tool_result block to tool-result', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'ok', is_error: false }],
      },
    })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(
      expect.objectContaining({ type: 'tool-result', callId: 'call_1', status: 'success' }),
    )
  })

  it('marks errored tool_result as error status', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'call_2', content: 'boom', is_error: true }],
      },
    })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(
      expect.objectContaining({ type: 'tool-result', callId: 'call_2', status: 'error' }),
    )
  })

  it('parses result(type=result) to done', () => {
    const line = JSON.stringify({ type: 'result', subtype: 'success', result: 'done' })
    const ev = p.parseStreamLine(line)
    expect(ev.some((e) => e.type === 'done')).toBe(true)
  })

  it('emits status working for system thinking_tokens', () => {
    const line = JSON.stringify({ type: 'system', subtype: 'thinking_tokens', tokens: 10 })
    const ev = p.parseStreamLine(line)
    expect(ev).toContainEqual(expect.objectContaining({ type: 'status', state: 'working' }))
  })

  it('returns [] for non-JSON / unknown lines', () => {
    expect(p.parseStreamLine('not json')).toEqual([])
    expect(
      p.parseStreamLine(JSON.stringify({ type: 'system', subtype: 'init', tools: [] })),
    ).toEqual([])
  })

  it('parses the captured fixture file without throwing', () => {
    const path = join(FIXTURE_DIR, 'claude-stream-sample.jsonl')
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean)
    let total = 0
    for (const l of lines) {
      total += p.parseStreamLine(l).length
    }
    expect(total).toBeGreaterThan(0) // fixture 至少产出若干事件
  })
})
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ClaudeCodeProvider.test.ts`
Expected: FAIL(parseStreamLine 现在恒返回 `[]`)。

- [ ] **Step 3: 实现 parseStreamLine**

替换 `ClaudeCodeProvider.ts` 中的 `parseStreamLine`:

```ts
  parseStreamLine(line: string): ProviderEvent[] {
    let ev: Record<string, unknown>
    try {
      ev = JSON.parse(line)
    } catch {
      return []
    }
    const type = ev.type as string | undefined
    const events: ProviderEvent[] = []

    if (type === 'system') {
      if (ev.subtype === 'thinking_tokens') events.push({ type: 'status', state: 'working' })
      return events
    }
    if (type === 'result') {
      events.push({ type: 'done' })
      return events
    }
    if (type !== 'assistant' && type !== 'user') return events

    const content = (ev.message as { content?: unknown[] } | undefined)?.content
    if (!Array.isArray(content)) return events

    for (const block of content) {
      const b = block as Record<string, unknown>
      const kind = b.type as string
      if (kind === 'text' && typeof b.text === 'string') {
        events.push({ type: 'text-delta', text: b.text })
      } else if (kind === 'tool_use') {
        events.push({
          type: 'tool-call-start',
          callId: String(b.id ?? ''),
          toolName: String(b.name ?? 'tool'),
          inputSummary: summarizeInput(b.input),
        })
      } else if (kind === 'tool_result') {
        events.push({
          type: 'tool-result',
          callId: String(b.tool_use_id ?? ''),
          status: b.is_error ? 'error' : 'success',
          outputSnippet: summarizeResult(b.content),
        })
      }
    }
    return events
  }
```

并在文件顶部(provider class 之前)加两个辅助函数:

```ts
function summarizeInput(input: unknown): string {
  if (input == null) return ''
  try {
    const s = typeof input === 'string' ? input : JSON.stringify(input)
    return s.length > 120 ? s.slice(0, 117) + '...' : s
  } catch {
    return ''
  }
}

function summarizeResult(content: unknown): string {
  let text: string
  if (typeof content === 'string') text = content
  else if (Array.isArray(content)) {
    text = content
      .map((c) => (typeof c === 'string' ? c : ((c as { text?: string })?.text ?? '')))
      .join('')
  } else text = ''
  return text.length > 200 ? text.slice(0, 197) + '...' : text
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ClaudeCodeProvider.test.ts`
Expected: PASS。**若 fixture 测试失败(真实结构与假设不符),按 Task 0 Step 3 记下的实际字段路径调整 Step 3 的解析逻辑,再跑直至通过。**

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/chat/ClaudeCodeProvider.ts apps/server/src/__tests__/chat/ClaudeCodeProvider.test.ts
git commit -m "feat(chat): ClaudeCodeProvider.parseStreamLine with real fixtures"
```

---

## Task 5: ChatSession —— 子进程生命周期(mocked spawn)

**Files:**

- Create: `apps/server/src/chat/ChatSession.ts`
- Create: `apps/server/src/__tests__/chat/ChatSession.test.ts`

- [ ] **Step 1: 写失败测试(spawn 调用正确参数 + exit 事件)**

Create `apps/server/src/__tests__/chat/ChatSession.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChild = {
  stdin: { write: vi.fn(), end: vi.fn(), writable: true, on: vi.fn() },
  stdout: { on: vi.fn(), setEncoding: vi.fn() },
  stderr: { on: vi.fn(), setEncoding: vi.fn() },
  on: vi.fn(),
  kill: vi.fn(),
  pid: 12345,
}
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockChild),
}))
vi.mock('../../lib/logger.js', () => ({
  pinoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))

import { spawn } from 'node:child_process'
import { ChatSession } from '../../chat/ChatSession.js'
import { ClaudeCodeProvider } from '../../chat/ClaudeCodeProvider.js'

const SPAWN_OPTS = {
  claudeSessionId: '11111111-2222-3333-4444-555555555555',
  cwd: '/tmp/proj',
  tier: 'Explore' as const,
  resume: false,
}

describe('ChatSession — lifecycle', () => {
  beforeEach(() => vi.clearAllMocks())

  it('spawns claude with provider args and cwd', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    session.start()
    expect(spawn).toHaveBeenCalledWith(
      'claude',
      expect.arrayContaining(['-p', '--permission-mode', 'plan']),
      expect.objectContaining({ cwd: '/tmp/proj' }),
    )
  })

  it('kill() terminates the child process', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    session.start()
    session.kill()
    expect(mockChild.kill).toHaveBeenCalled()
  })

  it('emits crash callback on unexpected exit (non-zero)', () => {
    const onCrash = vi.fn()
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {}, onCrash)
    session.start()
    const exitHandler = mockChild.on.mock.calls.find((c) => c[0] === 'exit')![1]
    exitHandler(1, null)
    expect(onCrash).toHaveBeenCalledWith(expect.any(Number), expect.any(String))
  })
})
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ChatSession.test.ts`
Expected: FAIL(`ChatSession` 未定义)。

- [ ] **Step 3: 实现 ChatSession(生命周期 + exit + stdout 解析)**

Create `apps/server/src/chat/ChatSession.ts`:

```ts
import { spawn, type ChildProcess } from 'node:child_process'
import type { ProviderEvent } from '@ai-cli/shared'
import { pinoLogger } from '../lib/logger.js'
import type { ChatProvider, SpawnOpts } from './ChatProvider.js'

export type EventCallback = (event: ProviderEvent) => void
export type CrashCallback = (code: number | null, message: string) => void

export class ChatSession {
  private child: ChildProcess | null = null
  private killed = false
  private lastStderr = ''

  constructor(
    private readonly provider: ChatProvider,
    private readonly opts: SpawnOpts,
    private readonly onEvent: EventCallback,
    private readonly onCrash?: CrashCallback,
  ) {}

  start(): void {
    const args = this.provider.spawnArgs(this.opts)
    pinoLogger.info({ args: args.join(' '), cwd: this.opts.cwd }, 'ChatSession spawn')
    this.child = spawn('claude', args, {
      cwd: this.opts.cwd,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child.stdout?.setEncoding('utf8')
    this.child.stderr?.setEncoding('utf8')
    this.child.stdout?.on('data', (chunk: string) => this.handleStdout(chunk))
    this.child.stderr?.on('data', (chunk: string) => this.handleStderr(chunk))
    this.child.on('exit', (code, signal) => this.handleExit(code, signal))
    this.child.on('error', (err) => {
      pinoLogger.error({ err }, 'ChatSession spawn error')
      this.onCrash?.(null, err.message)
    })
  }

  send(text: string): boolean {
    if (text.length > 256 * 1024) {
      pinoLogger.warn({ len: text.length }, 'ChatSession.send rejected: oversized')
      return false
    }
    if (!this.child?.stdin || !this.child.stdin.writable) return false
    this.provider.sendMessage(this.child.stdin, text)
    return true
  }

  kill(): void {
    this.killed = true
    if (this.child) {
      try {
        this.child.stdin?.end()
      } catch {
        /* ignore */
      }
      this.child.kill('SIGTERM')
    }
  }

  private handleStdout(chunk: string): void {
    for (const line of chunk.split('\n')) {
      if (!line) continue
      for (const event of this.provider.parseStreamLine(line)) this.onEvent(event)
    }
  }

  private handleStderr(chunk: string): void {
    if (/No conversation/i.test(chunk)) this.lastStderr = chunk
    pinoLogger.warn({ chunk }, 'ChatSession stderr')
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    pinoLogger.info({ code, signal, killed: this.killed }, 'ChatSession exit')
    if (this.killed || code === 0) return
    const msg = this.lastStderr || `claude exited with code ${code}`
    this.onCrash?.(code, msg)
  }
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ChatSession.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/chat/ChatSession.ts apps/server/src/__tests__/chat/ChatSession.test.ts
git commit -m "feat(chat): ChatSession process lifecycle"
```

---

## Task 6: ChatSession —— stdin 写入 + stdout 行解析 + 背压(补测试)

**Files:**

- Modify: `apps/server/src/__tests__/chat/ChatSession.test.ts`

> Task 5 的实现已含解析/发送/背压。本任务补齐验证测试(TDD 顺序:实现已在 Task 5 落地,这里锁定行为)。

- [ ] **Step 1: 追加失败/验证测试**

在 `ChatSession.test.ts` 末尾追加:

```ts
describe('ChatSession — streaming & backpressure', () => {
  beforeEach(() => vi.clearAllMocks())

  it('send() writes provider-formatted envelope to stdin', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    session.start()
    session.send('hello')
    const written = mockChild.stdin.write.mock.calls[0][0] as string
    expect(written.endsWith('\n')).toBe(true)
    expect(JSON.parse(written).message.content[0].text).toBe('hello')
  })

  it('parses stdout lines into events via provider', () => {
    const onEvent = vi.fn()
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, onEvent)
    session.start()
    const dataHandler = mockChild.stdout.on.mock.calls.find((c) => c[0] === 'data')![1]
    dataHandler(JSON.stringify({ type: 'result', subtype: 'success' }) + '\n')
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'done' }))
  })

  it('send() returns false when not started', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    expect(session.send('x')).toBe(false)
  })

  it('send() rejects oversized payload (>256KB)', () => {
    const session = new ChatSession(new ClaudeCodeProvider(), SPAWN_OPTS, () => {})
    session.start()
    expect(session.send('x'.repeat(257 * 1024))).toBe(false)
    expect(mockChild.stdin.write).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试,确认全绿**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ChatSession.test.ts`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/__tests__/chat/ChatSession.test.ts
git commit -m "test(chat): ChatSession streaming/send/backpressure coverage"
```

---

## Task 7: Conversation —— 创建 / 发消息 / 事件转发(用 stub provider)

**Files:**

- Create: `apps/server/src/chat/Conversation.ts`
- Create: `apps/server/src/__tests__/chat/Conversation.test.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/server/src/__tests__/chat/Conversation.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { ProviderEvent, ChatViewMode } from '@ai-cli/shared'
import { Conversation } from '../../chat/Conversation.js'
import type { ChatProvider, SpawnOpts } from '../../chat/ChatProvider.js'
import { ChatSession } from '../../chat/ChatSession.js'

// mock ChatSession,避免真实 spawn
vi.mock('../../chat/ChatSession.js', () => ({
  ChatSession: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    send: vi.fn(() => true),
    kill: vi.fn(),
  })),
}))

function makeStubProvider(): ChatProvider & { spawnOpts: SpawnOpts[] } {
  const seen: SpawnOpts[] = []
  return {
    id: 'stub',
    spawnOpts: seen,
    spawnArgs: (o) => {
      seen.push(o)
      return ['--stub', o.tier]
    },
    sendMessage: (stdin, text) => {
      stdin.write(JSON.stringify({ text }) + '\n')
    },
    parseStreamLine: () => [],
    availableTiers: () => ['Explore', 'Edit'],
    supportsResume: () => true,
  }
}

const SID = '11111111-2222-3333-4444-555555555555'

describe('Conversation', () => {
  it('starts in chat/Explore and exposes state', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    expect(c.state.viewMode).toBe('chat')
    expect(c.state.tier).toBe('Explore')
    expect(c.state.conversationId).toBe('c1')
  })

  it('emit event forwards to listeners', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    const heard: ProviderEvent[] = []
    c.on('event', (e) => heard.push(e))
    c['onProviderEvent']({ type: 'text-delta', text: 'hi' } as ProviderEvent)
    expect(heard).toHaveLength(1)
  })

  it('send() appends user message to messageLog', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start()
    c.send('hello')
    expect(c.state.messageLog.some((m) => m.role === 'user' && m.text === 'hello')).toBe(true)
  })

  it('destroy() does not throw', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start()
    expect(() => c.destroy()).not.toThrow()
  })
})
```

> 注:`vi` 在文件顶部需从 vitest import(见 Step 1 第 2 行已含)。若 ESLint 抱怨 hoisting,把 `import { vi } from 'vitest'` 提到文件最顶。

- [ ] **Step 2: 运行测试,确认失败**

Run: `cd apps/server && npx vitest run src/__tests__/chat/Conversation.test.ts`
Expected: FAIL(`Conversation` 未定义)。

- [ ] **Step 3: 实现 Conversation(创建/发消息/事件转发;切换与提权含于本实现,Task 8 补测试)**

Create `apps/server/src/chat/Conversation.ts`:

```ts
import { EventEmitter } from 'node:events'
import type { ChatMessage, ChatPermissionTier, ChatViewMode, ProviderEvent } from '@ai-cli/shared'
import { pinoLogger } from '../lib/logger.js'
import type { ChatProvider } from './ChatProvider.js'
import { ChatSession } from './ChatSession.js'

export interface ConversationInit {
  conversationId: string
  claudeSessionId: string
  cwd: string
  initialTier?: ChatPermissionTier
}

export interface ConversationState {
  conversationId: string
  claudeSessionId: string
  cwd: string
  viewMode: ChatViewMode
  tier: ChatPermissionTier
  messageLog: ChatMessage[]
}

export class Conversation extends EventEmitter {
  private session: ChatSession | null = null
  readonly state: ConversationState

  constructor(
    private readonly provider: ChatProvider,
    init: ConversationInit,
  ) {
    super()
    this.state = {
      conversationId: init.conversationId,
      claudeSessionId: init.claudeSessionId,
      cwd: init.cwd,
      viewMode: 'chat',
      tier: init.initialTier ?? 'Explore',
      messageLog: [],
    }
  }

  start(): void {
    this.spawnSession(false)
  }

  switchView(viewMode: ChatViewMode): void {
    if (this.state.viewMode === viewMode) return
    this.session?.kill()
    this.session = null
    this.state.viewMode = viewMode
    if (viewMode === 'chat') this.spawnSession(true)
    this.emit('viewChanged', { viewMode, tier: this.state.tier })
  }

  escalate(tier: ChatPermissionTier): void {
    if (!this.provider.availableTiers().includes(tier)) return
    if (this.state.tier === tier) return
    this.session?.kill()
    this.session = null
    this.state.tier = tier
    if (this.state.viewMode === 'chat') this.spawnSession(true)
    this.emit('tierChanged', tier)
  }

  send(text: string): boolean {
    this.state.messageLog.push({ role: 'user', text, ts: Date.now() })
    return this.session?.send(text) ?? false
  }

  destroy(): void {
    this.session?.kill()
    this.session = null
    this.removeAllListeners()
  }

  // 测试可见的内部方法
  private spawnSession(resume: boolean): void {
    if (!this.provider.supportsResume()) resume = false
    this.session = new ChatSession(
      this.provider,
      {
        claudeSessionId: this.state.claudeSessionId,
        cwd: this.state.cwd,
        tier: this.state.tier,
        resume,
      },
      (event) => this.onProviderEvent(event),
      (code, message) => this.onCrash(code, message),
    )
    this.session.start()
  }

  private onProviderEvent(event: ProviderEvent): void {
    if (event.type === 'text-delta') {
      const last = this.state.messageLog[this.state.messageLog.length - 1]
      if (last && last.role === 'assistant') last.text += event.text
      else this.state.messageLog.push({ role: 'assistant', text: event.text, ts: Date.now() })
    }
    this.emit('event', event)
  }

  private onCrash(code: number | null, message: string): void {
    pinoLogger.warn({ code, message, id: this.state.conversationId }, 'Conversation crashed')
    this.emit('crashed', { message, resumable: this.provider.supportsResume() })
  }
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/__tests__/chat/Conversation.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/chat/Conversation.ts apps/server/src/__tests__/chat/Conversation.test.ts
git commit -m "feat(chat): Conversation entity with events/send/lifecycle"
```

---

## Task 8: Conversation —— switchView / escalate / crash(补测试)

**Files:**

- Modify: `apps/server/src/__tests__/chat/Conversation.test.ts`

- [ ] **Step 1: 追加测试**

追加到 `Conversation.test.ts`:

```ts
describe('Conversation — switch / escalate / crash', () => {
  it('switchView to terminal kills session and emits viewChanged', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start()
    const seen: ChatViewMode[] = []
    c.on('viewChanged', (p: { viewMode: ChatViewMode }) => seen.push(p.viewMode))
    c.switchView('terminal')
    expect(c.state.viewMode).toBe('terminal')
    expect(seen).toEqual(['terminal'])
  })

  it('switchView back to chat respawns with resume', () => {
    const p = makeStubProvider()
    const c = new Conversation(p, { conversationId: 'c1', claudeSessionId: SID, cwd: '/tmp' })
    c.start()
    c.switchView('terminal')
    c.switchView('chat')
    // start() → resume false; 切回 chat → resume true
    expect(p.spawnOpts.map((o) => o.resume)).toEqual([false, true])
  })

  it('escalate to Edit changes tier', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    c.start()
    c.escalate('Edit')
    expect(c.state.tier).toBe('Edit')
  })

  it('escalate rejects unsupported tier', () => {
    const p = makeStubProvider()
    p.availableTiers = () => ['Explore']
    const c = new Conversation(p, { conversationId: 'c1', claudeSessionId: SID, cwd: '/tmp' })
    c.start()
    c.escalate('Edit')
    expect(c.state.tier).toBe('Explore')
  })

  it('onCrash emits crashed with resumable=true', () => {
    const c = new Conversation(makeStubProvider(), {
      conversationId: 'c1',
      claudeSessionId: SID,
      cwd: '/tmp',
    })
    let crashed: { resumable: boolean } | null = null
    c.on('crashed', (p) => (crashed = p))
    c['onCrash'](1, 'boom')
    expect(crashed).not.toBeNull()
    expect(crashed!.resumable).toBe(true)
  })
})
```

- [ ] **Step 2: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/__tests__/chat/Conversation.test.ts`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/__tests__/chat/Conversation.test.ts
git commit -m "test(chat): cover switchView/escalate/crash"
```

---

## Task 9: ConversationManager —— 注册表

**Files:**

- Create: `apps/server/src/chat/ConversationManager.ts`
- Create: `apps/server/src/__tests__/chat/ConversationManager.test.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/server/src/__tests__/chat/ConversationManager.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
vi.mock('../../chat/ChatSession.js', () => ({
  ChatSession: vi.fn().mockImplementation(() => ({ start: vi.fn(), send: vi.fn(), kill: vi.fn() })),
}))
import { ConversationManager } from '../../chat/ConversationManager.js'
import { ClaudeCodeProvider } from '../../chat/ClaudeCodeProvider.js'

const SID = '11111111-2222-3333-4444-555555555555'

describe('ConversationManager', () => {
  it('registers and retrieves providers', () => {
    const mgr = new ConversationManager()
    mgr.registerProvider(new ClaudeCodeProvider())
    expect(mgr.getProvider('claude-code')).toBeDefined()
    expect(mgr.getProvider('nope')).toBeUndefined()
  })

  it('creates, gets, and destroys conversations', () => {
    const mgr = new ConversationManager()
    mgr.registerProvider(new ClaudeCodeProvider())
    const c = mgr.create({ providerId: 'claude-code', cwd: '/tmp', claudeSessionId: SID })
    expect(c.state.conversationId).toBeTruthy()
    expect(mgr.get(c.state.conversationId)).toBe(c)
    expect(mgr.size()).toBe(1)
    mgr.destroy(c.state.conversationId)
    expect(mgr.get(c.state.conversationId)).toBeUndefined()
    expect(mgr.size()).toBe(0)
  })

  it('create throws on unknown provider', () => {
    const mgr = new ConversationManager()
    expect(() => mgr.create({ providerId: 'nope', cwd: '/tmp', claudeSessionId: SID })).toThrow(
      /unknown provider/i,
    )
  })
})
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ConversationManager.test.ts`
Expected: FAIL(`ConversationManager` 未定义)。

- [ ] **Step 3: 实现 ConversationManager**

Create `apps/server/src/chat/ConversationManager.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { ChatPermissionTier } from '@ai-cli/shared'
import { Conversation } from './Conversation.js'
import type { ChatProvider } from './ChatProvider.js'

export interface CreateConversationOpts {
  providerId: string
  cwd: string
  claudeSessionId: string
  initialTier?: ChatPermissionTier
}

export class ConversationManager {
  private providers = new Map<string, ChatProvider>()
  private conversations = new Map<string, Conversation>()

  registerProvider(p: ChatProvider): void {
    this.providers.set(p.id, p)
  }

  getProvider(id: string): ChatProvider | undefined {
    return this.providers.get(id)
  }

  create(opts: CreateConversationOpts): Conversation {
    const provider = this.providers.get(opts.providerId)
    if (!provider) throw new Error(`unknown provider: ${opts.providerId}`)
    const conversationId = randomUUID()
    const conv = new Conversation(provider, {
      conversationId,
      claudeSessionId: opts.claudeSessionId,
      cwd: opts.cwd,
      initialTier: opts.initialTier,
    })
    this.conversations.set(conversationId, conv)
    return conv
  }

  get(id: string): Conversation | undefined {
    return this.conversations.get(id)
  }

  size(): number {
    return this.conversations.size
  }

  destroy(id: string): void {
    const c = this.conversations.get(id)
    if (c) {
      c.destroy()
      this.conversations.delete(id)
    }
  }

  destroyAll(): void {
    for (const id of this.conversations.keys()) this.destroy(id)
  }
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ConversationManager.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/chat/ConversationManager.ts apps/server/src/__tests__/chat/ConversationManager.test.ts
git commit -m "feat(chat): ConversationManager registry"
```

---

## Task 10: ChatGateway —— 连接 / 鉴权 / 分发 / 广播

**Files:**

- Create: `apps/server/src/chat/ChatGateway.ts`
- Create: `apps/server/src/__tests__/chat/ChatGateway.test.ts`

> 参考 `core/WSGateway.ts`:鉴权在 HTTP upgrade 层用 `verifyWsUpgradeToken`,消息按 `msg.type` switch。ChatGateway 更简单,纯 JSON。

- [ ] **Step 1: 写失败测试**

Create `apps/server/src/__tests__/chat/ChatGateway.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { WebSocket } from 'ws'

vi.mock('../../lib/logger.js', () => ({
  pinoLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}))
vi.mock('../../chat/ChatSession.js', () => ({
  ChatSession: vi.fn().mockImplementation(() => ({ start: vi.fn(), send: vi.fn(), kill: vi.fn() })),
}))

import { ChatGateway } from '../../chat/ChatGateway.js'
import { ConversationManager } from '../../chat/ConversationManager.js'
import { ClaudeCodeProvider } from '../../chat/ClaudeCodeProvider.js'

function fakeWs() {
  const handlers: Record<string, ((d: any) => void)[]> = {}
  const ws = {
    readyState: 1,
    send: vi.fn(function (this: any, raw: string) {
      this.sent.push(JSON.parse(raw))
    }),
    close: vi.fn(),
    on: vi.fn((t: string, h: (d: any) => void) => {
      ;(handlers[t] ||= []).push(h)
    }),
    once: vi.fn((t: string, h: () => void) => {
      ;(handlers[t] ||= []).push(h)
    }),
    sent: [] as any[],
    emit(t: string, d: any) {
      ;(handlers[t] || []).forEach((h) => h(d))
    },
  } as any
  return ws
}

const USER = { userId: 'u1', username: 'alice', role: 'admin', tokenVersion: 1, iat: 0, exp: 0 }

function setup() {
  const mgr = new ConversationManager()
  mgr.registerProvider(new ClaudeCodeProvider())
  const gw = new ChatGateway(
    mgr,
    'jwt-secret-at-least-32-characters-long',
    'refresh-secret-at-least-32-characters',
  )
  return { mgr, gw }
}

describe('ChatGateway', () => {
  it('CHAT_ATTACH to unknown conversation replies CHAT_ERROR', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as any)
    ws.emit('message', Buffer.from(JSON.stringify({ type: 'CHAT_ATTACH', conversationId: 'nope' })))
    expect(ws.sent.some((m: any) => m.type === 'CHAT_ERROR')).toBe(true)
  })

  it('CHAT_CREATE creates conversation and forwards events as CHAT_EVENT', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as any)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const created = ws.sent.find((m: any) => m.type === 'CHAT_CREATED')
    expect(created).toBeDefined()
    const conv = (gw as any).mgr.get(created.conversationId)
    conv.emit('event', { type: 'text-delta', text: 'hi' })
    expect(ws.sent.some((m: any) => m.type === 'CHAT_EVENT' && m.event.text === 'hi')).toBe(true)
  })

  it('CHAT_SWITCH_VIEW forwards CHAT_VIEW_CHANGED', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, USER as any)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = ws.sent.find((m: any) => m.type === 'CHAT_CREATED').conversationId
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({ type: 'CHAT_SWITCH_VIEW', conversationId: convId, viewMode: 'terminal' }),
      ),
    )
    expect(
      ws.sent.some((m: any) => m.type === 'CHAT_VIEW_CHANGED' && m.viewMode === 'terminal'),
    ).toBe(true)
  })

  it('CHAT_ESCALATE to Edit by non-admin replies CHAT_ERROR', () => {
    const { gw } = setup()
    const ws = fakeWs()
    gw.handleChatConnection(ws as unknown as WebSocket, { ...USER, role: 'user' } as any)
    ws.emit(
      'message',
      Buffer.from(
        JSON.stringify({
          type: 'CHAT_CREATE',
          cwd: '/tmp',
          claudeSessionId: '11111111-2222-3333-4444-555555555555',
        }),
      ),
    )
    const convId = ws.sent.find((m: any) => m.type === 'CHAT_CREATED').conversationId
    ws.emit(
      'message',
      Buffer.from(JSON.stringify({ type: 'CHAT_ESCALATE', conversationId: convId, tier: 'Edit' })),
    )
    expect(ws.sent.some((m: any) => m.type === 'CHAT_ERROR' && /admin/.test(m.message))).toBe(true)
  })
})
```

- [ ] **Step 2: 实现 ChatGateway**

Create `apps/server/src/chat/ChatGateway.ts`:

```ts
import { WebSocket } from 'ws'
import type {
  ChatClientMessage,
  ChatPermissionTier,
  ChatServerMessage,
  ChatViewMode,
  JwtPayload,
  ProviderEvent,
} from '@ai-cli/shared'
import { pinoLogger } from '../lib/logger.js'
import type { ConversationManager } from './ConversationManager.js'

export class ChatGateway {
  private subscribers = new Map<string, Set<WebSocket>>()

  constructor(
    private readonly mgr: ConversationManager,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
  ) {}

  handleChatConnection(ws: WebSocket, user: JwtPayload): void {
    pinoLogger.info({ userId: user.userId }, 'Chat WS connected')

    const send = (m: ChatServerMessage) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m))
    }

    ws.on('message', (data: Buffer) => {
      let msg: ChatClientMessage
      try {
        msg = JSON.parse(data.toString())
      } catch {
        send({ type: 'CHAT_ERROR', message: 'invalid JSON' })
        return
      }
      this.dispatch(ws, user, msg, send).catch((err) => {
        pinoLogger.error({ err }, 'ChatGateway dispatch error')
        send({ type: 'CHAT_ERROR', message: 'internal error' })
      })
    })
  }

  private async dispatch(
    ws: WebSocket,
    user: JwtPayload,
    msg: ChatClientMessage,
    send: (m: ChatServerMessage) => void,
  ): Promise<void> {
    switch (msg.type) {
      case 'CHAT_PING':
        send({ type: 'CHAT_PONG' })
        return
      case 'CHAT_CREATE': {
        const providerId = msg.providerId ?? 'claude-code'
        const conv = this.mgr.create({
          providerId,
          cwd: msg.cwd,
          claudeSessionId: msg.claudeSessionId,
          initialTier: msg.initialTier,
        })
        this.attach(ws, conv.state.conversationId)
        conv.start()
        send({
          type: 'CHAT_CREATED',
          conversationId: conv.state.conversationId,
          claudeSessionId: conv.state.claudeSessionId,
          tier: conv.state.tier,
          viewMode: conv.state.viewMode,
        })
        return
      }
      case 'CHAT_ATTACH':
      case 'CHAT_RECONNECT': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        this.attach(ws, conv.state.conversationId)
        send({
          type: 'CHAT_HISTORY',
          conversationId: conv.state.conversationId,
          messages: conv.state.messageLog,
        })
        return
      }
      case 'CHAT_SEND': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        conv.send(msg.text)
        return
      }
      case 'CHAT_SWITCH_VIEW': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        conv.switchView(msg.viewMode)
        return
      }
      case 'CHAT_ESCALATE': {
        const conv = this.mgr.get(msg.conversationId)
        if (!conv) return send({ type: 'CHAT_ERROR', message: 'conversation not found' })
        if (msg.tier === 'Edit' && user.role !== 'admin') {
          return send({ type: 'CHAT_ERROR', message: 'escalation requires admin role' })
        }
        conv.escalate(msg.tier)
        return
      }
    }
  }

  private attach(ws: WebSocket, conversationId: string): void {
    let set = this.subscribers.get(conversationId)
    if (!set) {
      set = new Set()
      this.subscribers.set(conversationId, set)
    }
    set.add(ws)
    const conv = this.mgr.get(conversationId)!

    const onEvent = (event: ProviderEvent) =>
      this.broadcast(conversationId, { type: 'CHAT_EVENT', conversationId, event })
    const onView = (p: { viewMode: ChatViewMode; tier: ChatPermissionTier }) =>
      this.broadcast(conversationId, { type: 'CHAT_VIEW_CHANGED', conversationId, ...p })
    const onCrash = (p: { message: string; resumable: boolean }) =>
      this.broadcast(conversationId, { type: 'CHAT_CRASHED', conversationId, ...p })

    conv.on('event', onEvent)
    conv.on('viewChanged', onView)
    conv.on('crashed', onCrash)

    ws.once('close', () => {
      conv.off('event', onEvent)
      conv.off('viewChanged', onView)
      conv.off('crashed', onCrash)
      this.subscribers.get(conversationId)?.delete(ws)
    })
  }

  private broadcast(conversationId: string, m: ChatServerMessage): void {
    const set = this.subscribers.get(conversationId)
    if (!set) return
    const raw = JSON.stringify(m)
    for (const ws of set) if (ws.readyState === WebSocket.OPEN) ws.send(raw)
  }
}
```

- [ ] **Step 3: 运行测试,确认通过**

Run: `cd apps/server && npx vitest run src/__tests__/chat/ChatGateway.test.ts`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/chat/ChatGateway.ts apps/server/src/__tests__/chat/ChatGateway.test.ts
git commit -m "feat(chat): ChatGateway WS handler with dispatch/broadcast/RBAC"
```

---

## Task 11: routes/chat.ts + index.ts 装配

**Files:**

- Create: `apps/server/src/routes/chat.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: 写 `/ws/chat` 路由(照 terminal.ts 模式)**

Create `apps/server/src/routes/chat.ts`:

```ts
import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/ws/chat',
    {
      websocket: true,
      schema: {
        hide: true,
        summary: 'WebSocket 对话视图连接',
        querystring: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string', description: 'JWT access token' } },
        },
      },
    },
    (socket, request) => {
      const user = verifyWsUpgradeToken(request, socket, 'Chat')
      if (!user) return
      fastify.chatGateway.handleChatConnection(socket, user)
    },
  )
}
```

- [ ] **Step 2: 在 index.ts 装配**

Modify `apps/server/src/index.ts`:

import 区(在 `import { WSGateway } ...` 附近)加:

```ts
import { ConversationManager } from './chat/ConversationManager.js'
import { ChatGateway } from './chat/ChatGateway.js'
import { ClaudeCodeProvider } from './chat/ClaudeCodeProvider.js'
import { chatRoutes } from './routes/chat.js'
```

在 `fastify.decorate('wsGateway', wsGateway)` 之后加:

```ts
// Chat Gateway (Tier 3 混合对话视图)
const conversationManager = new ConversationManager()
conversationManager.registerProvider(new ClaudeCodeProvider())
const chatGateway = new ChatGateway(
  conversationManager,
  config.JWT_SECRET,
  config.JWT_REFRESH_SECRET,
)
fastify.decorate('chatGateway', chatGateway)
fastify.decorate('conversationManager', conversationManager)
```

在路由注册区(`await fastify.register(controlRoutes)` 附近)加:

```ts
await fastify.register(chatRoutes)
```

在 `shutdown()` 里(`await sessionManager.destroy()` 之后)加:

```ts
if (fastify.conversationManager) fastify.conversationManager.destroyAll()
```

- [ ] **Step 3: 补 Fastify 类型声明**

Run: `grep -rln "wsGateway" apps/server/src --include="*.d.ts"`
在该 `.d.ts`(WSGateway 注释提到的 `fastify.d.ts`)里照 `wsGateway` 声明追加:

```ts
import type { ChatGateway } from './chat/ChatGateway.js'
import type { ConversationManager } from './chat/ConversationManager.js'
// 在 FastifyInstance interface 内追加:
chatGateway: ChatGateway
conversationManager: ConversationManager
```

若没有现成 `.d.ts`,新建 `apps/server/src/fastify.d.ts` 含上述 `declare module 'fastify'` 声明,并确认 `tsconfig.json` 包含 `src/**/*.d.ts`。

- [ ] **Step 4: 类型检查 + 构建**

Run: `cd apps/server && npx tsc --noEmit`
Expected: 无错。若报 `fastify.chatGateway` 未定义,确认 Step 3 类型声明被 tsconfig 包含。

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/routes/chat.ts apps/server/src/index.ts apps/server/src/fastify.d.ts
git commit -m "feat(chat): wire ChatGateway + ConversationManager into server"
```

---

## Task 12: 全量测试 + 现有测试不回归

- [ ] **Step 1: 服务端全量测试**

Run: `cd apps/server && pnpm test`
Expected: 全 PASS(新增 chat 测试 + 现有 14 个测试)。

- [ ] **Step 2: shared 包测试**

Run: `cd packages/shared && pnpm test`
Expected: PASS。

- [ ] **Step 3: lint**

Run: `cd apps/server && pnpm lint`
Expected: 无 error。

- [ ] **Step 4: 端到端冒烟(手动)**

启动服务:`cd apps/server && pnpm build && node dist/index.js`。用 wscat 连 `/ws/chat?token=<jwt>` 发:

```
{"type":"CHAT_CREATE","cwd":"/tmp","claudeSessionId":"<新UUID>"}
```

Expected: 收到 `CHAT_CREATED`,随后收到 `CHAT_EVENT`(text-delta / status)。验证 spawn 真实可用后关停。

- [ ] **Step 5: Commit(若有 lint 自动修复)**

```bash
git add -A && git commit -m "test(chat): full server suite green, no regressions" --allow-empty
```

---

## Self-Review(spec 覆盖核对)

| spec 要求                                      | 覆盖任务                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| §2.1 `--session-id`/`--resume` 续接            | Task 3(spawnArgs)、Task 8(switchView resume=true)                        |
| §2.2 权限模式矩阵(plan/acceptEdits,禁 default) | Task 3(TIER_FLAG + 测试断言非 default)、Task 7(tier 默认 Explore)        |
| §2.3 `--resume` 失败降级                       | Task 5(handleStderr 捕获 "No conversation")+ Task 8(crashed 事件)        |
| §2.3 model 钉住                                | Task 2(SpawnOpts.model)+ Task 3(--model 透传)                            |
| §3 Conversation 主体实体                       | Task 7、Task 8                                                           |
| §4 ChatProvider + ClaudeCodeProvider           | Task 2、Task 3、Task 4                                                   |
| §4 ChatSession                                 | Task 5、Task 6                                                           |
| §4 ChatGateway                                 | Task 10、Task 11                                                         |
| §5 数据流(建/发/切/提权)                       | Task 7、Task 8、Task 10                                                  |
| §6 归一化事件协议                              | Task 1(类型)+ Task 4(parseStreamLine)                                    |
| §7 per-provider 能力协商                       | Task 2(availableTiers/supportsResume)+ Task 8(escalate 拒绝)             |
| §8 错误处理(crash/背压/stdin 关闭/RBAC)        | Task 5(crash)、Task 6(背压 + stdin 不可写 false)、Task 10(RBAC 提权闸门) |
| §9 测试(fixture/矩阵/生命周期/不回归)          | Task 0、Task 4、Task 5–10、Task 12                                       |

**未覆盖(故意留给 Plan 2 前端):** §4.2 前端组件、§5 前端渲染、NewSessionDrawer 接入、useSessionStore 扩展。

---

## 执行交接

Plan 1 完成 = 服务端对话引擎可独立运行、可测试,经 `/ws/chat` 暴露。前端 UI 是 Plan 2(待本计划落地后另开)。
