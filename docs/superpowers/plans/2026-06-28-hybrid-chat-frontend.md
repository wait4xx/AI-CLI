# Hybrid Chat View — 前端实现计划 (Plan 2/2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为混合对话视图构建前端 UI —— 在 `apps/web` 中渲染归一化对话事件、提供输入与 Explore/Edit 提权切换,并接入 NewSessionDrawer 与现有 SplitPane 视图层,使 Claude 对话能在「对话视图」与「终端视图」之间切换。

**Architecture:** 纯函数 `chatReducer` 把 `ProviderEvent` 流归约为可渲染状态(turns + toolCalls + status),挂在 `sessionStore` 中。`useChatWS` 钩子管理到 `/ws/chat` 的 WS 连接(鉴权方式与终端一致:`?token=<jwt>`),把 `ChatServerMessage` 翻译成 store 动作。`ChatView` 组合 `MessageBubble` / `ToolCallCard` / `ChatInput` / `ModeSwitch`,在 `terminal-main` 面板与 `TerminalContainer` 二选一渲染(由 `conversation.viewMode` 决定)。`NewSessionDrawer` 新增「Claude 对话会话」入口。

**Tech Stack:** React 18 + TypeScript + Zustand + react-markdown(已在 deps) + remark-gfm(已在 deps) + Vitest + @testing-library/react + Tailwind + lucide-react + vaul。无新依赖。

---

## 服务端契约(Plan 1 已实现,前端必须遵守)

- WS 路由:`/ws/chat?token=<jwt>`。升级时验签;失败 close 4001(`WS_CLOSE_CODE.AUTH_FAILED`)。
- **无 CHAT_AUTH 握手** —— 连接建立后客户端直接发 `CHAT_CREATE`(新建)或 `CHAT_RECONNECT`(重连)。
- `CHAT_CREATE { cwd, claudeSessionId, providerId?, initialTier? }` → 服务端建会话并回 `CHAT_CREATED { conversationId, claudeSessionId, tier, viewMode }`。
- `CHAT_RECONNECT { conversationId }` / `CHAT_ATTACH` → 回 `CHAT_HISTORY { conversationId, messages: ChatMessage[] }`(messages 为纯文本历史,role/text/ts)。
- `CHAT_SEND { conversationId, text }` → 服务端把文本写入 claude stdin;**服务端不回显用户文本**(headless claude 输出里的 `user` 行只含 tool_result,见下)。
- `CHAT_SWITCH_VIEW` / `CHAT_ESCALATE` → 服务端广播 `CHAT_VIEW_CHANGED { conversationId, viewMode, tier }`。`Edit` 提权需 `role==='admin'`,否则回 `CHAT_ERROR`。
- `CHAT_PING` → `CHAT_PONG`。

**关键事实(决定 reducer 设计):** `ClaudeCodeProvider.parseStreamLine` 对 `assistant` 与 `user` 两类顶层行都解析 text 块并产出 `text-delta`(`apps/server/src/chat/ClaudeCodeProvider.ts:79-88`),且 `ProviderEvent.text-delta` **不带 role**。实测 headless `claude -p --output-format stream-json` 的 `user` 行只含 `tool_result` 块(工具结果回灌),不含用户文本块;初始用户提示不会在输出中回显。因此前端在发送时本地立即插入用户气泡,**reducer 内对「恰好等于刚发送的用户文本」的 text-delta 做一次 echo 抑制**,作为对任何潜在回显的防御(见 Task 1)。

---

## 文件结构

新建(`apps/web/src/`):

| 文件                                | 职责                                                                                                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/chatReducer.ts`                | 纯函数:`ChatAction` × `ChatRenderState` → `ChatRenderState`。把 ProviderEvent 归约为可渲染 turns/toolCalls/status。无 React 依赖,100% 可单测。 |
| `hooks/useChatWS.ts`                | `/ws/chat` WS 生命周期:连接/重连/鉴权失败重试/消息分发 → store 动作/send/escalate/switchView。                                                 |
| `components/chat/MessageBubble.tsx` | 单条消息渲染:assistant 用 ReactMarkdown+remarkGfm;user 用纯文本;error 用红色样式。                                                             |
| `components/chat/ToolCallCard.tsx`  | 工具调用卡片:`⚙ toolName · inputSummary → outputSnippet`,状态色(running/success/error),输出可折叠。                                            |
| `components/chat/ChatInput.tsx`     | 多行输入框 + 发送按钮;Enter 发送、Shift+Enter 换行;字节上限 256KB。                                                                            |
| `components/chat/ModeSwitch.tsx`    | Explore/Edit 档位切换(RBAC 门:Edit 仅 admin)+「切换到终端视图」按钮。                                                                          |
| `components/chat/ChatView.tsx`      | 组合层:拥有 useChatWS;渲染消息列表 + 状态指示 + 输入 + 模式切换 + 崩溃横幅。                                                                   |

修改(`apps/web/src/`):

| 文件                              | 改动                                                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store/sessionStore.ts`           | 增 `conversation` 元数据、`chat` 渲染态、chat 连接态、chat WS 函数引用,及对应 actions。                                                                                       |
| `components/SplitPane.tsx`        | `TerminalPanel`:当 `conversation?.viewMode==='chat'` 且 `panelId==='terminal-main'` 时渲染 `ChatView`,否则维持 `TerminalContainer`;并在 chat 视图下渲染「终端视图」回切入口。 |
| `components/NewSessionDrawer.tsx` | 新增「Claude 对话会话」入口按钮 → `startConversation`。                                                                                                                       |

测试(`apps/web/src/__tests__/chat/`):`chatReducer.test.ts`、`useChatWS.test.ts`、`MessageBubble.test.tsx`、`ToolCallCard.test.tsx`、`ChatInput.test.tsx`、`ModeSwitch.test.tsx`、`ChatView.test.tsx`,及 `__tests__/sessionStore.chat.test.ts`。

---

## 共享类型契约(在 `lib/chatReducer.ts` 内定义并导出,供组件复用)

```ts
import type { ProviderEvent, ChatMessage, ChatPermissionTier, ChatViewMode } from '@ai-cli/shared'

export interface ToolCallView {
  callId: string
  toolName: string
  inputSummary: string
  status: 'running' | 'success' | 'error'
  outputSnippet: string
}

export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  ts: number
  toolCalls: ToolCallView[]
  done: boolean
  error?: string
}

export interface ChatRenderState {
  turns: ChatTurn[]
  status: 'idle' | 'thinking' | 'working'
  crashed: { message: string; resumable: boolean } | null
}

export type ChatAction =
  | { type: 'user-message'; text: string }
  | { type: 'event'; event: ProviderEvent }
  | { type: 'crashed'; message: string; resumable: boolean }
  | { type: 'load-history'; messages: ChatMessage[] }
  | { type: 'reset' }

export const initialChatState: ChatRenderState = { turns: [], status: 'idle', crashed: null }
export function chatReducer(state: ChatRenderState, action: ChatAction): ChatRenderState
```

**reducer 核心规则(必须在测试中逐条覆盖):**

- `user-message`:push `{role:'user', text, ts:Date.now(), toolCalls:[], done:true}`;记 `lastUserEcho = text`(模块级私有变量)。
- `event.text-delta`:
  - 若 `lastUserEcho != null && text === lastUserEcho` 且当前无 open assistant turn(末条 turn 非 assistant-未完成)→ 视为回显:清 `lastUserEcho`,丢弃。
  - 否则:清 `lastUserEcho`;末条 turn 若为 assistant 且 `!done` → 追加 text;否则新建 assistant turn `{text, done:false}`。
- `event.tool-call-start`:清 `lastUserEcho`;确保存在 open assistant turn(无则新建);在该 turn 的 toolCalls 中按 `callId` upsert `{status:'running', outputSnippet:''}`。
- `event.tool-result`:在所有 assistant turn 中按 `callId` 找到 toolCall(从后往前),更新 `status` + `outputSnippet`。
- `event.status`:`status = state`(thinking/working/idle)。
- `event.error`:新建 assistant turn `{error:message, done:true}`。
- `event.done`:末条 assistant turn `done=true`;`status='idle'`。
- `crashed`:`crashed = {message, resumable}`(不动 turns)。
- `load-history`:把 `ChatMessage[]` 映射为 `{role, text, ts, toolCalls:[], done:true}`,替换 turns;清 `lastUserEcho`。
- `reset`:返回 `initialChatState`,清 `lastUserEcho`。

**注意:`lastUserEcho` 必须在 `initialChatState`/`reset`/`load-history` 时清空**,避免跨会话残留导致误抑制。

---

## Task 0: 计划落盘 + 分支确认

- [x] 本计划已写入 `docs/superpowers/plans/2026-06-28-hybrid-chat-frontend.md` 并提交。
- [ ] 确认在分支 `feat/hybrid-chat-server-engine` 上继续(Plan 1 的 14 个提交在位,工作树干净)。

---

## Task 1: chatReducer 纯函数 + 完整单测

**Files:** Create `apps/web/src/lib/chatReducer.ts`; Test `apps/web/src/__tests__/chat/chatReducer.test.ts`

- [ ] 先写测试(覆盖上述每条规则,含 echo 抑制、tool-result 跨 turn 查找、history 替换、reset 清 echo):
  - user-message 后 turns 末条为 user、done=true。
  - text-delta 在无 open assistant turn 时新建 assistant turn 并追加;连续 text-delta 追加到同一 turn。
  - 发送 user-message 后,收到「恰好等于该文本」的 text-delta → 被抑制(turns 不增);收到不等的 text-delta → 正常建 assistant turn 并清 echo。
  - tool-call-start 无 open turn 时先建 turn 再加 toolCall;同 callId 重复 start → upsert(不重复)。
  - tool-result 更新对应 toolCall 的 status/outputSnippet;is_error→'error'。
  - status 事件映射 thinking/working/idle。
  - error 事件 → 新增带 error 的 assistant turn。
  - done → 末条 assistant turn done=true、status idle;之后 text-delta 建新 turn。
  - crashed → crashed 字段填充。
  - load-history → turns 被替换为 history(每条 done=true)。
  - reset → 回到 initialChatState。
- [ ] `pnpm --filter @ai-cli/web test chatReducer` 确认测试失败(尚未实现)。
- [ ] 实现 `chatReducer.ts`(完整契约 + 规则)。
- [ ] 测试通过。
- [ ] 提交:`feat(chat-web): add pure chatReducer for event→render mapping`。

---

## Task 2: sessionStore 扩展(conversation 元数据 + chat 渲染态 + WS 引用)

**Files:** Modify `apps/web/src/store/sessionStore.ts`; Test `apps/web/src/__tests__/sessionStore.chat.test.ts`

- [ ] 新增 state 字段(并加入 `initialState` 与 `reset`):
  - `conversation: { conversationId: string|null; claudeSessionId: string; cwd: string; viewMode: ChatViewMode; tier: ChatPermissionTier } | null`
  - `chat: ChatRenderState`(初始 `initialChatState`)
  - `chatConnected: boolean`、`chatConnectionPhase: 'DISCONNECTED'|'CONNECTING'|'CONNECTED'`
  - WS 函数引用:`sendChatMessage:((t:string)=>void)|null`、`chatEscalate:((t:ChatPermissionTier)=>void)|null`、`chatSwitchView:((m:ChatViewMode)=>void)|null`、`chatReconnect:(()=>void)|null`
- [ ] 新增 actions(并在 `reset` 中重置 conversation/chat/chatConnected):
  - `startConversation(claudeSessionId: string, cwd: string)`:`conversation = { conversationId:null, claudeSessionId, cwd, viewMode:'chat', tier:'Explore' }`;`chat = initialChatState`。
  - `endConversation()`:`conversation=null; chat=initialChatState; chatConnected=false`。
  - `setConversationId(id)`、`setChatViewMode(m)`、`setChatTier(t)`、`setChatConnected(phase)`。
  - `applyChatAction(action: ChatAction)`:`set({ chat: chatReducer(get().chat, action) })`。
- [ ] **持久化守卫**:确认 `partialize` 不持久化 `conversation`/`chat`/chat WS 引用(它们是运行时态)。
- [ ] 测试:startConversation 设置默认 Explore/chat 且清 chat;applyChatAction 正确驱动 reducer;setChatViewMode/setChatTier 更新 conversation;endConversation 清空;reset 后 conversation=null。
- [ ] `pnpm --filter @ai-cli/web test sessionStore.chat` 通过。
- [ ] 提交:`feat(chat-web): extend sessionStore with conversation + chat render state`。

---

## Task 3: useChatWS 钩子

**Files:** Create `apps/web/src/hooks/useChatWS.ts`; Test `apps/web/src/__tests__/chat/useChatWS.test.ts`

- [ ] 接口:
  ```ts
  interface UseChatWS {
    connect: (claudeSessionId: string, cwd: string, existingConversationId?: string | null) => void
    disconnect: () => void
    sendMessage: (text: string) => void
    escalate: (tier: ChatPermissionTier) => void
    switchView: (mode: ChatViewMode) => void
    reconnect: () => void
    isConnected: boolean
  }
  export function useChatWS(
    getAccessToken: () => string | null,
    onAuthFailure: () => void,
  ): UseChatWS
  ```
- [ ] 行为(镜像 `useDualChannelWS` 的鉴权/重连骨架,但单通道):
  - WS URL:`${WS_BASE}/ws/chat?token=${encodeURIComponent(token)}`(`WS_BASE` 同 `useDualChannelWS`)。
  - `onopen`:若 `existingConversationId` → 发 `CHAT_RECONNECT`;否则发 `CHAT_CREATE { cwd, claudeSessionId, providerId:'claude-code', initialTier:'Explore' }`。置 phase CONNECTING。
  - `onmessage`:JSON.parse → 按 `type` 分发(见服务端契约):`CHAT_CREATED`→setConversationId+setChatViewMode+setChatTier+phase CONNECTED;`CHAT_HISTORY`→applyChatAction(load-history);`CHAT_EVENT`→applyChatAction(event);`CHAT_VIEW_CHANGED`→setChatViewMode+setChatTier;`CHAT_CRASHED`→applyChatAction(crashed);`CHAT_ERROR`→console.error(+可选 toast);`CHAT_PONG`→忽略。
  - `onclose`:code 4001→onAuthFailure;其他→phase DISCONNECTED。
  - `sendMessage`:本地 `applyChatAction({type:'user-message', text})` + 发 `CHAT_SEND { conversationId: conversation.conversationId, text }`;conversationId 为空时丢弃并 warn。字节上限 256KB(同 ChatSession 服务端约束),超限 warn 拒发。
  - `escalate`/`switchView`:发对应消息(需 conversationId)。
  - `reconnect`:关当前 socket,用上次 connect 的参数重连。
  - 消息类型校验集合 `CHAT_MSG_TYPES`(安全修复 C7 同款)。
- [ ] 测试(用 fake WebSocket:构造一个类,实例化时记录 url、暴露 send/onopen/onmessage/onclose/close/readyState;在 `vi.stubGlobal('WebSocket', ...)` 下驱动):connect→CHAT_CREATE 发出;CHAT_CREATED→setConversationId 被调用;CHAT_EVENT→applyChatAction(event) 被调用;CHAT_VIEW_CHANGED→setChatViewMode/setChatTier;CHAT_CRASHED→applyChatAction(crashed);sendMessage→本地 user-message + CHAT_SEND;onclose 4001→onAuthFailure;existingConversationId→发 CHAT_RECONNECT。
- [ ] 通过。提交:`feat(chat-web): add useChatWS hook for /ws/chat lifecycle`。

---

## Task 4: MessageBubble

**Files:** Create `apps/web/src/components/chat/MessageBubble.tsx`; Test `apps/web/src/__tests__/chat/MessageBubble.test.tsx`

- [ ] Props:`{ role:'user'|'assistant'; text:string; error?:string; ui: ReturnType<typeof useUiTheme> }`。
- [ ] assistant(role==='assistant'):若 `error` → 红色边框气泡显示 error 文本;否则 ReactMarkdown+remarkGfm 渲染 `text`(复用 `CodeEditor.tsx:1390-1447` 的 Tailwind `[&_...]` 排版类,简化 components 映射)。
- [ ] user:纯文本(whitespace-pre-wrap),右对齐气泡、蓝色背景。
- [ ] 布局:assistant 左对齐,user 右对齐(沿用现有暗色 token)。
- [ ] 测试:assistant 渲染 markdown(含 `**bold**`→`<strong>`);user 渲染纯文本且不解析 markdown;error 渲染错误文本与红色样式;两种 role 快照可断言 className 差异。
- [ ] 通过。提交:`feat(chat-web): add MessageBubble with markdown rendering`。

---

## Task 5: ToolCallCard

**Files:** Create `apps/web/src/components/chat/ToolCallCard.tsx`; Test `apps/web/src/__tests__/chat/ToolCallCard.test.tsx`

- [ ] Props:`{ call: ToolCallView; ui }`。
- [ ] 渲染:`⚙ {toolName}` 标题 + inputSummary(等宽小字)+ 状态点(running=蓝脉冲/success=绿/error=红)+ 折叠区展示 outputSnippet(点击展开)。running 时显示「运行中…」。
- [ ] 测试:running 显示工具名与运行中;success 显示 outputSnippet 且状态色绿;error 状态色红且展示 snippet;点击展开/折叠 outputSnippet。
- [ ] 通过。提交:`feat(chat-web): add ToolCallCard for structured tool display`。

---

## Task 6: ChatInput

**Files:** Create `apps/web/src/components/chat/ChatInput.tsx`; Test `apps/web/src/__tests__/chat/ChatInput.test.tsx`

- [ ] Props:`{ onSend:(text:string)=>void; disabled?:boolean; ui }`。
- [ ] 受控 textarea;Enter 发送并清空、Shift+Enter 换行;发送按钮;空文本禁用发送;字节上限 256KB,超限禁用发送并提示。
- [ ] 测试:输入文本 Enter→onSend(text) 且清空;Shift+Enter→换行不发送;空→不发送;disabled 时按钮禁用;超长文本→禁用。
- [ ] 通过。提交:`feat(chat-web): add ChatInput with multiline + send`。

---

## Task 7: ModeSwitch

**Files:** Create `apps/web/src/components/chat/ModeSwitch.tsx`; Test `apps/web/src/__tests__/chat/ModeSwitch.test.tsx`

- [ ] Props:`{ tier:ChatPermissionTier; role:'admin'|'user'; onEscalate:(t:ChatPermissionTier)=>void; onSwitchView:(m:ChatViewMode)=>void; ui }`。
- [ ] Explore/Edit 分段切换:Edit 仅 `role==='admin'` 可点(admin 点击→onEscalate('Edit');Explore 点击→onEscalate('Explore'));非 admin 的 Edit 显示禁用 + tooltip「需要管理员权限」。当前 tier 高亮。
- [ ] 「切换到终端视图」按钮→`onSwitchView('terminal')`。
- [ ] 测试:admin 可切到 Edit 且回调正确;admin 切回 Explore;非 admin 的 Edit 按钮禁用且点击不触发 onEscalate;切终端按钮触发 onSwitchView('terminal');当前 tier 高亮。
- [ ] 通过。提交:`feat(chat-web): add ModeSwitch with RBAC escalation gate`。

---

## Task 8: ChatView 组合层

**Files:** Create `apps/web/src/components/chat/ChatView.tsx`; Test `apps/web/src/__tests__/chat/ChatView.test.tsx`

- [ ] 从 store 读 `conversation`、`chat`、`chatConnected`、`currentUser`。用 `useChatWS`(`useAuth` 提供 token)。
- [ ] 挂载时若 `conversation` 存在 → `connect(claudeSessionId, cwd, conversationId)`;卸载时 `disconnect()`。把 sendMessage/escalate/switchView/reconnect 写入 store 的 chat WS 引用(供 TerminalView 回切与外部触发)。
- [ ] 渲染:
  - 顶部:ModeSwitch(传 tier、role)。
  - 中部:消息列表(turns → MessageBubble;turn.toolCalls → ToolCallCard 列在其 assistant 气泡下);自动滚动到底部(新消息/turns 变化时)。status 为 working/thinking 时显示状态指示。
  - 崩溃横幅:`chat.crashed` 时显示 message + 「重新连接」按钮(reconnect→`chatReconnect`)。
  - 底部:ChatInput(onSend→sendMessage)。
- [ ] 测试(mock store + fake WS,避免真实网络):挂载后触发 CHAT_CREATE;收到 text-delta→渲染消息;发送→显示用户气泡;ModeSwitch 切换→store 更新;崩溃横幅显示且点击重连。使用 `useSessionStore.getState().reset()` 在 beforeEach。
- [ ] 通过。提交:`feat(chat-web): add ChatView composing message list + input + modes`。

---

## Task 9: SplitPane 接入(对话视图 ↔ 终端视图二选一)

**Files:** Modify `apps/web/src/components/SplitPane.tsx`

- [ ] `TerminalPanel`(`panelId==='terminal-main'`):读 `conversation?.viewMode`。若 `==='chat'` → 渲染 `<ChatView/>`(包 `Suspense`,与 TerminalContainer 同级 lazy);否则维持现有 `<TerminalContainer/>`。
- [ ] 在终端视图下若 conversation 仍存在,渲染一个轻量「返回对话」按钮(调 `chatSwitchView('chat')`)。
- [ ] 不回归:`pnpm --filter @ai-cli/web test` 全过。
- [ ] 提交:`feat(chat-web): render ChatView in terminal-main when viewMode=chat`。

---

## Task 10: NewSessionDrawer 接入「Claude 对话会话」入口

**Files:** Modify `apps/web/src/components/NewSessionDrawer.tsx`

- [ ] 在「New Session」按钮下新增「Claude 对话会话」入口(MessageSquare 图标)。点击:`const claudeSessionId = crypto.randomUUID(); useSessionStore.getState().startConversation(claudeSessionId, cwd||''); onOpenChange(false)`。
- [ ] 复用现有 cwd 输入(为对话会话提供工作目录)。
- [ ] 提交:`feat(chat-web): add Claude conversation entry in NewSessionDrawer`。

---

## Task 11: 全量验证 + 最终审查

- [ ] `pnpm --filter @ai-cli/web test` 全绿(含新 chat 测试 + 现有不回归)。
- [ ] `pnpm --filter @ai-cli/web build` 通过(`tsc --noEmit` + vite build)。
- [ ] `pnpm --filter @ai-cli/web lint` 0 error。
- [ ] 服务端 `pnpm --filter @ai-cli/server test` 仍全绿(未改服务端)。
- [ ] 最终代码审查:reducer 纯度、WS 鉴权/重连、RBAC 门、echo 抑制、内存泄漏(disconnect 清监听)、类型一致。
- [ ] 用 `superpowers:finishing-a-development-branch` 收尾。

---

## 已知范围边界(本轮不做,记录在案)

- **终端视图的 claude 续接**:切到终端视图时显示的是常规终端会话;真正让终端侧 `claude --resume <claudeSessionId>` 需要 CLIAdapter/SessionManager 改动(spec 明确本轮不动),作为后续增强。
- **CHAT_AUTH** 在协议中定义但服务端 gateway 不处理;客户端不发(直接 CHAT_CREATE/RECONNECT)。
- **thinking 块**→`status:thinking` 的增强(Plan 1 终审延后项 #4)未做;当前 thinking tokens 映射为 working。
- 跨设备观察/分享对话(Tier 4)、文件上传(Tier 1)不在本轮。
