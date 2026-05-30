# AI-CLI-Mobile

> 在手机浏览器中运行 AI 编程助手（Claude Code、Aider、Shell 等）的轻量级网关。通过响应式 Web 终端封装 CLI 工具，随时随地进行代码开发。

[English](#english) | [中文](#中文)

---

## 中文

### 架构概览

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│  Mobile      │ ◄── Terminal ───► │  Fastify Server   │
│  Browser     │ ◄── Control  ───► │  (Docker)         │
│  (xterm.js)  │                    │  ├─ WSGateway     │
│              │                    │  ├─ SessionManager │
│              │                    │  │  └─ tmux + pty  │
│              │                    │  └─ CLI Adapter    │
└─────────────┘                    └──────────────────┘
```

**双通道 WebSocket：**
- **Terminal 通道** — 二进制数据 + 应用层 PING/PONG（浏览器 WS API 无法发送协议级 Ping 帧）
- **Control 通道** — JSON 消息，用于认证、状态同步、窗口缩放、快捷操作

**核心设计决策：**
- 终端实例永不销毁 — 通过 `removeChild`/`appendChild` 在可见性切换时复用（ADR-011）
- 16ms 节流缓冲 + 1MB 背压阈值控制终端输出
- 200ms 去抖 + 1s 节流处理 resize 事件（防止移动端 SIGWINCH 风暴）
- 事件驱动状态融合：流式正则 → 异步 `tmux capture-pane` 确认 → 退出码
- Docker 沙箱：seccomp 安全配置、tini PID 1、非 root 用户运行
- zod schema 统一配置管理 + getConfig() 单例模式
- JWT 双 token（access 15min + refresh 7d）+ 会话归属校验
- 多层安全防御：输入校验、路径遍历防护（null byte + realpath）、原子写入

### 技术栈

```
后端：Node.js 20, Fastify 5, node-pty, tmux, zod
前端：React 18, Vite 5, xterm.js (WebGL + Canvas 回退), CodeMirror 6, Zustand
认证：JWT 双 token, bcrypt 异步哈希
移动端：自定义键盘适配器 (IME/CJK), 手势处理器 (双指缩放, 长按粘贴)
PWA：vite-plugin-pwa 自动更新
基础设施：Docker 多阶段构建, seccomp, GitHub Actions CI/CD
API 文档：@fastify/swagger + swagger-ui (/docs)
测试：Vitest (243+ 单元/集成测试), Playwright E2E, React Testing Library
```

### 快速开始

**环境要求：** Node.js 20+, pnpm 8+, tmux 3.3+

```bash
# 克隆
git clone https://github.com/wait4xx/AI-CLI-Mobile.git
cd AI-CLI-Mobile

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env — 必须设置 JWT_SECRET（≥32字符）、JWT_REFRESH_SECRET（≥32字符）、ADMIN_PASSWORD（≥8字符）

# 启动开发服务器（后端 :3000，前端 :5173 代理到后端）
pnpm dev
```

打开 `http://localhost:5173`，使用 `.env` 中的管理员账号登录。

**Docker 部署（生产环境）：**
```bash
cd docker
cp ../.env.example .env
# 编辑 .env
docker compose up -d app
```

容器在 3000 端口���时提供 API 和前端服务。

**HTTPS / TLS：** 生产环境请置于反向代理之后。详见下方 [TLS 配置](#https--tls) 章节。

### 项目结构

```
AI-CLI-Mobile/
├── apps/
│   ├── server/              # Fastify 后端
│   │   └── src/
│   │       ├── core/        # SessionManager, WSGateway, recorder, sessionStore
│   │       ├── routes/      # auth, terminal, control, fs（均含 JSON Schema）
│   │       ├── adapters/    # CLI 适配器（claude, aider, shell）
│   │       ├── plugins/     # JWT 认证插件
│   │       ├── lib/         # config（zod 校验）, logger, wsAuth
│   │       └── __tests__/   # Vitest 单元/集成测试
│   └── web/                 # React 前端
│       └── src/
│           ├── components/  # TerminalContainer, FileExplorer, CodeEditor, LoginForm, SessionTabs, NewSessionDrawer, ...
│           ├── hooks/       # useAuth, useDualChannelWS
│           ├── adapters/    # MobileKeyboardAdapter
│           ├── lib/         # GestureHandler, theme, offlineCache, notifications
│           ├── store/       # Zustand session store
│           └── __tests__/  # React Testing Library 组件测试
├── packages/
│   └── shared/              # 协议类型定义（WS 消息、JWT 载荷、常量）
├── e2e/                     # Playwright E2E 测试（auth, terminal, files）
├── docker/                  # Dockerfile, docker-compose, seccomp 配置
├── docs/                    # 学习指南（21 篇）+ 代码审查报告（8 篇）
└── .github/workflows/       # CI: lint → build → test → audit → coverage → docker
```

### 环境变量配置

```
PORT              端口号            默认 3000
JWT_SECRET        访问令牌密钥       必须，≥32 字符
JWT_REFRESH_SECRET 刷新令牌密钥      必须，≥32 字符
PROJECT_ROOT      文件浏览根目录     默认 /workspace
ADMIN_USERNAME    管理员用户名       默认 admin
ADMIN_PASSWORD    管理员密码         必须，≥8 字符
LOG_LEVEL         日志级别           默认 info
SHELL_CMD         Shell 适配器命令   默认 bash
CORS_ORIGINS      CORS 允许来源      开发模式允许所有
VITE_WS_URL       WebSocket 地址     默认同源
AUDIT_LOG_PATH    审计日志路径       默认 ./audit.log
SESSIONS_FILE_PATH 会话持久化路径     默认 ./sessions.json
USERS_FILE_PATH   用户数据路径        默认 ./users.json
```

### 测试

```bash
# 运行所有单元/集成测试（243+ 用例）
pnpm test

# 运行 Playwright E2E 测试（需要后端服务运行）
pnpm e2e

# 运行单个包的测试
cd apps/server && pnpm test
cd apps/web && pnpm test
cd packages/shared && pnpm test
```

**测试覆盖范围：**
- 后端：config、auth（登录/刷新/用户管理/权限）、security（JWT/路径遍历/文件安全）、fs（读写/权限/路径遍历/空字节注入）、SessionManager、WSGateway（auth/terminal/control/录制/观察）、recorder、audit、sessionStore、shellAdapter、adapters（全部 3 个）
- 前端：LoginForm、StatusBar、ConnectionOverlay、SessionTabs、ErrorBoundary、offlineCache、useAuth、sessionStore
- 共享包：protocol 常量、心跳、关闭码、终端尺寸范围
- E2E：登录流程、WebSocket 终端交互、文件浏览操作

### API 文档

启动服务后访问 `http://localhost:3000/docs` 查看 Swagger UI，包含所有 REST API 的请求/响应 Schema 定义。

### 会话管理

- **多会话标签页** — 底部常驻标签栏，支持快速切换、长按关闭（最多 10 个会话）
- **连接外部 tmux** — 新建会话时可从已有 tmux 终端列表中选择附加，支持指定工作目录
- **路径自动补全** — 新建会话时输入目录路径，自动补全匹配的目录（`GET /api/fs/complete`）
- **会话持久化** — 服务器重启后自动恢复存活的 tmux 会话，重新登录后还原全部会话标签
- **默认 Shell 终端** — 新会话默认打开 Shell，可在设置中切换为 Claude Code / Aider

### 文件浏览器

- **CWD 实时跟踪** — 每次打开文件浏览器自动获取终端当前工作目录（`tmux display-message`）
- **绝对路径浏览** — 支持浏览文件系统任意目录（如 `/home`、`/etc`），不再限制在 PROJECT_ROOT 内
- **代码编辑器** — 点击文件可打开 CodeMirror 6 编辑器，支持语法高亮和代码注入到终端
- **原子写入** — write-then-rename 策略防止崩溃时文件截断

### WS 协议

详见 [`packages/shared/src/protocol.ts`](packages/shared/src/protocol.ts)。

**连接流程：**
1. Terminal WS → AUTH（JWT + 协议版本）→ AUTH_OK → ATTACH_SESSION → 二进制模式
2. Control WS → AUTH → AUTH_OK → INIT_SESSION（含 `attachToTmux` / `cwd` 可选字段）→ SESSION_READY

**关闭码：** `4001` = 认证失败（触发 token 刷新），`4002` = 协议不匹配（触发页面重载）

**扩展控制消息：**
- `OBSERVE_SESSION` — 以只读观察者身份附加（接收终端输出但不能发送输入）
- `START_RECORDING` / `STOP_RECORDING` / `GET_RECORDING` — 会话录制与回放
- `RECORDING_DATA` / `RECORDING_STATUS` — 录制操作的服务端响应

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录获取 JWT token |
| `/api/auth/refresh` | POST | 刷新 access token |
| `/api/sessions` | GET | 列出当前用户所有活跃会话 |
| `/api/sessions/tmux` | GET | 列出可用的外部 tmux 会话 |
| `/api/fs/tree` | GET | 获取目录列表（支持绝对路径） |
| `/api/fs/file` | GET | 读取文件内容 |
| `/api/fs/file` | PUT | 写入文件（原子写入，禁止可执行文件） |
| `/api/fs/cwd` | GET | 获取终端当前工作目录 |
| `/api/fs/complete` | GET | 路径自动补全 |

完整 API 文档见 Swagger UI（`/docs`）。

### 添加 CLI 适配器

实现 `CLIAdapter` 接口（`apps/server/src/adapters/base.ts`）：

```typescript
import { CLIAdapter } from './base.js'

export class MyToolAdapter implements CLIAdapter {
  startCommand = 'my-tool --interactive'
  parseStreamData(text: string): StateCandidate | null { ... }
  parseScreenSnapshot(screen: string): AgentStatus | null { ... }
  getQuickActions(): QuickAction[] { ... }
  supportsStructuredOutput = false
}
```

在 `apps/server/src/index.ts` 中注册：
```typescript
adapters.set('mytool', new MyToolAdapter())
```

### 开发路线

- [x] 多用户支持（用户管理 API、会话隔离）
- [x] 会话持久化（服务器重启后恢复 + 重新登录还原）
- [x] 多 CLI 适配器（Claude Code、Aider、Shell）
- [x] 文件读写（PUT /api/fs/file）
- [x] OpenAPI/Swagger 文档（/docs）
- [x] 全面测试覆盖（243+ 单元/集成 + E2E + 组件测试）
- [x] 配置管理（zod schema 校验 + 单例模式）
- [x] 安全加固（输入校验、路径遍历防护、审计日志、原子写入）
- [x] 多会话标签管理（新建 / 切换 / 关闭 / 连接外部 tmux）
- [x] 文件浏览器 CWD 跟踪 + 绝对路径浏览 + 路径自动补全
- [x] 终端渲染修复（ANSI 转义保留 + 重连画面恢复 + 窗口尺寸同步）
- [ ] PWA 图标和启动画面
- [ ] Claude 审批弹窗（飞书卡片风格）
- [ ] 更多 CLI 适配器（Cursor 等）

---

## English

### Architecture

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│  Mobile      │ ◄── Terminal ───► │  Fastify Server   │
│  Browser     │ ◄── Control  ───► │  (Docker)         │
│  (xterm.js)  │                    │  ├─ WSGateway     │
│              │                    │  ├─ SessionManager │
│              │                    │  │  └─ tmux + pty  │
│              │                    │  └─ CLI Adapter    │
└─────────────┘                    └──────────────────┘
```

**Dual-Channel WebSocket:**
- **Terminal channel** — Binary data + application-layer PING/PONG (browser WS API cannot send protocol-level Ping frames)
- **Control channel** — JSON messages for auth, status, resize, quick actions

**Key design decisions:**
- Terminal instances are never disposed — `removeChild`/`appendChild` on visibility change (ADR-011)
- 16ms throttle buffer + 1MB backpressure threshold for terminal output
- 200ms debounce + 1s throttle for resize events (prevents SIGWINCH storm on mobile)
- Event-driven state fusion: stream regex → async `tmux capture-pane` confirmation → exit code
- Docker sandbox with seccomp profile, tini PID 1, non-root user
- Zod schema config validation + getConfig() singleton
- JWT dual-token (access 15min + refresh 7d) + session ownership checks
- Multi-layer security: input validation, path traversal protection (null byte + realpath), atomic writes

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js 20, Fastify 5, node-pty, tmux, zod |
| Frontend | React 18, Vite 5, xterm.js (WebGL + Canvas fallback), CodeMirror 6, Zustand |
| Auth | JWT dual-token, bcrypt async hashing |
| Mobile | Custom keyboard adapter (IME/CJK), gesture handler (pinch zoom, long-press paste) |
| PWA | vite-plugin-pwa with auto-update |
| Infra | Docker multi-stage build, seccomp, GitHub Actions CI/CD |
| API Docs | @fastify/swagger + swagger-ui (/docs) |
| Testing | Vitest (243+ unit/integration), Playwright E2E, React Testing Library |

### Quick Start

**Prerequisites:** Node.js 20+, pnpm 8+, tmux 3.3+

```bash
# Clone
git clone https://github.com/wait4xx/AI-CLI-Mobile.git
cd AI-CLI-Mobile

# Install
pnpm install

# Set environment variables
cp .env.example .env
# Edit .env — set JWT_SECRET (≥32 chars), JWT_REFRESH_SECRET (≥32 chars), ADMIN_PASSWORD (≥8 chars)

# Start dev servers (server on :3000, web on :5173 with proxy)
pnpm dev
```

Open `http://localhost:5173` — login with the admin credentials from `.env`.

**Docker (Production):**
```bash
cd docker
cp ../.env.example .env
# Edit .env
docker compose up -d app
```

The container serves both the API and frontend on port 3000.

### <a id="https--tls"></a>HTTPS / TLS

The server runs on plain HTTP by default. For production deployments, place it behind a reverse proxy with TLS termination. Without TLS, the JWT token and all terminal data are transmitted in plaintext.

**Minimal nginx config:**

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/cert.pem;
    ssl_certificate_key /etc/ssl/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

You can also use Caddy (automatic TLS) or Traefik as alternatives to nginx.

### Project Structure

```
AI-CLI-Mobile/
├── apps/
│   ├── server/              # Fastify backend
│   │   └── src/
│   │       ├── core/        # SessionManager, WSGateway, recorder, sessionStore
│   │       ├── routes/      # auth, terminal, control, fs (all with JSON Schema)
│   │       ├── adapters/    # CLI adapters (claude, aider, shell)
│   │       ├── plugins/     # JWT auth plugin
│   │       ├── lib/         # config (zod validation), logger, wsAuth
│   │       └── __tests__/   # Vitest unit/integration tests
│   └── web/                 # React frontend
│       └── src/
│           ├── components/  # TerminalContainer, FileExplorer, CodeEditor, LoginForm, SessionTabs, NewSessionDrawer, ...
│           ├── hooks/       # useAuth, useDualChannelWS
│           ├── adapters/    # MobileKeyboardAdapter
│           ├── lib/         # GestureHandler, theme, offlineCache, notifications
│           ├── store/       # Zustand session store
│           └── __tests__/  # React Testing Library component tests
├── packages/
│   └── shared/              # Protocol types (WS messages, JWT payload, constants)
├── e2e/                     # Playwright E2E tests (auth, terminal, files)
├── docker/                  # Dockerfile, docker-compose, seccomp profile
├── docs/                    # Learning guides (21) + code review reports (8)
└── .github/workflows/       # CI: lint → build → test → audit → coverage → docker
```

### Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `JWT_SECRET` | Yes | — | Access token signing key (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Refresh token signing key (min 32 chars) |
| `PROJECT_ROOT` | No | `/workspace` | Directory to serve via file explorer |
| `ADMIN_USERNAME` | No | `admin` | Initial admin username |
| `ADMIN_PASSWORD` | Yes | — | Initial admin password (min 8 chars) |
| `LOG_LEVEL` | No | `info` | Log level (trace/debug/info/warn/error/fatal) |
| `SHELL_CMD` | No | `bash` | Shell command for the generic shell adapter |
| `CORS_ORIGINS` | No | Allow all (dev) | Comma-separated allowed origins |
| `VITE_WS_URL` | No | auto | WebSocket URL (frontend, default: same origin) |
| `AUDIT_LOG_PATH` | No | `./audit.log` | Audit log file path |
| `SESSIONS_FILE_PATH` | No | `./sessions.json` | Session persistence file path |
| `USERS_FILE_PATH` | No | `./users.json` | User data file path |

### Testing

```bash
# Run all unit/integration tests (243+ cases)
pnpm test

# Run Playwright E2E tests (requires running server)
pnpm e2e

# Run single package tests
cd apps/server && pnpm test
cd apps/web && pnpm test
cd packages/shared && pnpm test
```

**Test coverage:**
- **Backend:** config, auth (login/refresh/user CRUD/permissions), security (JWT/path traversal/file safety), fs (read/write/permissions/path traversal/null byte injection), SessionManager, WSGateway (auth/terminal/control/recording/observe), recorder, audit, sessionStore, shellAdapter, adapters (all 3)
- **Frontend:** LoginForm, StatusBar, ConnectionOverlay, SessionTabs, ErrorBoundary, offlineCache, useAuth, sessionStore
- **Shared:** protocol constants, heartbeat, close codes, terminal size ranges
- **E2E:** login flow, WebSocket terminal interaction, file browsing operations

### API Documentation

After starting the server, visit `http://localhost:3000/docs` for Swagger UI with full request/response schema definitions for all REST API endpoints.

### Session Management

- **Multi-session tabs** — Persistent bottom tab bar with quick switching, long-press to close (max 10 sessions)
- **External tmux attach** — Select from existing tmux sessions when creating a new tab, with optional working directory
- **Path autocomplete** — Directory path input with autocomplete when creating sessions (`GET /api/fs/complete`)
- **Session persistence** — Surviving tmux sessions are auto-restored after server restart; all tabs restored on re-login
- **Default to Shell** — New sessions open a shell terminal by default; switch to Claude Code / Aider in settings

### File Explorer

- **Live CWD tracking** — Fetches terminal's current working directory every time the drawer opens (`tmux display-message`)
- **Absolute path browsing** — Browse any directory on the filesystem (e.g. `/home`, `/etc`), not limited to PROJECT_ROOT
- **Code editor** — Click a file to open CodeMirror 6 editor with syntax highlighting and code injection into terminal
- **Atomic writes** — write-then-rename strategy prevents file truncation on crash

### WS Protocol

See [`packages/shared/src/protocol.ts`](packages/shared/src/protocol.ts) for full type definitions.

**Connection flow:**
1. Terminal WS → AUTH (JWT + protocol version) → AUTH_OK → ATTACH_SESSION → binary mode
2. Control WS → AUTH → AUTH_OK → INIT_SESSION (with optional `attachToTmux` / `cwd` fields) → SESSION_READY

**Close codes:** `4001` = auth failed (triggers token refresh), `4002` = protocol mismatch (triggers page reload)

**Additional control messages:**
- `OBSERVE_SESSION` — Attach as read-only observer (receives terminal output but cannot send input)
- `START_RECORDING` / `STOP_RECORDING` / `GET_RECORDING` — Session recording for playback
- `RECORDING_DATA` / `RECORDING_STATUS` — Server responses for recording operations

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login to obtain JWT tokens |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/sessions` | GET | List all active sessions for current user |
| `/api/sessions/tmux` | GET | List available external tmux sessions |
| `/api/fs/tree` | GET | List directory contents (supports absolute paths) |
| `/api/fs/file` | GET | Read file contents |
| `/api/fs/file` | PUT | Write file (atomic write, blocks executable types) |
| `/api/fs/cwd` | GET | Get terminal's current working directory |
| `/api/fs/complete` | GET | Path autocomplete for directories |

Full API documentation available at Swagger UI (`/docs`).

### Adding a CLI Adapter

Implement the `CLIAdapter` interface from `apps/server/src/adapters/base.ts`:

```typescript
import { CLIAdapter } from './base.js'

export class MyToolAdapter implements CLIAdapter {
  startCommand = 'my-tool --interactive'
  parseStreamData(text: string): StateCandidate | null { ... }
  parseScreenSnapshot(screen: string): AgentStatus | null { ... }
  getQuickActions(): QuickAction[] { ... }
  supportsStructuredOutput = false
}
```

Register it in `apps/server/src/index.ts`:
```typescript
adapters.set('mytool', new MyToolAdapter())
```

### Roadmap

- [x] Multi-user support (user management API, session isolation)
- [x] Persistent session state (survive server restarts + restore on re-login)
- [x] Multiple CLI adapters (Claude Code, Aider, Shell)
- [x] File read/write (PUT /api/fs/file)
- [x] OpenAPI/Swagger documentation (/docs)
- [x] Comprehensive test coverage (243+ unit/integration + E2E + component tests)
- [x] Config management (zod schema validation + singleton pattern)
- [x] Security hardening (input validation, path traversal protection, audit logging, atomic writes)
- [x] Multi-session tab management (create / switch / close / attach external tmux)
- [x] File explorer CWD tracking + absolute path browsing + path autocomplete
- [x] Terminal rendering fixes (ANSI escape preservation + reconnect screen restore + resize sync)
- [ ] Proper PWA icons and splash screens
- [ ] Claude approval popup (Feishu card-style dialog)
- [ ] More CLI adapters (Cursor, etc.)

## License

MIT
