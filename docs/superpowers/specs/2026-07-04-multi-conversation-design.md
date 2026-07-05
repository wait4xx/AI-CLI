# 多对话支持（Multi-Conversation）设计

## Context

审查报告（`~/Code/fix-reports/AI-CLI-Mobile/2026-06-28-full-project-audit.md`）P1 #10 指出：chat 侧单活跃对话——前端 store 只有一个全局 `conversation` 槽 + 全局 `chat` 渲染态，与终端侧多会话不对称。本设计将对话提升为"独立集合"，支持并发多个 Claude 对话，切换体验与终端多会话对齐。

**关键洞察**：对话与终端在当前实现下是两个独立的子系统（进程、状态、生命周期互不影响；审查报告 P1 #5 证实终端视图未真正续接对话的 claude session）。因此对话应做成独立资源，而非绑死终端面板。

## 目标

- 前端支持并发多个 Claude 对话，独立切换、独立渲染态
- 对话作为独立资源（不绑终端面板），通过 `NewSessionDrawer` 的对话列表切换
- 单 WS 连接多路复用所有对话（移动端弱网友好）
- 顺带解决审查报告 P1 #9（WS 生命周期与 `ChatView` 挂载解耦）

## 非目标

- 对话标题用首条消息摘要（本轮用 `claudeSessionId` 前缀）
- 关闭撤销（30s 内恢复已关闭对话）
- 对话持久化到磁盘（刷新即空，进程会被 reaper 回收）
- P1 #5 终端视图真正续接对话（独立决策，本轮不动）
- 审查报告 7.4 的 HTTP 回退 / Claude 历史恢复（下一个功能）

## 设计决策

| 决策         | 选择                                            | 理由                                                                             |
| ------------ | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| 对话组织模型 | B-Drawer 轻量版：对话独立集合 + Drawer 列表切换 | 对话与终端本质独立；Drawer 列表不增加底部 tab 行，UI 增量小                      |
| WS 连接策略  | 单 WS 多路复用                                  | 服务端 `attach` 已支持一 WS 订阅多对话；移动端弱网友好；与未来 HTTP 回退模型一致 |
| 关闭语义     | 乙：移出列表 + 延迟回收（reaper 30s）           | 给误操作留窗口；进程不长期占用                                                   |
| 活跃对话上限 | 默认 5，设置页可改（1–10）                      | headless claude 进程重于 tmux session，比终端侧 10 更紧                          |

## 现状

- 服务端 `ConversationManager` 已是 `Map<conversationId, Conversation>`，支持并发多对话 —— **无需改**
- 服务端 `ChatGateway.attach` 已允许一个 WS 订阅多对话（`subscribers: Map<conversationId, Set<WebSocket>>`）—— **结构不动**
- 服务端 reaper：subscribers set 空 → 60s 销毁 —— TTL 改 30s
- 前端 `sessionStore.conversation: Conversation | null` 单全局槽 —— **重构为集合**
- 前端 `sessionStore.chat: ChatRenderState` 单全局渲染态 —— **重构为 Record**
- 前端 `useChatWS` 单对话连接 —— **重构为多路复用**
- `Conversation.panelId` 字段 —— 降级为"上次显示面板"提示，不做组织依据

## 架构

### 服务端

`apps/server/src/chat/ChatGateway.ts`：

- 新增 `CHAT_DETACH` 分支：从 `subscribers[conversationId]` 移除该 ws → set 空 → 触发现有 reaper
- `CHAT_IDLE_TTL_MS`：`60_000` → `30_000`

`packages/shared`（协议）：

- `ChatClientMessage` 加 `{ type: 'CHAT_DETACH'; conversationId: string }`

### 前端 store

`apps/web/src/store/sessionStore.ts`：

```ts
// 新增
conversations: ConversationMeta[]
chats: Record<string, ChatRenderState>           // conversationId → 渲染态
activeConversationId: string | null
subscribedConversationIds: string[]               // 已通过 WS 订阅的（幂等 ATTACH）
maxConversations: number                          // 默认 5，持久化

// 废弃（由上取代）
conversation: Conversation | null
chat: ChatRenderState
```

`ConversationMeta`（放 `packages/shared` 前后端复用）：

```ts
interface ConversationMeta {
  conversationId: string
  claudeSessionId: string
  cwd: string
  viewMode: ChatViewMode
  tier: ChatPermissionTier
  status: 'connecting' | 'active' | 'crashed'
  lastActivity: number
}
```

新增/改造的 store actions：

- `createConversation(cwd)`：检查 `maxConversations`，超限 LRU 关闭最旧 → 生成 `claudeSessionId` → 占位加入 `conversations[]`（status=`connecting`）
- `switchTo(conversationId)`：设 `activeConversationId`（WS 订阅由 `useChatWS.ensureSubscribed` 处理）
- `closeConversation(conversationId)`：从 `conversations[]` / `chats{}` / `subscribedConversationIds` 移除；若是 active 则切到下一个（或 null）
- `setConversationStatus(id, status)`
- `applyChatAction(conversationId, action)`：按 `conversationId` 路由到 `chats[id]`
- `setMaxConversations(n)`

`partialize` 加 `maxConversations`（持久化）。

### 前端 WS

`apps/web/src/hooks/useChatWS.ts`（中改 + 抽离 transport 层解决 P1 #9）：

- 挂载层级提升到 App/SplitPane 级（WS 生命周期独立于 `ChatView` 是否渲染）—— **落地 P1 #9**
- `ensureSubscribed(conversationId)`：未订阅则发 `CHAT_RECONNECT`；收 `CHAT_HISTORY` 填 `chats[id]` + 加入 `subscribedConversationIds`；已订阅幂等 no-op
- `switchTo(id)`：`ensureSubscribed(id)` + `store.switchTo(id)`
- `closeConversation(id)`：发 `CHAT_DETACH` + `store.closeConversation(id)`
- `createConversation(cwd)`：LRU 检查（超 `maxConversations` 关闭最旧）→ 发 `CHAT_CREATE` + `store.createConversation(cwd)`
- `handleMessage`：按 `event.conversationId` 分发到 `chats[id]` 对应 slice
- 重连恢复：连上后对 `subscribedConversationIds` 全部重新 `ensureSubscribed`，`activeConversationId` 优先

### 前端 UI

`apps/web/src/components/NewSessionDrawer.tsx`：

- 加"对话列表"区：列出 `conversations[]`，每项 = `claudeSessionId` 前 8 位 + tier 标签（Explore/Edit）+ 状态点（绿 active / 黄 connecting / 红 crashed）+ 关闭 ×
- 点击 = `switchTo`；× = `closeConversation`；active 项高亮
- 空状态提示"还没有对话"

`apps/web/src/components/ChatView.tsx`：

- 从单全局 `chat` 改为 selector 订阅 `chats[activeConversationId]`
- 切对话只换数据源，不重挂载

设置页：

- 加"最大对话数"输入（1–10），绑 `maxConversations`

## 数据流

### 切对话②

1. `useChatWS.switchTo(②)`
2. `ensureSubscribed(②)`：未订阅 → 发 `CHAT_RECONNECT` → 服务端 `attach` + 回 `CHAT_HISTORY` → 填 `chats[②]` + 加入 `subscribedConversationIds`
3. `store.switchTo(②)`：设 `activeConversationId = ②`
4. `ChatView` selector 切到 `chats[②]`（已订阅的对话 slice 在后台持续更新，切回即最新）

### 关闭对话③

1. `useChatWS.closeConversation(③)`：发 `CHAT_DETACH`
2. `store.closeConversation(③)`：立即从列表 / chats / 订阅集合移除；若 ③ 是 active 切下一个
3. 服务端收到 `DETACH` → `subscribers[③].delete(ws)` → set 空 → 30s reaper 销毁进程

### 创建对话（超上限）

1. `useChatWS.createConversation(cwd)`
2. `conversations.length >= maxConversations` → 选 `lastActivity` 最旧的 → `closeConversation(最旧)`
3. 生成 `claudeSessionId` → 发 `CHAT_CREATE` → 占位加入 `conversations[]`（status=`connecting`）
4. 收 `CHAT_CREATED` → status=`active`

### WS 断线重连

1. 指数退避重连（现有逻辑）
2. 连上后：对 `subscribedConversationIds` 全部 `ensureSubscribed`，`activeConversationId` 优先
3. 若某对话已被 reaper 销毁 → `CHAT_RECONNECT` 返回 `conversation not found` → 从列表移除（标记"已过期"）

## 错误处理

- **单对话崩溃（`CHAT_CRASHED`）**：只标该 slice `status='crashed'`，其他对话不受影响；列表项标红 + 横幅"重新连接"（发 `CHAT_RECONNECT`，用 `claudeSessionId` resume）
- **创建失败（`CHAT_ERROR`，cwd 越界 / provider 错）**：移除占位项 + toast 错误
- **重连后对话已销毁**：前端清理该对话 + 可选"重新创建"
- **WS 全局断线**：所有对话显示"重连中"，重连后批量恢复订阅

## 测试策略

- **store 单测**：创建 / 切换 / 关闭 / LRU 超限、按 `conversationId` 路由事件、`maxConversations` 持久化
- **useChatWS 单测**（改造现有）：`ensureSubscribed` 幂等、按 id 分发、`DETACH` 发送、重连批量重订阅、LRU 关闭最旧
- **ChatGateway 单测**：`CHAT_DETACH` 入口触发 reaper、一 WS 订阅多对话不串扰
- **集成测试**（扩展 `chatIntegration.test.ts`）：真实链路建 2 对话 → 切换 → 各发消息不串扰 → 关闭一个不影响另一个
- **错误路径**：重连后对话已被 reaper 销毁 → 前端正确清理；创建超上限 → LRU 触发

## 验证方式

- `pnpm --filter @ai-cli/server test` 全绿
- `pnpm --filter @ai-cli/web test` 全绿
- 真实链路冒烟：开 2 对话切换互不串扰、关闭一个另一个正常、超上限 LRU 触发、断线重连后订阅恢复

## 范围边界

本轮不做：对话标题消息摘要、关闭撤销、对话持久化到磁盘、P1 #5 终端续接、HTTP 回退 / 历史恢复。
