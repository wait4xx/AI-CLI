# 多对话支持（Multi-Conversation）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 chat 侧从单全局对话提升为独立对话集合，支持并发多个 Claude 对话，单 WS 多路复用，并顺带解决审查报告 P1 #9（WS transport 与 ChatView 挂载解耦）。

**Architecture:** 服务端 `ChatGateway` 加 `CHAT_DETACH` 入口 + reaper TTL 60s→30s。前端 store 把 `conversation: Conversation | null` + `chat: ChatRenderState` 两个单全局字段，重构为 `conversations: ConversationMeta[]` + `chats: Record<conversationId, ChatRenderState>` + `activeConversationId`。`useChatWS` 从单对话连接改为单 WS 多路复用，并提升为 `ChatTransport` 纯组件（挂 SplitPane 顶层，WS 生命周期独立于 ChatView）。`NewSessionDrawer` 加对话列表；`SettingsDrawer` 加"最大对话数"调节器。

**Tech Stack:** TypeScript、Fastify 5、ws、Zustand、React 18、Vitest

**参考 spec:** `docs/superpowers/specs/2026-07-04-multi-conversation-design.md`

**Commit 约定:** 每个 commit 末尾加 trailer `Co-authored-by: GLM 5.2`（不带邮箱）。本计划文档本地 commit、**不 push**。

---

## 文件结构

| 文件                                                      | 责任                    | 改动                                                             |
| --------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------- |
| `packages/shared/src/protocol.ts`                         | WS 协议类型             | 加 `CHAT_DETACH` 消息 + `ConversationMeta` 类型                  |
| `apps/server/src/chat/ChatGateway.ts`                     | chat WS 派发 + reaper   | 加 `CHAT_DETACH` 分支；TTL 60s→30s                               |
| `apps/web/src/store/sessionStore.ts`                      | 前端全局状态            | 多对话 slice 重构（核心）                                        |
| `apps/web/src/hooks/useChatWS.ts`                         | chat WS 生命周期        | 单对话 → 单 WS 多路复用；API 改造                                |
| `apps/web/src/components/ChatTransport.tsx`               | 新文件：WS transport 层 | 新建（P1 #9 落地点）                                             |
| `apps/web/src/components/chat/ChatView.tsx`               | 对话渲染                | selector 改读 `chats[activeConversationId]`；不再持有 useChatWS  |
| `apps/web/src/components/SplitPane.tsx`                   | 分屏布局                | 挂 `ChatTransport`；ChatView 渲染条件改基于 activeConversationId |
| `apps/web/src/components/NewSessionDrawer.tsx`            | 新建会话抽屉            | 加对话列表区；入口改 transport API                               |
| `apps/web/src/components/SettingsDrawer.tsx`              | 设置抽屉                | 加"最大对话数"调节器                                             |
| `apps/server/src/__tests__/chat/ChatGateway.test.ts`      | gateway 单测            | 加 CHAT_DETACH 测试                                              |
| `apps/web/src/__tests__/store/sessionStore.multi.test.ts` | store 多对话测试        | 新建                                                             |
| `apps/web/src/__tests__/chat/useChatWS.test.ts`           | WS hook 测试            | 改造为多对话                                                     |
| `apps/server/src/__tests__/chatIntegration.test.ts`       | 集成测试                | 加多对话端到端用例                                               |

---

## Task 0: 协议层 —— 加 CHAT_DETACH + ConversationMeta

**Files:**

- Modify: `packages/shared/src/protocol.ts:166-187`

- [ ] **Step 1: 加 `ConversationMeta` 类型 + `CHAT_DETACH` 消息**

在 `packages/shared/src/protocol.ts` 的 `ChatMessage` 接口（166-170 行）之后、`ChatClientMessage` 类型之前插入：

```ts
// 对话元数据（前端 store 用；status 由前端维护，服务端不持有）
export interface ConversationMeta {
  conversationId: string
  claudeSessionId: string
  cwd: string
  viewMode: ChatViewMode
  tier: ChatPermissionTier
  status: 'connecting' | 'active' | 'crashed'
  lastActivity: number
}
```

在 `ChatClientMessage` 联合（187 行 `CHAT_PING` 之前）加一个分支：

```ts
  | { type: 'CHAT_DETACH'; conversationId: string }
```

- [ ] **Step 2: 类型检查**

Run: `pnpm --filter @ai-cli/shared build` （或 `tsc --noEmit -p packages/shared`）
Expected: 通过，无错误。

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/protocol.ts
git commit -m "feat(shared): add CHAT_DETACH message + ConversationMeta type

Co-authored-by: GLM 5.2"
```

---

## Task 1: 服务端 ChatGateway —— CHAT_DETACH 分支 + reaper 30s

**Files:**

- Modify: `apps/server/src/chat/ChatGateway.ts:23,80-168`
- Test: `apps/server/src/__tests__/chat/ChatGateway.test.ts`

- [ ] **Step 1: 写失败测试 —— CHAT_DETACH 移除订阅 + 触发 reaper**

在 `apps/server/src/__tests__/chat/ChatGateway.test.ts` 末尾的 `describe` 块内加：

```ts
it('CHAT_DETACH removes the ws from subscribers (reaper eligible)', async () => {
  vi.useFakeTimers()
  const { gw, mgr } = setup()
  const ws = fakeWs()
  gw.handleChatConnection(ws as unknown as WebSocket, USER)
  ws.emit(
    'message',
    Buffer.from(
      JSON.stringify({
        type: 'CHAT_CREATE',
        cwd: '',
        claudeSessionId: 'c-1',
        providerId: 'claude-code',
      }),
    ),
  )
  await Promise.resolve()
  const convId = (ws.sent[0] as { conversationId: string }).conversationId
  expect(mgr.get(convId)).toBeDefined()

  ws.emit('message', Buffer.from(JSON.stringify({ type: 'CHAT_DETACH', conversationId: convId })))
  await Promise.resolve()
  expect(mgr.get(convId)).toBeDefined() // reaper 还没到期

  vi.advanceTimersByTime(31_000) // 超过 30s reaper
  expect(mgr.get(convId)).toBeUndefined()
  vi.useRealTimers()
})
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @ai-cli/server test -- ChatGateway`
Expected: FAIL（`CHAT_DETACH` 分支不存在；30s 后 conversation 仍在）。

- [ ] **Step 3: 实现 —— reaper TTL 30s + ws id**

`apps/server/src/chat/ChatGateway.ts`：

顶部加 import：`import { randomUUID } from 'node:crypto'`

第 23 行：`const CHAT_IDLE_TTL_MS = 30_000`

`handleChatConnection`（44 行）开头给 ws 打 id：

```ts
;(ws as WebSocket & { __id: string }).__id = randomUUID()
```

- [ ] **Step 4: 实现 —— per-(ws,conversation) cleanup 注册表**

类顶部字段（26-29 行后）加：

```ts
  // per-(ws,conversation) cleanup fns，detach 与 close 共用
  private detachCleanups = new Map<string, () => void>()
```

改造 `attach`（178-219 行）的 `ws.once('close', ...)` 段为：

```ts
const cleanup = () => {
  conv.off('event', onEvent)
  conv.off('viewChanged', onView)
  conv.off('tierChanged', onTier)
  conv.off('crashed', onCrash)
  const remaining = this.subscribers.get(conversationId)
  remaining?.delete(ws)
  this.detachCleanups.delete(key)
  if (remaining && remaining.size === 0) this.scheduleReaper(conversationId)
}
const key = `${(ws as WebSocket & { __id: string }).__id}:${conversationId}`
this.detachCleanups.set(key, cleanup)
ws.once('close', cleanup)
```

- [ ] **Step 5: 实现 —— CHAT_DETACH 分支 + detach 方法**

在 `dispatch` 的 `switch`（约 153-167 行 `CHAT_ESCALATE` case 之后）加：

```ts
      case 'CHAT_DETACH': {
        this.detach(ws, msg.conversationId)
        return
      }
```

在 `attach` 方法之后新增：

```ts
  /**
   * Remove a WebSocket's subscription to a conversation without closing the WS.
   * Reuses the per-(ws,conversation) cleanup registered in `attach`; if no
   * subscribers remain, the reaper fires on its normal schedule.
   */
  private detach(ws: WebSocket, conversationId: string): void {
    const key = `${(ws as WebSocket & { __id: string }).__id}:${conversationId}`
    const fn = this.detachCleanups.get(key)
    if (fn) fn()
  }
```

- [ ] **Step 6: 跑测试，确认通过**

Run: `pnpm --filter @ai-cli/server test -- ChatGateway`
Expected: PASS（含新 CHAT_DETACH 测试 + 既有用例不回归）。

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/chat/ChatGateway.ts apps/server/src/__tests__/chat/ChatGateway.test.ts
git commit -m "feat(chat): CHAT_DETACH removes subscription; reaper TTL 60s→30s

Co-authored-by: GLM 5.2"
```

---

## Task 2: 前端 store —— 多对话 slice 重构

**Files:**

- Modify: `apps/web/src/store/sessionStore.ts`
- Test: `apps/web/src/__tests__/store/sessionStore.multi.test.ts`（新建）

> 这是改动最大的 task。状态从单值变集合，多个 actions 改签名。

- [ ] **Step 1: 写失败测试 —— 多对话 CRUD + LRU + 路由**

新建 `apps/web/src/__tests__/store/sessionStore.multi.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../../store/sessionStore'
import { initialChatState } from '../../lib/chatReducer'

beforeEach(() => useSessionStore.getState().reset())

describe('multi-conversation store', () => {
  it('createConversation adds a placeholder + sets active', () => {
    const s = useSessionStore.getState()
    s.createConversation('/repo')
    const st = useSessionStore.getState()
    expect(st.conversations).toHaveLength(1)
    expect(st.conversations[0].status).toBe('connecting')
  })

  it('switchTo changes activeConversationId', () => {
    const s = useSessionStore.getState()
    s.createConversation('/a')
    s.createConversation('/b')
    const [first] = useSessionStore.getState().conversations
    s.switchTo(first.conversationId)
    expect(useSessionStore.getState().activeConversationId).toBe(first.conversationId)
  })

  it('closeConversation removes from conversations/chats/subscriptions', () => {
    const s = useSessionStore.getState()
    s.createConversation('/a')
    const id = useSessionStore.getState().conversations[0].conversationId
    // CHAT_CREATED 回填前 conversationId 为空，这里手动注入一个完整对话测清理
    useSessionStore.setState({
      conversations: [
        {
          conversationId: 'c1',
          claudeSessionId: 'x',
          cwd: '/a',
          viewMode: 'chat',
          tier: 'Explore',
          status: 'active',
          lastActivity: 1,
        },
      ],
      chats: { c1: { ...initialChatState } },
      subscribedConversationIds: ['c1'],
    })
    s.closeConversation('c1')
    const st = useSessionStore.getState()
    expect(st.conversations.find((c) => c.conversationId === 'c1')).toBeUndefined()
    expect(st.chats['c1']).toBeUndefined()
    expect(st.subscribedConversationIds).not.toContain('c1')
  })

  it('LRU closes oldest when exceeding maxConversations', () => {
    const s = useSessionStore.getState()
    s.setMaxConversations(2)
    s.createConversation('/a')
    s.createConversation('/b')
    s.createConversation('/c')
    const st = useSessionStore.getState()
    expect(st.conversations).toHaveLength(2)
  })

  it('applyChatAction routes by conversationId', () => {
    const s = useSessionStore.getState()
    useSessionStore.setState({
      conversations: [
        {
          conversationId: 'c1',
          claudeSessionId: 'x',
          cwd: '/a',
          viewMode: 'chat',
          tier: 'Explore',
          status: 'active',
          lastActivity: 1,
        },
        {
          conversationId: 'c2',
          claudeSessionId: 'y',
          cwd: '/b',
          viewMode: 'chat',
          tier: 'Explore',
          status: 'active',
          lastActivity: 2,
        },
      ],
      chats: { c1: { ...initialChatState }, c2: { ...initialChatState } },
    })
    s.applyChatAction('c1', { type: 'user-message', text: 'hi' })
    const st = useSessionStore.getState()
    expect(st.chats['c1'].turns).toHaveLength(1)
    expect(st.chats['c2'].turns).toHaveLength(0)
  })

  it('maxConversations persists via partialize', () => {
    useSessionStore.getState().setMaxConversations(7)
    const partialize = (
      useSessionStore as unknown as {
        persist: { getOptions: () => { partialize: (s: unknown) => Record<string, unknown> } }
      }
    ).persist.getOptions().partialize
    const persisted = partialize(useSessionStore.getState())
    expect(persisted.maxConversations).toBe(7)
  })
})
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @ai-cli/web test -- sessionStore.multi`
Expected: FAIL（新字段/actions 不存在）。

- [ ] **Step 3: 改 sessionStore 类型 + 初始状态**

`apps/web/src/store/sessionStore.ts`：

(a) 顶部 import 加 `ConversationMeta`：

```ts
import {
  AgentStatus,
  type ChatPermissionTier,
  type ChatViewMode,
  type ConversationMeta,
} from '@ai-cli/shared'
```

(b) 删除 `Conversation` interface（43-50 行）。

(c) `SessionState` interface：删除 `conversation: Conversation | null`（136 行）和 `chat: ChatRenderState`（137 行），替换为：

```ts
  // Multi-conversation (replaces single conversation/chat fields)
  conversations: ConversationMeta[]
  chats: Record<string, ChatRenderState>
  activeConversationId: string | null
  subscribedConversationIds: string[]
  maxConversations: number
```

(d) 删除 `startConversation`/`endConversation`/`setChatViewMode`/`setChatTier`（192-196 行 actions 声明），新增：

```ts
  createConversation: (cwd: string) => string
  switchTo: (conversationId: string) => void
  closeConversation: (conversationId: string) => void
  setConversationStatus: (id: string, status: ConversationMeta['status']) => void
  setConversationViewMode: (id: string, mode: ChatViewMode) => void
  setConversationTier: (id: string, tier: ChatPermissionTier) => void
  setConversationId: (claudeSessionId: string, conversationId: string) => void
  applyChatAction: (conversationId: string, action: ChatAction) => void
  markSubscribed: (conversationId: string) => void
  setMaxConversations: (n: number) => void
```

(e) `initialState`：把 `conversation: null` / `chat: initialChatState` 替换为：

```ts
  conversations: [] as ConversationMeta[],
  chats: {} as Record<string, ChatRenderState>,
  activeConversationId: null as string | null,
  subscribedConversationIds: [] as string[],
  maxConversations: 5,
```

- [ ] **Step 4: 实现新 actions**

替换 `startConversation`/`endConversation`/`setChatViewMode`/`setChatTier`/`setConversationId` 实现（411-455 行）为：

```ts
      createConversation: (cwd) => {
        const { conversations, maxConversations } = get()
        let next = conversations
        if (conversations.length >= maxConversations) {
          const oldest = [...conversations].sort((a, b) => a.lastActivity - b.lastActivity)[0]
          get().closeConversation(oldest.conversationId)
          next = get().conversations
        }
        const claudeSessionId = crypto.randomUUID()
        const placeholder: ConversationMeta = {
          conversationId: '',
          claudeSessionId,
          cwd,
          viewMode: 'chat',
          tier: 'Explore',
          status: 'connecting',
          lastActivity: Date.now(),
        }
        ;(get() as SessionState & { _pendingActiveClaudeId?: string })._pendingActiveClaudeId = claudeSessionId
        set({ conversations: [...next, placeholder], activeConversationId: '' })
        return claudeSessionId
      },

      switchTo: (conversationId) =>
        set((s) => ({
          activeConversationId: conversationId,
          conversations: s.conversations.map((c) =>
            c.conversationId === conversationId ? { ...c, lastActivity: Date.now() } : c,
          ),
        })),

      closeConversation: (conversationId) =>
        set((s) => {
          const remaining = s.conversations.filter((c) => c.conversationId !== conversationId)
          const nextChats = { ...s.chats }
          delete nextChats[conversationId]
          let nextActive = s.activeConversationId
          if (s.activeConversationId === conversationId) {
            nextActive = remaining[remaining.length - 1]?.conversationId ?? null
          }
          return {
            conversations: remaining,
            chats: nextChats,
            activeConversationId: nextActive,
            subscribedConversationIds: s.subscribedConversationIds.filter((id) => id !== conversationId),
          }
        }),

      setConversationStatus: (id, status) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.conversationId === id ? { ...c, status } : c)),
        })),

      setConversationViewMode: (id, mode) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.conversationId === id ? { ...c, viewMode: mode, lastActivity: Date.now() } : c,
          ),
        })),

      setConversationTier: (id, tier) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.conversationId === id ? { ...c, tier } : c)),
        })),

      setConversationId: (claudeSessionId, conversationId) =>
        set((s) => {
          const conversations = s.conversations.map((c) =>
            c.claudeSessionId === claudeSessionId
              ? { ...c, conversationId, status: 'active' as const }
              : c,
          )
          const pending = (s as SessionState & { _pendingActiveClaudeId?: string })._pendingActiveClaudeId
          const activeConversationId = pending === claudeSessionId ? conversationId : s.activeConversationId
          return { conversations, activeConversationId }
        }),

      applyChatAction: (conversationId, action) =>
        set((s) => {
          const prev = s.chats[conversationId] ?? initialChatState
          return { chats: { ...s.chats, [conversationId]: chatReducer(prev, action) } }
        }),

      markSubscribed: (conversationId) =>
        set((s) =>
          s.subscribedConversationIds.includes(conversationId)
            ? s
            : { subscribedConversationIds: [...s.subscribedConversationIds, conversationId] },
        ),

      setMaxConversations: (n) => set({ maxConversations: Math.max(1, Math.min(10, n)) }),
```

- [ ] **Step 5: partialize 加 maxConversations + 版本号**

`partialize`（约 829-843 行）返回对象加：

```ts
        maxConversations: state.maxConversations,
```

`version: 1` 改为 `version: 2`。

- [ ] **Step 6: 跑新测试，确认通过**

Run: `pnpm --filter @ai-cli/web test -- sessionStore.multi`
Expected: PASS（6 个用例全绿）。

- [ ] **Step 7: 记录既有 store 测试失败（待 Task 9 统一修）**

Run: `pnpm --filter @ai-cli/web test -- sessionStore.chat 2>&1 | tail -20`
Expected: `sessionStore.chat.test.ts` 因旧 `startConversation`/`conversation`/`chat` 失败 —— 记录，Task 9 修。

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/store/sessionStore.ts apps/web/src/__tests__/store/sessionStore.multi.test.ts
git commit -m "feat(web): multi-conversation store slice (collection + LRU + routing)

Co-authored-by: GLM 5.2"
```

---

## Task 3: 前端 useChatWS —— 单 WS 多路复用 + API 改造

**Files:**

- Modify: `apps/web/src/hooks/useChatWS.ts`
- Test: `apps/web/src/__tests__/chat/useChatWS.test.ts`

> API 从 `connect/disconnect` per-conversation 改为 `createConversation/switchTo/closeConversation` + 单 WS app 级生命周期。

- [ ] **Step 1: 改造 useChatWS 测试（多对话）**

重写 `apps/web/src/__tests__/chat/useChatWS.test.ts`，保留 FakeWS helper，用例改为：

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatWS } from '../../hooks/useChatWS'
import { useSessionStore } from '../../store/sessionStore'

class FakeWS {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeWS[] = []
  static last() {
    return FakeWS.instances[FakeWS.instances.length - 1]
  }
  url: string
  readyState = 1
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  constructor(url: string) {
    this.url = url
    FakeWS.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  close() {
    this.readyState = 3
  }
  deliver(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) })
  }
  fireOpen() {
    this.onopen?.()
  }
  fireClose(code: number) {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

beforeEach(() => {
  FakeWS.instances = []
  useSessionStore.getState().reset()
  vi.stubGlobal('WebSocket', FakeWS)
})

function render() {
  return renderHook(() => useChatWS(() => 'access-token', vi.fn()))
}

it('createConversation sends CHAT_CREATE', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
  act(() => result.current.createConversation('/repo'))
  const sent = JSON.parse(FakeWS.last().sent[0])
  expect(sent.type).toBe('CHAT_CREATE')
  expect(sent.cwd).toBe('/repo')
})

it('switchTo sends CHAT_RECONNECT for an unsubscribed conversation', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
  useSessionStore.setState({
    conversations: [
      {
        conversationId: 'c1',
        claudeSessionId: 'x',
        cwd: '/a',
        viewMode: 'chat',
        tier: 'Explore',
        status: 'active',
        lastActivity: 1,
      },
    ],
  })
  act(() => result.current.switchTo('c1'))
  const reconnects = FakeWS.last()
    .sent.map((s) => JSON.parse(s))
    .filter((m) => m.type === 'CHAT_RECONNECT')
  expect(reconnects).toHaveLength(1)
})

it('ensureSubscribed is idempotent (no duplicate CHAT_RECONNECT)', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
  useSessionStore.setState({
    conversations: [
      {
        conversationId: 'c1',
        claudeSessionId: 'x',
        cwd: '/a',
        viewMode: 'chat',
        tier: 'Explore',
        status: 'active',
        lastActivity: 1,
      },
    ],
    subscribedConversationIds: ['c1'],
  })
  act(() => result.current.switchTo('c1'))
  const reconnects = FakeWS.last()
    .sent.map((s) => JSON.parse(s))
    .filter((m) => m.type === 'CHAT_RECONNECT')
  expect(reconnects).toHaveLength(0)
})

it('closeConversation sends CHAT_DETACH', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
  useSessionStore.setState({
    conversations: [
      {
        conversationId: 'c1',
        claudeSessionId: 'x',
        cwd: '/a',
        viewMode: 'chat',
        tier: 'Explore',
        status: 'active',
        lastActivity: 1,
      },
    ],
    subscribedConversationIds: ['c1'],
    activeConversationId: 'c1',
  })
  act(() => result.current.closeConversation('c1'))
  const detaches = FakeWS.last()
    .sent.map((s) => JSON.parse(s))
    .filter((m) => m.type === 'CHAT_DETACH')
  expect(detaches).toHaveLength(1)
})

it('reconnect re-subscribes all subscribedConversationIds', () => {
  const { result } = render()
  act(() => FakeWS.last().fireOpen())
  useSessionStore.setState({ subscribedConversationIds: ['c1', 'c2'] })
  act(() => result.current.reconnect())
  act(() => FakeWS.last().fireOpen())
  const reconnects = FakeWS.last()
    .sent.map((s) => JSON.parse(s))
    .filter((m) => m.type === 'CHAT_RECONNECT')
  expect(reconnects).toHaveLength(2)
})
```

删除旧 `connect sends CHAT_CREATE` 等单对话用例。

- [ ] **Step 2: 跑测试，确认失败**

Run: `pnpm --filter @ai-cli/web test -- useChatWS`
Expected: FAIL（新 API 不存在）。

- [ ] **Step 3: 重写 useChatWS 实现**

完整重写 `apps/web/src/hooks/useChatWS.ts`：

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type ChatClientMessage,
  type ChatServerMessage,
  type ChatPermissionTier,
  type ChatViewMode,
  WS_CLOSE_CODE,
} from '@ai-cli/shared'
import { useSessionStore } from '../store/sessionStore'

const WS_BASE =
  import.meta.env.VITE_WS_URL ||
  (() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${window.location.host}`
  })()

const CHAT_MSG_TYPES = new Set([
  'CHAT_AUTH_OK',
  'CHAT_PONG',
  'CHAT_CREATED',
  'CHAT_EVENT',
  'CHAT_VIEW_CHANGED',
  'CHAT_CRASHED',
  'CHAT_HISTORY',
  'CHAT_ERROR',
])

function isValidChatMsg(data: unknown): data is { type: string; [k: string]: unknown } {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return typeof obj.type === 'string' && CHAT_MSG_TYPES.has(obj.type)
}

const MAX_MESSAGE_BYTES = 256 * 1024
const INITIAL_RECONNECT_DELAY = 1_000
const MAX_RECONNECT_DELAY = 30_000

export interface UseChatWS {
  createConversation: (cwd: string) => void
  switchTo: (conversationId: string) => void
  closeConversation: (conversationId: string) => void
  sendMessage: (text: string) => void
  escalate: (tier: ChatPermissionTier) => void
  switchView: (mode: ChatViewMode) => void
  reconnect: () => void
  isConnected: boolean
}

export function useChatWS(
  getAccessToken: () => string | null,
  onAuthFailure: () => void,
): UseChatWS {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
  const [isConnected, setIsConnected] = useState(false)
  const store = useSessionStore

  function closeSocket() {
    const ws = wsRef.current
    if (ws) {
      ws.onopen = null
      ws.onmessage = null
      ws.onclose = null
      ws.onerror = null
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close()
      wsRef.current = null
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }

  function send(msg: ChatClientMessage) {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  function handleMessage(data: ChatServerMessage) {
    if (!isValidChatMsg(data)) return
    const id = (data as { conversationId?: string }).conversationId
    switch (data.type) {
      case 'CHAT_CREATED': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_CREATED' }>
        store.getState().setConversationId(m.claudeSessionId, m.conversationId)
        store.getState().setConversationViewMode(m.conversationId, m.viewMode)
        store.getState().setConversationTier(m.conversationId, m.tier)
        store.getState().markSubscribed(m.conversationId)
        store.getState().setConversationStatus(m.conversationId, 'active')
        setIsConnected(true)
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        clearReconnectTimer()
        break
      }
      case 'CHAT_HISTORY': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_HISTORY' }>
        store
          .getState()
          .applyChatAction(m.conversationId, { type: 'load-history', messages: m.messages })
        store.getState().markSubscribed(m.conversationId)
        store.getState().setConversationStatus(m.conversationId, 'active')
        setIsConnected(true)
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
        clearReconnectTimer()
        break
      }
      case 'CHAT_EVENT': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_EVENT' }>
        store.getState().applyChatAction(m.conversationId, { type: 'event', event: m.event })
        break
      }
      case 'CHAT_VIEW_CHANGED': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_VIEW_CHANGED' }>
        store.getState().setConversationViewMode(m.conversationId, m.viewMode)
        store.getState().setConversationTier(m.conversationId, m.tier)
        break
      }
      case 'CHAT_CRASHED': {
        const m = data as Extract<ChatServerMessage, { type: 'CHAT_CRASHED' }>
        store.getState().setConversationStatus(m.conversationId, 'crashed')
        store.getState().applyChatAction(m.conversationId, {
          type: 'crashed',
          message: m.message,
          resumable: m.resumable,
        })
        break
      }
      case 'CHAT_ERROR':
        console.error('[Chat WS] error:', (data as { message: string }).message)
        break
      case 'CHAT_PONG':
      case 'CHAT_AUTH_OK':
        break
    }
    void id
  }

  const connectInternal = useCallback(() => {
    const token = getAccessToken()
    if (!token) {
      onAuthFailure()
      return
    }
    store.getState().setChatConnected('CONNECTING')
    const ws = new WebSocket(`${WS_BASE}/ws/chat?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      store.getState().setChatConnected('CONNECTED')
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
      clearReconnectTimer()
      // 重连后批量重订阅，active 优先
      const { subscribedConversationIds, activeConversationId } = store.getState()
      const ordered = activeConversationId
        ? [
            activeConversationId,
            ...subscribedConversationIds.filter((x) => x !== activeConversationId),
          ]
        : subscribedConversationIds
      for (const cid of ordered) send({ type: 'CHAT_RECONNECT', conversationId: cid })
    }

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return
      try {
        handleMessage(JSON.parse(event.data) as ChatServerMessage)
      } catch {
        /* malformed */
      }
    }

    ws.onclose = (event) => {
      setIsConnected(false)
      store.getState().setChatConnected('DISCONNECTED')
      if (event.code === WS_CLOSE_CODE.AUTH_FAILED) onAuthFailure()
      else scheduleReconnect()
    }
    ws.onerror = () => {}
  }, [getAccessToken, onAuthFailure, store])

  function scheduleReconnect() {
    if (reconnectTimerRef.current) return
    const delay = reconnectDelayRef.current
    const jittered = delay * (0.5 + Math.random() * 0.5)
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY)
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null
      closeSocket()
      connectInternal()
    }, jittered)
  }

  // app mount 建连一次，unmount 断开
  useEffect(() => {
    connectInternal()
    return () => {
      clearReconnectTimer()
      closeSocket()
    }
  }, [connectInternal])

  const ensureSubscribed = useCallback(
    (conversationId: string) => {
      if (!conversationId) return
      const { subscribedConversationIds } = store.getState()
      if (subscribedConversationIds.includes(conversationId)) return
      send({ type: 'CHAT_RECONNECT', conversationId })
    },
    [store],
  )

  const createConversation = useCallback(
    (cwd: string) => {
      const claudeSessionId = store.getState().createConversation(cwd)
      send({
        type: 'CHAT_CREATE',
        cwd,
        claudeSessionId,
        providerId: 'claude-code',
        initialTier: 'Explore',
      })
    },
    [store],
  )

  const switchTo = useCallback(
    (conversationId: string) => {
      ensureSubscribed(conversationId)
      store.getState().switchTo(conversationId)
    },
    [ensureSubscribed, store],
  )

  const closeConversation = useCallback(
    (conversationId: string) => {
      send({ type: 'CHAT_DETACH', conversationId })
      store.getState().closeConversation(conversationId)
    },
    [store],
  )

  const sendMessage = useCallback(
    (text: string) => {
      const bytes = new TextEncoder().encode(text).length
      if (bytes > MAX_MESSAGE_BYTES) return
      const { activeConversationId, conversations } = store.getState()
      const conv = conversations.find((c) => c.conversationId === activeConversationId)
      if (!conv?.conversationId) return
      store.getState().applyChatAction(conv.conversationId, { type: 'user-message', text })
      send({ type: 'CHAT_SEND', conversationId: conv.conversationId, text })
    },
    [store],
  )

  const escalate = useCallback((tier: ChatPermissionTier) => {
    const id = store.getState().activeConversationId
    if (id) send({ type: 'CHAT_ESCALATE', conversationId: id, tier })
  }, [])

  const switchView = useCallback(
    (mode: ChatViewMode) => {
      const id = store.getState().activeConversationId
      if (id) {
        send({ type: 'CHAT_SWITCH_VIEW', conversationId: id, viewMode: mode })
        store.getState().setConversationViewMode(id, mode)
      }
    },
    [store],
  )

  const reconnect = useCallback(() => {
    clearReconnectTimer()
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
    closeSocket()
    connectInternal()
  }, [connectInternal])

  return {
    createConversation,
    switchTo,
    closeConversation,
    sendMessage,
    escalate,
    switchView,
    reconnect,
    isConnected,
  }
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `pnpm --filter @ai-cli/web test -- useChatWS`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useChatWS.ts apps/web/src/__tests__/chat/useChatWS.test.ts
git commit -m "feat(web): useChatWS single-WS multiplexing + multi-conversation API

Co-authored-by: GLM 5.2"
```

---

## Task 4: ChatTransport 组件 + ChatView selector 改造

**Files:**

- Create: `apps/web/src/components/ChatTransport.tsx`
- Modify: `apps/web/src/components/chat/ChatView.tsx`、`apps/web/src/store/sessionStore.ts`（加 ref 字段）

> P1 #9 落地：WS 所有权从 ChatView 抽到 ChatTransport（纯 transport，不渲染 UI）。

- [ ] **Step 1: sessionStore 加 transport ref 字段**

`SessionState` interface 加：

```ts
  chatCreateConversation: ((cwd: string) => void) | null
  chatSwitchTo: ((conversationId: string) => void) | null
  chatCloseConversation: ((conversationId: string) => void) | null
```

`initialState` 加对应 `null` 初始化。

- [ ] **Step 2: 新建 ChatTransport**

新建 `apps/web/src/components/ChatTransport.tsx`：

```tsx
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useChatWS } from '../hooks/useChatWS'
import { useSessionStore } from '../store/sessionStore'

/**
 * ChatTransport — owns the single /ws/chat connection for the whole app.
 * Renders nothing. Exposes chat actions on the store so any component
 * (NewSessionDrawer, ChatView, terminal "back to chat" button) can trigger
 * them without re-instantiating useChatWS.
 *
 * This decouples WS lifetime from ChatView mount/unmount (audit P1 #9).
 */
export function ChatTransport() {
  const { logout } = useAuth()
  const getAccessToken = () => useSessionStore.getState().accessToken
  const {
    createConversation,
    switchTo,
    closeConversation,
    sendMessage,
    escalate,
    switchView,
    reconnect,
  } = useChatWS(getAccessToken, logout)

  useEffect(() => {
    useSessionStore.setState({
      chatCreateConversation: createConversation,
      chatSwitchTo: switchTo,
      chatCloseConversation: closeConversation,
      sendChatMessage: sendMessage,
      chatEscalate: escalate,
      chatSwitchView: switchView,
      chatReconnect: reconnect,
    })
    return () => {
      useSessionStore.setState({
        chatCreateConversation: null,
        chatSwitchTo: null,
        chatCloseConversation: null,
        sendChatMessage: null,
        chatEscalate: null,
        chatSwitchView: null,
        chatReconnect: null,
      })
    }
  }, [
    createConversation,
    switchTo,
    closeConversation,
    sendMessage,
    escalate,
    switchView,
    reconnect,
  ])

  return null
}
```

- [ ] **Step 3: ChatView 改读多对话 slice + 不再持有 useChatWS**

重写 `apps/web/src/components/chat/ChatView.tsx`：

```tsx
import { useEffect, useRef } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { useUiTheme } from '../../hooks/useUiTheme'
import { MessageBubble } from './MessageBubble'
import { ToolCallCard } from './ToolCallCard'
import { ChatInput } from './ChatInput'
import { ModeSwitch } from './ModeSwitch'

export function ChatView() {
  const ui = useUiTheme()
  const activeId = useSessionStore((s) => s.activeConversationId)
  const conversation = useSessionStore(
    (s) => s.conversations.find((c) => c.conversationId === s.activeConversationId) ?? null,
  )
  const chat = useSessionStore((s) =>
    s.activeConversationId ? s.chats[s.activeConversationId] : undefined,
  )
  const role = useSessionStore((s) => s.currentUser?.role ?? 'user')
  const sendMessage = useSessionStore((s) => s.sendChatMessage)
  const escalate = useSessionStore((s) => s.chatEscalate)
  const switchView = useSessionStore((s) => s.chatSwitchView)
  const reconnect = useSessionStore((s) => s.chatReconnect)

  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight })
  }, [chat?.turns, activeId])

  if (!conversation || !chat) {
    return (
      <div className={`absolute inset-0 flex items-center justify-center text-sm ${ui.textDim}`}>
        No active conversation
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex flex-col" data-testid="chat-view">
      <ModeSwitch
        tier={conversation.tier}
        role={role}
        onEscalate={escalate!}
        onSwitchView={switchView!}
      />
      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-2 ${ui.panel}`}>
        {chat.turns.map((t) => (
          <div key={t.id}>
            {t.error ? (
              <MessageBubble role="assistant" text="" error={t.error} />
            ) : (
              <>
                {(t.text || t.role === 'user') && <MessageBubble role={t.role} text={t.text} />}
                {t.toolCalls.map((c) => (
                  <ToolCallCard key={c.callId} call={c} />
                ))}
              </>
            )}
          </div>
        ))}
        {(chat.status === 'working' || chat.status === 'thinking') && (
          <div className="flex items-center gap-1.5 px-1 py-1 text-xs text-gray-400">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            {chat.status === 'thinking' ? '思考中…' : '工作中…'}
          </div>
        )}
        {chat.crashed && (
          <div
            className="m-2 rounded-lg border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-300"
            data-testid="crash-banner"
          >
            <p>{chat.crashed.message}</p>
            {chat.crashed.resumable && (
              <button
                onClick={() => reconnect?.()}
                className="mt-1 rounded bg-red-500/30 px-2 py-0.5 hover:bg-red-500/50"
              >
                重新连接
              </button>
            )}
          </div>
        )}
      </div>
      <ChatInput onSend={sendMessage!} />
    </div>
  )
}
```

- [ ] **Step 4: 跑 ChatView 既有测试，按需更新**

Run: `pnpm --filter @ai-cli/web test -- ChatView`
Expected: 旧测试用单值 store，需更新为多对话（`createConversation` + 注入 `activeConversationId` + `chats[id]`）。逐个修。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/ChatTransport.tsx apps/web/src/components/chat/ChatView.tsx apps/web/src/store/sessionStore.ts apps/web/src/__tests__/chat/ChatView.test.tsx
git commit -m "feat(web): ChatTransport owns WS; ChatView reads multi-conversation slice (P1 #9)

Co-authored-by: GLM 5.2"
```

---

## Task 5: SplitPane —— 挂 ChatTransport + ChatView 渲染解耦

**Files:**

- Modify: `apps/web/src/components/SplitPane.tsx:11,241-290`

> ChatView 不再绑 `conversation.panelId`；active 对话 viewMode==='chat' 时，活跃终端面板承载 ChatView。ChatTransport 挂 SplitPane 顶层。

- [ ] **Step 1: 挂 ChatTransport**

`SplitPane.tsx` 顶部 import：

```tsx
import { ChatTransport } from './ChatTransport'
```

主组件 return 最外层第一个元素放 `<ChatTransport />`（不渲染 UI，位置随意）。

- [ ] **Step 2: TerminalPanel 的 ChatView 渲染条件改基于 activeConversationId**

`SplitPane.tsx:241-290` 的 `TerminalPanel` 改为：

```tsx
function TerminalPanel({ panelId }: { panelId: string }) {
  const sessionId = useSessionStore((s) => s.terminalSessions[panelId])
  const activePanelId = useSessionStore((s) => s.activePanelId)
  const activeConv = useSessionStore(
    (s) => s.conversations.find((c) => c.conversationId === s.activeConversationId) ?? null,
  )

  const isChatHost = activePanelId === panelId && activeConv?.viewMode === 'chat'
  if (isChatHost) {
    return (
      <div className="absolute inset-0">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-gray-500">
              Loading chat…
            </div>
          }
        >
          <ChatView />
        </Suspense>
      </div>
    )
  }
  return (
    <div className="absolute inset-0 flex flex-col">
      {activeConv && activePanelId === panelId && activeConv.viewMode === 'terminal' && (
        <button
          onClick={() => useSessionStore.getState().chatSwitchView?.('chat')}
          className="shrink-0 border-b border-[#292e42] bg-blue-600/20 px-3 py-1.5 text-left text-xs text-blue-300 hover:bg-blue-600/30"
        >
          ← 返回对话
        </button>
      )}
      <div className="relative min-h-0 flex-1">
        {sessionId ? (
          <TerminalContainer panelId={panelId} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-500 select-none">
            Click a tab to assign terminal
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 类型检查 + 测试**

Run: `pnpm --filter @ai-cli/web exec tsc --noEmit && pnpm --filter @ai-cli/web test`
Expected: 类型通过；SplitPane 相关测试若失败更新断言。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SplitPane.tsx
git commit -m "feat(web): mount ChatTransport; ChatView hosted by active panel (P1 #9)

Co-authored-by: GLM 5.2"
```

---

## Task 6: NewSessionDrawer —— 对话列表 + 新入口

**Files:**

- Modify: `apps/web/src/components/NewSessionDrawer.tsx`

- [ ] **Step 1: 改造 handleNewConversation 走 transport**

`NewSessionDrawer.tsx` 的 `handleNewConversation`（112-116 行）：

```tsx
const handleNewConversation = useCallback(() => {
  useSessionStore.getState().chatCreateConversation?.(cwd || '')
  onOpenChange(false)
}, [onOpenChange, cwd])
```

- [ ] **Step 2: 加对话列表区**

在"Claude 对话会话"按钮（192 行）之后插入 `<ConversationList onOpenChange={onOpenChange} />`。

文件底部（export 前）加组件：

```tsx
function ConversationList({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const ui = useUiTheme()
  const conversations = useSessionStore((s) => s.conversations)
  const activeId = useSessionStore((s) => s.activeConversationId)
  if (conversations.length === 0) return null
  return (
    <div className="px-1 mb-2">
      <div className={`px-3 py-1 text-xs ${ui.textDim}`}>Conversations</div>
      {conversations.map((c) => {
        const isActive = c.conversationId === activeId
        const dot =
          c.status === 'active'
            ? 'bg-green-400'
            : c.status === 'connecting'
              ? 'bg-yellow-400'
              : 'bg-red-400'
        return (
          <div
            key={c.claudeSessionId}
            onClick={() => {
              if (c.conversationId) {
                useSessionStore.getState().chatSwitchTo?.(c.conversationId)
                onOpenChange(false)
              }
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${ui.hover} ${isActive ? 'bg-blue-500/10' : ''}`}
          >
            <span className={`w-2 h-2 rounded-full ${dot} shrink-0`} />
            <span className={`text-sm ${ui.text} truncate flex-1`}>
              {c.claudeSessionId.slice(0, 8)}
            </span>
            <span className={`text-[10px] ${ui.textDim}`}>{c.tier}</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                useSessionStore.getState().chatCloseConversation?.(c.conversationId)
              }}
              className={`p-0.5 rounded ${ui.hover} shrink-0`}
              aria-label="Close conversation"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
```

顶部 lucide-react import 加 `X`（若未导入）。

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @ai-cli/web exec tsc --noEmit`
Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/NewSessionDrawer.tsx
git commit -m "feat(web): NewSessionDrawer conversation list + multi-conversation entry

Co-authored-by: GLM 5.2"
```

---

## Task 7: SettingsDrawer —— 最大对话数调节器

**Files:**

- Modify: `apps/web/src/components/SettingsDrawer.tsx`

- [ ] **Step 1: selector 区加字段**

`SettingsDrawer.tsx`（14-25 行 selector 区）加：

```tsx
const maxConversations = useSessionStore((s) => s.maxConversations)
const setMaxConversations = useSessionStore((s) => s.setMaxConversations)
```

- [ ] **Step 2: 加调节器（Editor Font Size 块之后）**

在 Editor Font Size 块（约 102 行闭合）之后、Interface Theme 之前插入：

```tsx
{
  /* Max Conversations */
}
;<div className="flex items-center justify-between">
  <span className={`text-sm ${ui.text}`}>Max Conversations</span>
  <div className="flex items-center gap-2">
    <button
      onClick={() => setMaxConversations(Math.max(1, maxConversations - 1))}
      disabled={maxConversations <= 1}
      className={`p-1.5 rounded ${ui.border} ${ui.text} ${ui.hover} disabled:opacity-30`}
    >
      <Minus className="w-3.5 h-3.5" />
    </button>
    <span className={`w-8 text-center text-sm ${ui.text} tabular-nums`}>{maxConversations}</span>
    <button
      onClick={() => setMaxConversations(Math.min(10, maxConversations + 1))}
      disabled={maxConversations >= 10}
      className={`p-1.5 rounded ${ui.border} ${ui.text} ${ui.hover} disabled:opacity-30`}
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
</div>
```

- [ ] **Step 3: 类型检查**

Run: `pnpm --filter @ai-cli/web exec tsc --noEmit`
Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/SettingsDrawer.tsx
git commit -m "feat(web): SettingsDrawer max-conversations control (default 5, 1-10)

Co-authored-by: GLM 5.2"
```

---

## Task 8: 集成测试 —— 多对话端到端

**Files:**

- Modify: `apps/server/src/__tests__/chatIntegration.test.ts`

> 复用既有 connectChatWS/drain helper（若无则在文件 helper 区补）。

- [ ] **Step 1: 加多对话 + DETACH reaper 用例**

文件末尾加：

```ts
describe('multi-conversation over single /ws/chat', () => {
  it('two conversations on one WS get distinct conversationIds', async () => {
    const ws = await connectChatWS()
    ws.send(
      JSON.stringify({ type: 'CHAT_CREATE', cwd: '', claudeSessionId: 'c-1', providerId: 'stub' }),
    )
    ws.send(
      JSON.stringify({ type: 'CHAT_CREATE', cwd: '', claudeSessionId: 'c-2', providerId: 'stub' }),
    )
    const msgs = await drain(ws, 2)
    const ids = msgs.map((m) => (m as { conversationId: string }).conversationId)
    expect(new Set(ids).size).toBe(2)
    ws.close()
  })

  it('CHAT_DETACH lets reaper destroy the conversation after 30s', async () => {
    vi.useFakeTimers()
    const ws = await connectChatWS()
    ws.send(
      JSON.stringify({
        type: 'CHAT_CREATE',
        cwd: '',
        claudeSessionId: 'c-detach',
        providerId: 'stub',
      }),
    )
    const created = await drain(ws, 1)
    const id = (created[0] as { conversationId: string }).conversationId

    ws.send(JSON.stringify({ type: 'CHAT_DETACH', conversationId: id }))
    vi.advanceTimersByTime(31_000)

    ws.send(JSON.stringify({ type: 'CHAT_ATTACH', conversationId: id }))
    const after = await drain(ws, 1)
    expect((after[0] as { type: string }).type).toBe('CHAT_ERROR')
    vi.useRealTimers()
    ws.close()
  })
})
```

> `connectChatWS()`：建真实 ws 连接（带合法 JWT）。`drain(ws, n)`：返回 Promise，收 n 条消息后 resolve。若文件已有等价 helper，复用并改名对齐。

- [ ] **Step 2: 跑集成测试**

Run: `pnpm --filter @ai-cli/server test -- chatIntegration`
Expected: PASS（含新多对话用例 + 既有用例）。

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/__tests__/chatIntegration.test.ts
git commit -m "test(chat): multi-conversation integration (distinct ids + DETACH reaper)

Co-authored-by: GLM 5.2"
```

---

## Task 9: 全量验证 + 不回归

**Files:** 全仓

- [ ] **Step 1: 跑全部测试**

Run:

```bash
pnpm --filter @ai-cli/server test
pnpm --filter @ai-cli/web test
```

Expected: 全绿。修复任何因多对话改造失败的旧测试（典型：`sessionStore.chat.test.ts`、`ChatView.test.tsx`、`MessageBubble`/`ToolCallCard`/`ChatInput`/`ModeSwitch` 若依赖单值 store）。

- [ ] **Step 2: 全仓类型检查**

Run: `pnpm -r exec tsc --noEmit`
Expected: 无错误。

- [ ] **Step 3: Lint（受 P2 #11 限制）**

Run: `pnpm --filter @ai-cli/server lint 2>&1 | head -5`、`pnpm --filter @ai-cli/web lint 2>&1 | head -5`
Expected: 若报 "couldn't find eslint.config.js"（已知 P2 #11 未迁 flat config），记录不阻断；若能跑通应无 error。

- [ ] **Step 4: 真实链路冒烟（手动）**

`pnpm dev` → 浏览器登录后：

1. NewSessionDrawer → "Claude 对话会话" 建 2 个对话
2. 对话列表切换，确认消息不串扰
3. 关闭一个，另一个正常
4. Settings → Max Conversations 调到 2，再建第 3 个 → LRU 踢最旧
5. DevTools Offline→Online → 订阅恢复

- [ ] **Step 5: README 路线图勾选**

`README.md:417` "混合对话视图"项补"+ 多对话支持"。

- [ ] **Step 6: 最终 Commit**

```bash
git add -A
git commit -m "test(web): fix legacy tests for multi-conversation store; README roadmap

Co-authored-by: GLM 5.2"
```

---

## Self-Review

**Spec 覆盖核对：**

- ✅ 服务端 CHAT_DETACH + reaper 30s → Task 1
- ✅ 前端 store 多对话集合 → Task 2
- ✅ 单 WS 多路复用 → Task 3
- ✅ P1 #9 transport 抽离 → Task 4 (ChatTransport) + Task 5 (挂载)
- ✅ NewSessionDrawer 对话列表 → Task 6
- ✅ 设置页最大对话数 → Task 7
- ✅ maxConversations 可改 + 持久化 → Task 2 (store) + Task 7 (UI)
- ✅ 关闭语义乙（DETACH + 30s reaper）→ Task 1 + Task 3
- ✅ LRU 上限 → Task 2 (closeConversation in createConversation)
- ✅ 重连批量重订阅 → Task 3 (onopen loop)
- ✅ 错误路径（崩溃隔离、重连后已销毁）→ Task 3 (handleMessage per-id) + Task 8

**类型一致性：** `ConversationMeta`（Task 0）→ store（Task 2）→ ChatView（Task 4）→ NewSessionDrawer（Task 6）签名一致。`useChatWS` 返回的 `createConversation/switchTo/closeConversation`（Task 3）与 ChatTransport 注入 store 的 ref（Task 4）名字一致。`CHAT_DETACH`（Task 0 协议）→ ChatGateway dispatch（Task 1）→ useChatWS 发送（Task 3）一致。

**占位符扫描：** 无 TBD/TODO；每个 step 含可执行代码或命令。
