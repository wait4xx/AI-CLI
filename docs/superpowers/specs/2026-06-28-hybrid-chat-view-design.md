# 混合对话视图(Hybrid Chat View)设计文档

> 日期: 2026-06-28
> 范围: 竞品分析报告(`docs/competitor-analysis.md`)Tier 3 第 8 项
> 状态: 已通过 brainstorming,待写实现计划

## 1. 背景与目标

AI-CLI-Mobile 是「在手机/浏览器远程运行 Claude Code 等终端工具的 Web IDE」,现有终端路线(PTY + tmux + xterm.js)工程基础最好(TS/测试/CI/Docker/多用户/安全),但**缺对话视图**。竞品中: remote-cc 只有终端、cc-remote 只有对话、Orca 是重型桌面。**同时提供「终端保真」和「对话视图」是四个项目里的唯一空位。**

本设计的目标: 让一条 Claude Code 对话能在**终端视图**和**对话视图**之间自由切换,且对话视图既**有意义**(能读/搜/分析/回答,非纯只读)又**安全**(改文件需显式提权,受项目 RBAC + 审计管控)。

### 非目标(本轮不做)

- 第 9 项「多 provider/profile 系统」—— 独立后续轮次
- Codex/Aider/Gemini 等 ChatProvider 的**实现**(架构预留接口,本轮只实现 ClaudeCodeProvider)
- ChatView 与 TerminalContainer 的分屏并排(本轮单视图切换;项目已有 SplitPane,后续可加)
- iOS/Android 原生推送(Tier 4)

---

## 2. 已验证的技术地基(实测,非推测)

设计建立在以下经本机实测的事实上(`claude` v2.1.183)。**这些是承重假设,实现时不可违反。**

### 2.1 跨视图续接机制

- Claude Code 把对话 transcript 持久化在磁盘(`~/.claude/projects/`),按 session-id 索引。
- `--session-id <uuid>` 可**固定**对话 ID(无论交互式还是 headless 启动,都写到同一条 transcript)。
- `--resume <id>` 从磁盘恢复上下文续接 —— **交互式 TUI 和 headless 两种模式都支持**。
- 因此**同一条对话线程可以在终端视图(交互式)和对话视图(headless)之间切换续接**。这是本设计的地基。
- 参考实现 cc-remote 已验证此路径(`~/Code/Github/cc-remote/server/src/claude-session.js`)。

### 2.2 权限模式矩阵(headless `claude -p` 实测)

| `--permission-mode`                       | headless 行为                                         | 可用性            |
| ----------------------------------------- | ----------------------------------------------------- | ----------------- |
| `default`                                 | **死等挂起**(等永不来的 TTY 交互式审批,exit 124 超时) | ❌ 永不向用户暴露 |
| `plan`                                    | **干净完成(exit 0)**,只读探索,可自由 Read/Grep/分析   | ✅ Explore 档     |
| `acceptEdits`                             | **干净完成(exit 0)**,自动批准文件编辑                 | ✅ Edit 档        |
| `bypassPermissions`                       | 干净完成,全开                                         | ⚠️ 危险,不用      |
| `--allowedTools Read,Glob,Grep` + default | **挂起**(被拒 Write 后转而尝试 Bash,又挂)             | ❌                |

**结论: headless 下唯一干净又安全的模式是 `plan`(只读);唯一干净的执行模式是 `acceptEdits`。headless 没有可用的「逐次交互式审批」协议** —— default 模式既不批准也不拒绝,就是死等,且 stdout 上**没有**可解析的权限请求事件(cc-remote 不做交互式审批因此,非偷懒)。

### 2.3 已知坑(cc-remote 已遇到,需处理)

- **`--resume` 查不到对话**: exit 1 + "No conversation found"。需捕获并降级为新会话。
- **model 被钉住**: `--resume` 会沿用创建对话时的 model。需启动时强制注入当前 model(参考 cc-remote `buildAgentEnv`)。

---

## 3. 架构: Conversation 抽象(γ 增量)

核心决策: 引入 **`Conversation` 作为主体实体**,终端/对话是它的两个视图层。这是因为「同一条对话可切换视图」使**对话成为天然的主体** —— 它在切换中持久(session-id/cwd/历史不变),视图是瞬态(切换时进程拆掉、按新模式重建)。

**增量落地(控制风险):** Conversation 抽象**只服务混合 Claude 会话**。现有 Aider/Shell/非混合终端会话**保持现状、完全不动**,不强制塞进此抽象。

```
Conversation (新) ── 持有: claudeSessionId / cwd / viewMode / permissionTier / providerId / messageLog
   │                    职责: 视图切换协调、提权闸门、能力协商
   │
   ├── TerminalView  (现有: PTY + tmux + xterm.js; SessionManager / CLIAdapter 不动)
   │     启动: claude --session-id <id>            (交互式 TUI, 现有逐次审批)
   │
   └── ChatView      (新: headless claude -p stream-json)
         启动: claude -p --session-id <id> --output-format stream-json
               --input-format stream-json --permission-mode <tier> --verbose
         经 ChatProvider 接口归一化事件
```

### 三档权限(视图与档位正交)

- **Explore(`plan`)** —— 默认。Claude 自由读/搜/分析/回答/提方案。100% 安全、干净跑完。**这一档已使对话视图有意义。**
- **Edit(`acceptEdits`)** —— 显式提权。Claude 可改文件。提权是项目控制的闸门: ① 用户显式动作 ② RBAC 校验(仅授权角色)③ 审计日志。
- **Terminal(交互式 TUI)** —— 切到终端视图。对含 Bash 在内的每个动作逐次审批(现有 QuickActionsPanel)。

三档挂在**同一条对话线程**上(`--session-id`/`--resume` 续接): **探索(问)→ 编辑(改)→ 终端(精细控制)**。

---

## 4. 组件

### 4.1 服务端(新增;均不动现有 `SessionManager` / `WSGateway` / `CLIAdapter`)

| 组件                 | 职责                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Conversation`       | 主体实体。持有 claudeSessionId/cwd/viewMode/permissionTier/providerId/messageLog;协调视图切换与提权;per-provider 能力协商             |
| `ChatSession`        | 管理 headless `claude` 子进程: spawn / stdin 写 NDJSON / stdout stream-json 解析 / 生命周期 / exit 监听 / 背压                        |
| `ChatProvider` 接口  | `spawnArgs()` / `sendMessage(stdin, text)` / `parseStreamLine(line)` → 归一化事件 / `availablePermissionTiers()` / `supportsResume()` |
| `ClaudeCodeProvider` | 实现 `ChatProvider`,封装 §2.2 验证的 plan/acceptEdits 行为                                                                            |
| `ChatGateway`        | 对话事件的 WS 传输(新建独立 gateway,或扩展 WSGateway 加 chat 通道 —— 实现阶段定)                                                      |

### 4.2 前端(新增;不动现有 `TerminalContainer`)

| 组件                   | 职责                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `ChatView`             | 消息列表 + 输入框 + 工具卡。与 TerminalContainer 同区域**二选一渲染**(由 viewMode 决定)   |
| `MessageBubble`        | `react-markdown`(^10.1.0)+ `remark-gfm`(^4.0.1)渲染 —— 已是现有依赖,`CodeEditor.tsx` 在用 |
| `ToolCallCard`         | 结构化展示 `⚙ tool · detail → output`                                                     |
| `ChatInput`            | 多行输入 + 发送(写 NDJSON);预留图片/文件入口(对接 Tier 1 上传)                            |
| `ModeSwitch`           | Explore/Edit/Terminal 三档切换 UI + 提权闸门(RBAC + 审计)                                 |
| `useSessionStore` 扩展 | 增加 conversation / viewMode / permissionTier 状态(现有 752 行 store 增量扩展)            |

### 4.3 ChatProvider 接口(草案)

```ts
interface ChatProvider {
  readonly id: string // 'claude-code' | 'codex' | ...
  spawnArgs(opts: SpawnOpts): string[] // ['claude','-p','--session-id',id,'--output-format','stream-json',...]
  sendMessage(stdin: WritableStream, text: string): void // NDJSON 写法, 各家不同
  parseStreamLine(line: string): ChatEvent[] // CLI 原始行 → 归一化事件
  availablePermissionTiers(): PermissionTier[] // claude=[Explore,Edit,Terminal]; aider 可能=[Edit,Terminal]
  supportsResume(): boolean // claude=true; 各家不同
}
```

---

## 5. 数据流

1. **建会话:** `NewSessionDrawer` 选 Claude + 初始视图 → 生成 `claudeSessionId`(UUID)→ 创建 Conversation → 按视图启动进程(终端: `claude --session-id <id>` 交互式; 对话: `claude -p --session-id <id> --output-format stream-json --permission-mode plan --verbose`)
2. **发消息:** `ChatInput` → WS → `ChatSession.stdin` 写 `{type:'user',message:{role:'user',content:[{type:'text',text}]}}\n` → stream-json 归一化 → WS 推前端 → 渲染气泡/工具卡
3. **切视图:** 点 ModeSwitch → Conversation 存 messageLog → 杀当前进程 → `--resume <id>` + 新模式参数启动另一视图 → 同一对话续接
4. **提权(Explore→Edit):** 点提权 → RBAC 校验 + 审计 → 重启 headless 进程为 `acceptEdits`(`--session-id` 续接)

---

## 6. 归一化对话事件协议(通用,各家映射)

`ChatProvider.parseStreamLine` 把各家 CLI 输出翻译成这套统一事件。前端只认这套协议,不耦合具体 CLI:

| 事件              | 载荷                                | 渲染                            |
| ----------------- | ----------------------------------- | ------------------------------- |
| `text-delta`      | `{text}`                            | 追加到当前 assistant 气泡(流式) |
| `tool-call-start` | `{toolName, inputSummary}`          | 工具卡(进行中)                  |
| `tool-result`     | `{toolName, status, outputSnippet}` | 更新工具卡                      |
| `status`          | `{state: thinking\|working\|idle}`  | 状态指示                        |
| `error`           | `{message}`                         | 错误气泡                        |
| `done`            | —                                   | 回合结束                        |

**ClaudeCodeProvider 映射:** stream-json 的 `content_block_delta`→`text-delta`,`tool_use`→`tool-call-start`,`tool_result`→`tool-result`,`system`(thinking_tokens/init)→`status`。其它 provider 实现时按各自输出映射,能力不足字段降级(如 Aider 无 tool 事件 → 只产 `text-delta`)。

---

## 7. Per-provider 能力协商

Conversation 启动时查 provider 能力,据此约束 UI 与行为:

| 能力                       | Claude                  | Aider(预期)     | 说明                                                       |
| -------------------------- | ----------------------- | --------------- | ---------------------------------------------------------- |
| `supportsResume`           | ✓                       | ✗               | Aider 切换不保留 CLI 历史,只能靠我方 messageLog 显示旧消息 |
| `availablePermissionTiers` | [Explore,Edit,Terminal] | [Edit,Terminal] | Aider 无 plan 等价物                                       |
| `toolEventRichness`        | full                    | text-only       | Aider 工具卡降级为纯文本                                   |

---

## 8. 错误处理

- **`--resume` 失败(exit 1 / "No conversation found"):** 捕获 → 降级为新会话 + 前端提示「历史未找到,已开始新对话」(参考 cc-remote `_noConvoSeen`)
- **model 钉住:** 启动时强制注入当前 model(参考 cc-remote `buildAgentEnv`)
- **进程崩溃:** `ChatSession` 监听 exit → 通知前端 → 提供「重启续接」按钮(`--resume`)
- **模式切换竞态:** 切换加锁,切换中的输入排队 flush
- **default 模式挂起:** 档位选择**永不包含 default**,仅 plan / acceptEdits / (终端交互式)
- **stdin 背压:** 复用现有 1MB 背压策略
- **stdin 关闭后写:** 检查 `writable`,拒绝并提示

---

## 9. 测试策略

- **Provider 解析器单测:** `ClaudeCodeProvider.parseStreamLine` 喂**真实 stream-json 样本**(把 §2 实测捕获的事件存为 fixture)→ 断言归一化事件正确
- **权限模式矩阵文档化 fixture:** plan=clean / acceptEdits=clean / default=hang —— 作为回归守护(注释说明 default 挂起是 CLI 行为,非我方 bug)
- **Conversation 生命周期集成测:** 建 → 发消息 → 切视图 → 提权 → 续接(用 stub provider 避免真实 API 消耗)
- **不回归:** 现有 22 个测试全过(TerminalContainer/SessionManager/CLIAdapter 未改)

---

## 10. 关键设计决策记录

| 决策     | 选择                                 | 理由                                                                    |
| -------- | ------------------------------------ | ----------------------------------------------------------------------- |
| 共存模型 | B(可切换视图, --resume 续接)         | 唯一让「终端+对话都给」成立的方案;A/B/C 三选                            |
| 安全模型 | 三档(Explore/Edit/Terminal)          | default 挂起不可用;plan 干净安全使对话有意义;acceptEdits 显式提权保安全 |
| 架构集成 | γ 增量(Conversation 抽象,仅混合会话) | 切换需求使对话成主体;增量避免重写现有终端                               |
| Provider | 可插拔接口 + 本轮只实现 Claude       | 满足「支持多工具」又不投机写未验证代码                                  |
| 视图布局 | 同区域二选一(本轮),分屏并排(后续)    | 最简;复用现有 SplitPane 做后续                                          |
| 语言     | 全栈 TypeScript                      | 与现有一致                                                              |

---

## 11. 实现顺序提示(供 writing-plans 细化)

1. 服务端 `ChatProvider` 接口 + `ClaudeCodeProvider`(用 §2 fixture 驱动 TDD)
2. 服务端 `ChatSession`(spawn/stdin/stdout 解析/生命周期)
3. 服务端 `Conversation`(切换/提权/能力协商)+ `ChatGateway`(WS)
4. 前端归一化事件 → `MessageBubble`/`ToolCallCard` 渲染
5. 前端 `ChatView` + `ChatInput` + `ModeSwitch`
6. `NewSessionDrawer` 接入「Claude 对话会话」入口
7. `useSessionStore` 扩展 + 视图切换联调
8. 错误处理(resume 失败/model 钉住/崩溃重启)
9. 集成测试 + 现有测试不回归验证

---

## 附: 验证命令(实现后自查)

```bash
# ClaudeCodeProvider 解析真实 stream-json
# (用 spec §2 已捕获的样本,或重新捕获)

# 确认现有终端未受影响
pnpm test

# 端到端: 建对话会话 → 发消息 → 切终端 → 切回 → 提权 → 续接
```
