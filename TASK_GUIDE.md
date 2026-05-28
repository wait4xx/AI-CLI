# AI-CLI-Mobile 项目任务指南

> 本文档基于《AI-CLI-Mobile 企业级技术架构白皮书》及工程化评审，作为项目开发的权威执行指南。

---

## 一、项目概述

AI-CLI-Mobile 是一个**移动端 AI 编程命令行网关**，旨在让用户通过手机浏览器安全、流畅地使用 Claude Code、Codex、Aider 等 AI CLI 工具。项目采用 Plugin-Driven 架构，核心引擎与具体 CLI 工具解耦。

### 设计哲学

1. **Mobile-First, but Desktop-Ready** — 交互专为触屏设计，底层架构支撑桌面端分屏与多端协同
2. **Plugin-Driven** — 通过 Adapter 模式支持任意 CLI 工具接入
3. **Resilience** — 断线不丢进程，重连秒级恢复，多端状态一致
4. **Security & Authority** — Zero Trust 原则，服务端状态权威

### 核心能力

- 移动端浏览器内运行完整终端（xterm.js + WebGL 渲染 + Canvas fallback）
- tmux 保活会话，断线重连后画面完整恢复
- 后端权威状态机（多信号融合，不依赖单一正则），多设备连接状态同步
- 移动端输入适配（IME 组合输入、虚拟键盘兼容）
- 智能快捷键面板（Approve/Deny 一键操作）
- 抽屉式文件树 + CodeMirror 6 代码编辑器 + 代码注入
- PWA 支持，可添加到主屏幕
- JWT 双 Token 鉴权体系（accessToken + refreshToken）

---

## 二、核心架构设计

### 1. 双通道 WebSocket 通信

| 通道 | 路径 | 数据格式 | 用途 |
|---|---|---|---|
| Terminal | `/ws/terminal` | Binary | 纯二进制流，零序列化开销，专用于 xterm 渲染 |
| Control | `/ws/control` | JSON | 会话状态、审批事件、文件树元数据、Resize 指令、Token 刷新 |

**连接治理：**

- **健康检测** — 双通道各自独立心跳（每 30s），超时未收到回复视为半连接断开，主动关闭并触发整体重连
  - Terminal 通道：应用层 Binary 心跳（客户端发 `0x00`，服务端回 `0x01`）— 浏览器 WS API 不支持协议级 Ping/Pong 帧（Opcode 0x9/0xA），前端 JS 无法主动发起
  - Control 通道：JSON 消息 `{ type: 'PING' }` / `{ type: 'PONG' }`
- **原子重连（防脑裂）** — 前端连接阶段状态机：`DISCONNECTED → CONNECTING_TERM → CONNECTING_CTRL → CONNECTED`。仅当双通道均收到 `AUTH_OK` 后才移除 ConnectionOverlay 并接收数据；任一通道握手失败则整体 reset（关闭已成功通道）重试。中间状态收到的数据一律丢弃
- **连接数预算** — 单会话双 WS 占 2 个连接，移动端 6 连接上限下可支持 3 个并发会话

### 2. 服务端权威状态机（多信号融合）

后端 `SessionManager` 维护权威状态机（`IDLE / RUNNING / WAITING_APPROVAL / ERROR`），不依赖单一正则判断，采用**三路信号融合**：

| 信号来源 | 机制 | 可靠性 |
|---|---|---|
| **流式数据正则** | 实时解析 ANSI 流中的关键词 | 中（CLI 输出格式可能变化） |
| **屏幕快照按需确认** | 流式正则匹配到疑似状态变更时，触发单次 `tmux capture-pane -p` 做二次确认 | 高（获取完整屏幕状态，且极低 CPU 开销） |
| **进程退出码** | 监听 pty 退出事件，非零退出码直接标记 ERROR | 高（操作系统级别信号） |

状态变更通过 `/ws/control` 主动推送 `STATUS_UPDATE` 事件，前端仅作为"状态显示器"。

**预留结构化输出接口：** `CLIAdapter` 定义 `supportsStructuredOutput()` 方法，未来 CLI 工具支持 `--json` 模式时可直接接入，跳过正则解析。

### 3. 移动端输入适配（MobileKeyboardAdapter）

- 使用 Hidden Input + Composition Event 捕获 IME 输入
- 监听 `visualViewport` API 动态调整终端高度
- 针对 iOS Safari `contenteditable` 陷阱做专项兼容
- iOS/Android 双平台真机测试覆盖

### 4. 进程治理（tmux 保活 + Session Reaper）

- 服务启动时扫描所有 `aicli-*` 前缀的 tmux session，与内存 Map 比对，仅回收 Node 进程崩溃后遗留的孤儿（不在内存 Map 中的 aicli- session）
- 为每个 session 注入 `TMUX_TIMEOUT` 环境变量，超时自动销毁
- tmux session 命名规范：`aicli-<sessionId>`

---

## 三、Monorepo 工程结构

```
ai-cli-mobile/
├── apps/
│   ├── web/                        # 前端 PWA (React 18 + Vite + Tailwind + Zustand)
│   │   └── src/
│   │       ├── adapters/           # MobileKeyboardAdapter 移动端输入适配层
│   │       ├── components/         # 完整 UI 组件集（见第五节）
│   │       ├── hooks/              # useDualChannelWS, useAuth 双通道 + 鉴权 Hook
│   │       ├── lib/                # GestureHandler 手势处理层
│   │       └── store/              # Zustand 状态管理
│   └── server/                     # 后端服务 (Node.js + Fastify + WS + node-pty)
│       └── src/
│           ├── core/               # SessionManager, StateMachine, WSGateway
│           ├── adapters/           # CLI 插件适配器 (ClaudeCode, Aider)
│           ├── routes/             # terminal, control, fs, auth 路由
│           └── plugins/            # auth JWT 鉴权插件
├── packages/
│   ├── shared/                     # 前后端共享：TS 接口、WS 协议定义、常量
│   ├── ui/                         # 共享移动端 UI 组件库
│   └── config/                     # 共享 ESLint, Prettier, TSConfig, Husky
├── docker/
│   ├── Dockerfile                  # 分离式构建 + 安全加固 + tini init + HEALTHCHECK
│   ├── seccomp.json                # 容器系统调用白名单（node + tmux 定制）
│   └── docker-compose.yml          # 开发/生产环境编排
├── scripts/
│   └── setup.sh                    # Debian 13 一键初始化脚本
├── .github/workflows/              # CI/CD 流水线（见第七节）
├── turbo.json                      # Turborepo 构建缓存与任务编排
├── pnpm-workspace.yaml
└── .env.example                    # 环境变量模板
```

---

## 四、技术栈

| 层级 | 技术选型 | 版本要求 | 备注 |
|---|---|---|---|
| **运行时** | Node.js | >= 20.0.0 | — |
| **包管理** | pnpm (workspace) | 8.15.4 | — |
| **构建编排** | Turborepo | ^1.13.0 | — |
| **后端框架** | Fastify | ^4.26.2 | — |
| **WebSocket** | @fastify/websocket + ws | ^8.3.1 / ^8.16.0 | — |
| **伪终端** | node-pty | ^1.0.0 | 需要 prebuild 机制 |
| **会话保活** | tmux | >= 3.3a | Docker 中固定版本 |
| **JWT** | jsonwebtoken + bcryptjs | — | Token 签发与密码哈希 |
| **前端框架** | React 18 | — | — |
| **构建工具** | Vite | — | — |
| **CSS** | Tailwind CSS | — | — |
| **状态管理** | Zustand | — | — |
| **终端渲染** | @xterm/xterm + addon-webgl + addon-fit + addon-web-links | — | WebGL 带 Canvas fallback |
| **代码编辑** | CodeMirror 6 (@uiw/react-codemirror) | — | — |
| **移动端抽屉** | vaul | — | — |
| **PWA** | vite-plugin-pwa | — | — |
| **图标** | lucide-react | — | — |
| **手势处理** | 自定义 GestureHandler | — | 双指缩放、长按粘贴 |
| **语言** | TypeScript | ^5.4.2 | — |

---

## 五、前端完整组件清单

| 组件 | 文件 | 功能 |
|---|---|---|
| `StatusBar` | `components/StatusBar.tsx` | 顶部状态栏：连接状态指示灯（绿/黄/红）+ AgentStatus 标签 + 当前会话名 |
| `TerminalContainer` | `components/TerminalContainer.tsx` | xterm 终端容器 + DOM 卸载恢复 + resize 监听 + WebGL/Canvas fallback |
| `MobileKeyboardAdapter` | `adapters/MobileKeyboardAdapter.ts` | 隐藏输入法适配层（Hidden Input + Composition Event + visualViewport） |
| `ConnectionOverlay` | `components/ConnectionOverlay.tsx` | 断线时半透明遮罩 + 旋转动画 + 重连倒计时 |
| `QuickActionsPanel` | `components/QuickActionsPanel.tsx` | WAITING_APPROVAL 时底部弹出 Approve/Deny 按钮 |
| `FileExplorer` | `components/FileExplorer.tsx` | 抽屉式文件树（vaul Drawer） |
| `CodeEditor` | `components/CodeEditor.tsx` | CodeMirror 6 编辑器 + 选中代码注入按钮 |
| `GestureHandler` | `lib/GestureHandler.ts` | 双指缩放字体 + 长按粘贴（独立手势层，不依赖 xterm 内置手势） |
| `SettingsDrawer` | `components/SettingsDrawer.tsx` | 字体大小、主题切换、快捷键自定义 |

---

## 六、鉴权体系（JWT 双 Token）

### 登录流程

```
POST /api/auth/login { username, password }
  → bcryptjs 验证密码
  → 签发 accessToken (JWT, 15min 有效期) + refreshToken (JWT, 7d 有效期)
  → 返回 { accessToken, refreshToken }
```

### WebSocket 鉴权（连接状态机）

```
WS 连接建立 → 标记为 UNAUTHENTICATED 状态
  → 启动 5 秒超时定时器，超时未收到 AUTH → 主动断开 (code: 4001)
  → UNAUTHENTICATED 状态下，丢弃除 AUTH 外的所有消息

客户端首条消息：
  { type: 'AUTH', accessToken: "<jwt>", protocolVersion: "<版本号>" }

服务端验证 JWT + 协议版本：
  → 版本不匹配：主动关闭 WS 连接 (code: 4002, PROTOCOL_MISMATCH)，前端收到后强制 window.location.reload() 刷新 PWA 缓存
  → JWT 有效 + 版本匹配：清除超时定时器 → 标记为 AUTHENTICATED → 回复 { type: 'AUTH_OK' }
  → JWT 无效/过期：主动关闭 WS 连接 (code: 4001)

AUTHENTICATED 后正常处理所有消息

Token 续期（过期前 2 分钟）：
  客户端 → { type: 'REFRESH', refreshToken: "<jwt>" }
  服务端 → 验证 refreshToken → 签发新 accessToken
  服务端 → { type: 'TOKEN_RENEWED', accessToken: "<新jwt>" }
```

**WSGateway 连接状态机：**

```
UNAUTHENTICATED ──AUTH(valid+version_match)──→ AUTHENTICATED
       │                                            │
       ├──AUTH(invalid)──→ CLOSED (4001)            ├──REFRESH──→ TOKEN_RENEWED
       │                                            │
       ├──AUTH(version_mismatch)──→ CLOSED (4002)   └──PING/PONG──→ keep-alive
       │         └→ 前端强制 window.location.reload()
       │
       └──5s timeout──→ CLOSED (4001)
```

### HTTP API 鉴权

```
Authorization: Bearer <accessToken>

/health 免鉴权
/api/auth/login 免鉴权
其他所有路由需要有效 accessToken
```

**优势：** Token 不通过 URL Query 传递，不会泄露到服务器日志或浏览器历史记录。

---

## 七、CI/CD 流水线

```
PR 提交：
  → ESLint + TypeScript 类型检查 + 单元测试
  → 构建 Docker 镜像（不推送）
  → 全部通过才允许 Merge

Merge to main：
  → Lint + Test + Build
  → 推送镜像到 GHCR (GitHub Container Registry)
  → 自动部署到 Staging 环境

Tag Release (v*)：
  → 构建 + 推送正式镜像
  → 部署到 Production 环境
```

### GitHub Actions 关键步骤

```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test

  build-and-push:
    needs: lint-and-test
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
```

---

## 八、WS 协议定义

### Terminal Channel (`/ws/terminal`)

- **方向：** 双向 Binary
- **客户端 → 服务端：** 用户键盘输入（UTF-8 编码）
- **服务端 → 客户端：** ANSI 终端输出（Buffer 合并，16ms 节流）
- **心跳：** 应用层 Binary PING/PONG（客户端每 30s 发送 `Uint8Array([0x00])`，服务端回复 `Uint8Array([0x01])`；注：浏览器 WS API 不支持协议级 Ping/Pong 帧，必须在应用层实现）

### Control Channel (`/ws/control`)

**客户端 → 服务端消息：**

```typescript
type ControlClientMessage =
  | { type: 'AUTH'; accessToken: string; protocolVersion: string }
  | { type: 'REFRESH'; refreshToken: string }
  | { type: 'PING' }
  | { type: 'INIT_SESSION'; sessionId: string; cols: number; rows: number; adapter: string }
  | { type: 'ATTACH_SESSION'; sessionId: string }
  | { type: 'RESIZE'; sessionId: string; cols: number; rows: number }
  | { type: 'QUICK_ACTION'; sessionId: string; payload: string }
  | { type: 'INJECT_CODE'; sessionId: string; code: string }
  | { type: 'OBSERVE_SESSION'; sessionId: string }     // 只读观察者
  | { type: 'START_RECORDING'; sessionId: string }      // 开始录制
  | { type: 'STOP_RECORDING'; sessionId: string }       // 停止录制
  | { type: 'GET_RECORDING'; sessionId: string; startTime?: number; endTime?: number } // 获取回放
```

**服务端 → 客户端消息：**

```typescript
type ControlServerMessage =
  | { type: 'AUTH_OK' }
  | { type: 'TOKEN_RENEWED'; accessToken: string }
  | { type: 'PONG' }
  | { type: 'STATUS_UPDATE'; sessionId: string; status: AgentStatus; message?: string }
  | { type: 'SESSION_READY'; sessionId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RECORDING_DATA'; sessionId: string; data: Array<{ data: string; timestamp: number }> }  // base64 编码
  | { type: 'RECORDING_STATUS'; sessionId: string; recording: boolean; duration: number }
```

**状态定义：**

```typescript
type AgentStatus = 'IDLE' | 'RUNNING' | 'WAITING_APPROVAL' | 'ERROR'
```

---

## 九、安全设计

### 鉴权

- JWT 双 Token 体系（accessToken 15min + refreshToken 7d）
- WS 鉴权通过首条消息完成，不通过 URL Query 传递 Token
- HTTP API 使用 Bearer Token
- 密码使用 bcryptjs 哈希存储
- `/health` 和 `/api/auth/login` 免鉴权

### Docker 沙箱

- Multi-stage 构建，运行时镜像移除编译工具链（g++/make）和 pip，**保留 python3**（CLI 工具运行时依赖）
- 使用 `tini` 作为 PID 1，正确处理信号和僵尸进程回收
- 非 root 用户运行（`appuser`）
- Seccomp profile 针对 node + tmux 定制，禁止 `mount`、`pivot_root`、`keyctl`、`ptrace` 等危险系统调用
- `HEALTHCHECK` 指令监控服务状态
- 日志输出到 stdout/stderr，配合 Docker logging driver
- 目标镜像 < 300MB

### 文件系统 API 安全

- Path Traversal 防护（`path.resolve` + `startsWith` 校验）
- 文件大小限制（1MB 以内）
- 过滤隐藏文件和 `node_modules`

---

## 十、分阶段交付计划（6 周 MVP）

### P0: 工程基座与安全沙箱（Week 1）

**目标：** 搭建可复现、安全、轻量的开发/生产环境

- [ ] 初始化 pnpm workspace + Turborepo，配置 `@ai-cli/shared` 协议包
- [ ] 编写分离式 Dockerfile（tini init + Multi-stage + HEALTHCHECK）
- [ ] 实现 JWT 双 Token 鉴权（登录接口 + Auth 中间件 + WS 首条消息鉴权）
- [ ] 配置 ESLint + Prettier + Husky + lint-staged，强制 commit 规范
- [ ] 搭建 CI/CD 流水线（GitHub Actions: Lint + Test + Build + Push）
- [ ] 创建 `.env.example` 与一键初始化脚本 `scripts/setup.sh`

**验收标准：** `docker compose up` 一键启动，镜像 <300MB，JWT 鉴权生效，CI 流水线绿灯

**关键交付物：**

| 文件 | 说明 |
|---|---|
| `package.json` (root) | Monorepo 根配置 |
| `pnpm-workspace.yaml` | workspace 定义 |
| `turbo.json` | 构建缓存与任务编排 |
| `packages/shared/src/protocol.ts` | WS 协议类型定义 + JWT 类型 |
| `packages/shared/src/index.ts` | 共享包入口 |
| `docker/Dockerfile` | Multi-stage 构建（tini + bookworm-slim + 保留 python3 移除 pip + HEALTHCHECK） |
| `docker/seccomp.json` | node + tmux 定制系统调用白名单 |
| `apps/server/src/plugins/auth.ts` | JWT 鉴权中间件（HTTP Bearer + WS 首条消息） |
| `apps/server/src/routes/auth.ts` | 登录接口（POST /api/auth/login） |
| `apps/server/src/index.ts` | Fastify 启动入口 |
| `.github/workflows/ci.yml` | CI/CD 流水线 |
| `.env.example` | 环境变量模板 |
| `scripts/setup.sh` | Debian 13 一键初始化 |

### P1: 高可用会话引擎（Week 2-3）

**目标：** 断线不丢、重连秒恢、多端一致

- [ ] 实现 `SessionManager` + tmux 集成 + Session Reaper 孤儿回收
- [ ] 实现双通道 WS 路由（`/ws/terminal` Binary + `/ws/control` JSON）
- [ ] 实现双通道健康检测（PING/PONG + 原子重连）
- [ ] 实现 `ClaudeCodeAdapter` 状态解析（三路信号融合：流式正则 + capture-pane 按需确认 + 进程退出码）
- [ ] 实现高频输出 16ms 节流缓冲（Throttle Buffer）
- [ ] 实现指数退避重连 + `\x0c` 重绘恢复逻辑

**验收标准：** 手机断网 30s 后重连画面完整恢复；两设备同时连接状态同步；PING 超时触发自动重连

**关键交付物：**

| 文件 | 说明 |
|---|---|
| `apps/server/src/core/SessionManager.ts` | 核心会话管理器（创建/附着/销毁/孤儿回收/16ms 缓冲/事件驱动状态融合） |
| `apps/server/src/core/WSGateway.ts` | 双通道网关（PING/PONG 健康检测 + 原子重连 + WS 连接状态机 + AUTH 超时断开） |
| `apps/server/src/routes/terminal.ts` | Terminal Channel WS 路由（Binary 流） |
| `apps/server/src/routes/control.ts` | Control Channel WS 路由（JSON + AUTH + REFRESH） |
| `apps/server/src/adapters/base.ts` | CLIAdapter 接口定义（含 `supportsStructuredOutput()`） |
| `apps/server/src/adapters/claude.ts` | Claude Code 适配器（三路信号状态解析 + 快捷操作） |

**SessionManager 核心逻辑：**

```
createOrAttachSession()
  → 检查已有 session → 有则直接返回
  → pty.spawn('tmux', ['new-session', '-A', '-s', `aicli-${sessionId}`, adapter.startCommand])
  → ptyProcess.onData → 16ms 节流缓冲 → 合并 Buffer → 广播给所有 termClients（含背压控制：若 client.bufferedAmount > 1MB 则丢弃当前帧，终端画面是覆盖式的，丢中间帧不影响最终状态）
  → 异步三路状态融合 → 状态变更 → broadcastControl(STATUS_UPDATE)

事件驱动状态融合（非定时轮询）：
  信号1: ptyProcess.onData → strip-ansi → 正则匹配 → 状态候选
         → 正则匹配到疑似状态变更时，触发单次 capture-pane 二次确认
  信号2: 按需触发 → 异步 exec('tmux capture-pane -p -t <session>') → Promise 回调中关键词分析 → 确认/否决候选（严禁 execSync，避免阻塞事件循环）
  信号3: ptyProcess.onExit → exit code ≠ 0 → 强制 ERROR
  → 三个信号投票/覆盖 → 最终状态

attachClient() → 添加 WS 到 termClients/controlClients → 发送 HISTORY + STATUS_UPDATE
detachClient() → 移除 WS → 无人时保持 tmux 保活
reapOrphanSessions() → tmux list-sessions → 过滤 aicli-* 前缀 → 与内存 sessions Map 比对 → 杀掉差集（Node 崩溃遗留的孤儿）→ 严禁触碰非 aicli- 前缀的宿主 tmux session
```

### P2: 移动端终端体验攻坚（Week 3-4）

**目标：** 解决移动端 xterm 的输入、遮挡、手势等痛点

- [ ] 实现 `TerminalContainer` + DOM 卸载缓存策略（WebGL + Canvas fallback）
- [ ] 封装 `MobileKeyboardAdapter`（Hidden Input、IME 兼容、viewport 自适应）
- [ ] 实现双通道 WS Hook（`useDualChannelWS`，含 PING/PONG + 指数退避重连 + 原子重连）
- [ ] 实现 `ConnectionOverlay` 断线遮罩（半透明 + 重连倒计时）
- [ ] 实现 `StatusBar` 顶部状态栏（连接状态灯 + AgentStatus + 会话名）
- [ ] 实现 `GestureHandler` 触屏手势（双指缩放字体、长按粘贴，独立手势层）
- [ ] 集成 `@xterm/addon-webgl` + `addon-fit` + `addon-web-links`（WebGL 失败自动降级 Canvas）
- [ ] 配置 Tailwind CSS 移动端基础样式

**验收标准：** iOS Safari + Android Chrome 真机测试通过，IME 输入无丢失，5 Tab 切换不崩溃，WebGL 失败自动降级

**关键交付物：**

| 文件 | 说明 |
|---|---|
| `apps/web/src/components/TerminalContainer.tsx` | 终端容器（xterm 初始化、WebGL/Canvas fallback、DOM 卸载/恢复、resize） |
| `apps/web/src/adapters/MobileKeyboardAdapter.ts` | 移动端输入适配层（Hidden Input + Composition Event + visualViewport） |
| `apps/web/src/components/ConnectionOverlay.tsx` | 断线遮罩（半透明 + 旋转动画 + 重连倒计时） |
| `apps/web/src/components/StatusBar.tsx` | 顶部状态栏（连接状态灯 + AgentStatus 标签 + 会话名） |
| `apps/web/src/lib/GestureHandler.ts` | 独立手势层（双指缩放字体、长按粘贴） |
| `apps/web/src/hooks/useDualChannelWS.ts` | 双通道 WS Hook（PING/PONG、原子重连防脑裂、指数退避、Token 续期、4001 断开处理：暂停重连 → refreshToken() 换新 accessToken → 恢复重连；refreshToken 也失效则跳转登录页；连接阶段状态机：DISCONNECTED → CONNECTING_TERM → CONNECTING_CTRL → CONNECTED；4002 协议版本不匹配 → window.location.reload()） |
| `apps/web/src/hooks/useAuth.ts` | 鉴权 Hook（登录、Token 存储、自动续期） |
| `apps/web/src/store/sessionStore.ts` | Zustand 全局状态（sessionId、status、isConnected、tokens） |
| `apps/web/vite.config.ts` | Vite 配置（React + PWA + 开发代理） |
| `apps/web/src/index.css` | 移动端基础 CSS（禁用双击缩放、长按菜单） |

**TerminalContainer 核心逻辑：**

```
useEffect → new Terminal({theme, fontSize, ...})
         → loadAddon(WebGLAddon) → catch → fallback loadAddon(CanvasAddon)
         → loadAddon(FitAddon)
         → useDualChannelWS() → 绑定 termWs.onmessage → term.write(data)
         → 绑定 term.onData → termWs.send(input)
         → 绑定 term.onResize → 200ms 防抖 → ctrlWs.send(RESIZE)（严禁无防抖直发，移动端旋转/键盘弹出 1 秒内触发十余次 resize，密集 SIGWINCH 会导致 TUI 崩溃）

DOM 卸载策略 → visibilitychange 事件（绝不 dispose 实例）
  → hidden: container.removeChild(term.element) → 实例保留在内存 Map 中，停止 DOM 布局计算
  → visible: container.appendChild(term.element) → fitAddon.fit() → 瞬间恢复，零状态丢失
  → 优势：保留光标位置、未提交输入行、TUI 交互状态，避免 WebGL 上下文重建开销

重连恢复 → Ctrl+L 重绘
  → 重连成功后发送 '\x0c' 到 pty → 服务端重新推送当前屏幕
```

**MobileKeyboardAdapter 核心逻辑：**

```
创建隐藏 <input> 元素（position:fixed, opacity:0, left:-9999px）
监听 compositionstart / compositionupdate / compositionend → 处理 IME 组合输入
监听 input 事件 → 处理普通 ASCII 输入 → 写入 pty
监听 visualViewport.resize → 动态调整终端容器高度，防止键盘遮挡
iOS Safari 专项：focus 调度、keydown 兼容、contenteditable 陷阱规避
Android Chrome：各厂商 ROM 差异处理
```

### P3: 插件生态与交互增强（Week 5-6）

**目标：** 验证 Adapter 可扩展性，提升编程效率

- [ ] 实现后端文件系统 API（`/api/fs/tree`、`/api/fs/file`），含路径遍历防护
- [ ] 实现智能快捷键面板（`QuickActionsPanel`，WAITING_APPROVAL 状态自动弹出）
- [ ] 实现抽屉式文件树（`FileExplorer`，使用 vaul Drawer 组件）
- [ ] 实现 CodeMirror 6 移动端代码编辑器（`CodeEditor`）
- [ ] 实现"选中代码 → 注入 CLI"快捷操作（INJECT_CODE 协议）
- [ ] 实现 `SettingsDrawer`（字体大小、主题切换、快捷键自定义）
- [ ] 配置 PWA Manifest 与离线缓存（含协议版本号校验，防止静默更新导致的 WS 协议版本撕裂）

**验收标准：** Approve/Deny 快捷键响应 <100ms；文件树可浏览；选中代码可注入 CLI；PWA 可添加到主屏幕

**关键交付物：**

| 文件 | 说明 |
|---|---|
| `apps/server/src/routes/fs.ts` | 文件系统 API（Path Traversal 防护 + 1MB 文件大小限制） |
| `apps/web/src/components/QuickActionsPanel.tsx` | 底部快捷操作面板（Approve/Deny） |
| `apps/web/src/components/FileExplorer.tsx` | 抽屉式文件树（vaul） |
| `apps/web/src/components/CodeEditor.tsx` | CodeMirror 6 编辑器 + 选中代码注入 |
| `apps/web/src/components/SettingsDrawer.tsx` | 设置面板（字体/主题/快捷键） |

---

## 十一、关键技术决策记录（ADR）

| 编号 | 决策 | 选型 | 原因 |
|---|---|---|---|
| ADR-001 | tmux vs screen | **tmux** | 支持 `-A` 原子化创建/附着，scripting 接口（capture-pane）更丰富 |
| ADR-002 | WS 协议格式 | **JSON** + 预留 Protobuf 迁移路径 | 控制信令频率低，JSON 可读性与调试效率优先 |
| ADR-003 | 前端状态管理 | **Zustand** | 无 Provider、selector 精确订阅，避免终端不必要重渲染 |
| ADR-004 | 移动端编辑器 | **CodeMirror 6** | 模块化体积小 (~200KB)，原生移动端触摸支持；Monaco >2MB 且移动端差 |
| ADR-005 | Docker 基础镜像 | **node:20-bookworm-slim** | 与 Debian 13 宿主机 glibc 一致，避免 node-pty 跨 libc 问题 |
| ADR-006 | Session Reaper | **启动时扫描 + 超时环境变量** | 仅回收 aicli-* 前缀中不在当前进程内存 Map 的 session，避免误杀宿主机用户 tmux session |
| ADR-007 | 鉴权方案 | **JWT 双 Token**（accessToken 15min + refreshToken 7d） | Token 不通过 URL 传递，避免日志泄露；支持无感续期 |
| ADR-008 | 状态解析策略 | **事件驱动三路融合**（正则 → 按需 capture-pane 确认 + 退出码） | 定时轮询 capture-pane 在高并发下引发 CPU 风暴；事件驱动仅在疑似变更时触发，开销降低 99% |
| ADR-009 | Docker init | **tini** | 正确处理信号转发和僵尸进程回收 |
| ADR-010 | 终端渲染 | **WebGL + Canvas fallback** | 部分 Android 设备 WebGL 有 Bug，需降级方案 |
| ADR-011 | DOM 卸载策略 | **removeChild 保留实例，绝不 dispose** | term.dispose() 销毁 WebGL 上下文和事件监听器，重建成本极高且丢失光标/输入状态；仅从 DOM 树移除元素即可停止布局计算 |
| ADR-012 | capture-pane 调度 | **事件驱动按需触发，禁止定时轮询** | 500ms 定时轮询在 20 并发会话下每秒 40 次 fork，阻塞事件循环；改为正则匹配到疑似变更时才触发单次确认 |
| ADR-013 | 运行时 python3 | **保留 python3，移除 pip** | Aider、SWE-agent 等 CLI 工具强依赖 Python；移除 pip 防止动态安装恶意包 |
| ADR-014 | Terminal 通道心跳 | **应用层 Binary PING（0x00/0x01）** | 浏览器 WebSocket API 不支持发送/监听协议级 Ping/Pong 帧（Opcode 0x9/0xA），前端 JS 无法主动发起协议级 Ping；必须在应用层定义单字节心跳 |
| ADR-015 | WS 4001 重连策略 | **先续期 Token 再重连** | accessToken 过期触发 WS 4001 断开后，直接重连会进入"连接→4001→断开"死循环；必须先通过 refreshToken 换取新 accessToken 再发起 WS 握手 |
| ADR-016 | capture-pane 执行方式 | **异步 exec，严禁 execSync** | execSync 阻塞事件循环，tmux 卡顿 100ms 会导致所有 WS/HTTP 处理停滞；改为 promisify(exec) 异步执行 |
| ADR-017 | 终端输出背压控制 | **bufferedAmount > 1MB 丢帧** | 弱网环境下 ws.send() 数据积压在 Socket Buffer 中，60fps 发送几十秒即可 OOM；终端画面是覆盖式的，丢中间帧不影响最终状态 |
| ADR-018 | 移动端 resize 策略 | **200ms 防抖** | 移动端旋转/键盘弹出 1 秒内触发十余次 resize，密集 SIGWINCH 导致 Vim/Nano 等 TUI 渲染错乱甚至崩溃 |
| ADR-019 | 双通道连接阶段状态机 | **DISCONNECTED → CONNECTING_TERM → CONNECTING_CTRL → CONNECTED** | 防止 Terminal 成功但 Control 失败时的脑裂状态；中间状态数据一律丢弃，任一失败整体 reset |
| ADR-020 | WS 协议版本校验 | **AUTH 携带 protocolVersion，4002 强制刷新** | PWA 静默更新可能导致旧前端与新后端协议字段不匹配（版本撕裂）；版本不一致时返回 4002，前端强制 window.location.reload() |

---

## 十二、风险与应对

| 风险 | 概率 | 影响 | 应对措施 |
|---|---|---|---|
| iOS Safari 输入法兼容性 | 高 | 高 | P2 真机测试矩阵（iOS Safari + Android Chrome + 微信浏览器）；建立 iOS 输入问题知识库；预留纯 ASCII 降级模式 |
| node-pty 跨平台编译失败 | 中 | 高 | Docker 标准化构建（Debian-slim）；prebuild 机制；CI 增加 macOS/Linux 矩阵测试 |
| tmux 版本差异 | 中 | 中 | Docker 中固定 tmux 版本（3.3a）；SessionManager 增加版本检测与警告 |
| 公网部署安全风险 | 高 | 极高 | 默认集成 Cloudflare Tunnel 配置；JWT 短期 Token；seccomp 兜底；运行时移除编译器和 pip，保留 python3（CLI 运行时依赖） |
| WebGL 兼容性（部分 Android） | 中 | 中 | 自动检测 WebGL 支持并降级到 Canvas 渲染；CI 中增加渲染测试 |
| 双通道半连接状态 | 中 | 中 | PING/PONG 健康检测；原子重连策略（两个通道都成功才算恢复） |
| WS 未鉴权连接资源耗尽 | 高 | 高 | WSGateway 连接状态机：UNAUTHENTICATED 状态下 5s 超时断开；丢弃非 AUTH 消息 |

---

## 十三、MVP 范围确认

### v0.1 Alpha（W1-W6 全量交付）

- JWT 双 Token 鉴权体系
- 单会话 + tmux 保活 + 双通道 WS + 断线重连
- Claude Code 基础适配（三路信号融合 + Approve/Deny）
- 移动端完整输入（MobileKeyboardAdapter + GestureHandler）
- 完整前端 UI（StatusBar + ConnectionOverlay + QuickActionsPanel + FileExplorer + CodeEditor + SettingsDrawer）
- Docker 安全沙箱部署（tini + seccomp + 非 root）
- CI/CD 流水线
- PWA 支持

### v0.5+ 后续迭代

- 多 Tab / 多会话协同
- 第二个 CLI Adapter（Aider / Codex）
- 桌面端分屏支持
- 结构化输出适配器（当 CLI 工具支持 `--json` 时）
- Protobuf 协议迁移

---

## 十四、开发环境要求（Debian 13）

```bash
# 系统依赖
sudo apt install -y build-essential python3 tmux git curl

# Node.js（推荐 nvm 管理）
nvm install 20 && nvm use 20
corepack enable && corepack prepare pnpm@8.15.4 --activate

# 一键初始化
./scripts/setup.sh

# 本地开发
pnpm dev

# 生产部署
docker compose up --build -d
```

### 环境变量

```ini
# Server
PORT=3000
JWT_SECRET=<your-jwt-secret-min-32-chars>
JWT_REFRESH_SECRET=<your-refresh-secret-min-32-chars>
PROJECT_ROOT=/workspace

# Web (Vite 读取 VITE_ 前缀变量)
VITE_WS_URL=ws://localhost:3000

# Admin (首次启动时自动创建管理员账户)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<initial-password>
```
