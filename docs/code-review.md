# AI-CLI-Mobile 代码审查报告

**审查日期：** 2026-05-27  
**审查范围：** 全项目源码（后端、前端、共享包、配置、测试）  
**审查维度：** 安全性、代码质量、架构设计、性能、可靠性、测试覆盖、可维护性、工程化

---

## 一、问题统计

| 严重程度 | 数量 |
|---------|------|
| 🔴 严重 | 10 |
| 🟡 中等 | 18 |
| 🟢 轻微 | 12 |
| **总计** | **40** |

---

## 二、🔴 严重问题（安全漏洞、数据丢失风险）

### S1. WS 认证 Token 通过 URL Query 传输 — 信息泄露

**文件：** `apps/server/src/routes/terminal.ts:10`, `apps/server/src/routes/control.ts:10`

**问题：** JWT access token 通过 `?token=xxx` URL query 参数传递。Token 会出现在：
- 服务器访问日志
- 浏览器历史记录
- HTTP 代理 / CDN 日志
- Referer header 泄露

虽然注释说明"WebSocket 握手阶段无法使用 Authorization header"，但有更安全的替代方案。

**修复建议：** 使用 WebSocket subprotocol 或首条消息传递 token：

```typescript
// 方案A：通过 Sec-WebSocket-Protocol header 传递 token
fastify.get('/ws/terminal', { websocket: true }, (connection, request) => {
  const protocols = request.headers['sec-websocket-protocol']
  const token = protocols?.split(',').map(s => s.trim()).find(s => s.startsWith('jwt.'))
    ?.slice(4)
  if (!token) {
    connection.socket.close(4001, 'Missing token')
    return
  }
  // ... verify token
})

// 方案B：要求客户端在 5s 内发送 AUTH 消息（当前 Terminal channel 已有此逻辑，
// 但 upgrade 阶段不应做验证，应移除 query token 检查，完全依赖首条消息认证）
```

---

### S2. Terminal WS 认证后未绑定用户身份

**文件：** `apps/server/src/core/WSGateway.ts:52-80`

**问题：** `handleTerminalConnection` 中认证成功后，未存储 `JwtPayload`。后续 `ATTACH_SESSION` 消息缺少用户归属校验，任何已认证用户可 attach 到任意 session（即使是其他用户创建的）。

```typescript
// 当前代码（第 65-70 行）— 认证成功后没有保存 payload
if (msg.type === 'AUTH') {
  this.verifyAuth(ws, msg, (payload) => {
    clearTimeout(authTimeout)
    state = WSState.AUTHENTICATED
    // ⚠️ payload 被丢弃，未保存
    ws.send(JSON.stringify({ type: 'AUTH_OK' }))
  })
}
```

**修复建议：**

```typescript
let currentUser: JwtPayload | null = null

// 在 verifyAuth 回调中保存用户信息
this.verifyAuth(ws, msg, (payload) => {
  clearTimeout(authTimeout)
  state = WSState.AUTHENTICATED
  currentUser = payload  // 保存用户身份
  ws.send(JSON.stringify({ type: 'AUTH_OK' }))
})

// ATTACH_SESSION 时校验归属
if (msg.type === 'ATTACH_SESSION' && msg.sessionId) {
  if (!this.sessionManager.hasSession(msg.sessionId)) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
    return
  }
  // 校验会话归属
  const owner = this.sessionManager.getOwner(msg.sessionId)
  if (owner && owner !== currentUser?.userId) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
    return
  }
  // ... attach
}
```

---

### S3. ShellAdapter 命令注入风险

**文件：** `apps/server/src/adapters/shell.ts:7`

**问题：** `startCommand` 直接从 `process.env.SHELL_CMD` 读取，无白名单校验。若环境变量被污染（如 `bash -c "malicious command"`），将直接传给 `pty.spawn('tmux', [..., adapter.startCommand])` 执行。

```typescript
constructor() {
  this.startCommand = process.env.SHELL_CMD || 'bash'  // ⚠️ 无校验
}
```

**修复建议：**

```typescript
const ALLOWED_SHELLS = ['bash', 'sh', 'zsh', 'fish'] as const

constructor() {
  const cmd = process.env.SHELL_CMD || 'bash'
  const baseName = path.basename(cmd)
  if (!ALLOWED_SHELLS.includes(baseName as any)) {
    throw new Error(`SHELL_CMD "${cmd}" is not in the allowed list: ${ALLOWED_SHELLS.join(', ')}`)
  }
  this.startCommand = cmd
}
```

---

### S4. 用户数据文件写入非原子性 — 数据丢失风险

**文件：** `apps/server/src/plugins/auth.ts:35-49` (`saveUsers`)

**问题：** 使用 `fs.writeFileSync` 直接写入目标文件。若写入过程中进程崩溃（OOM kill、断电），文件将被截断或损坏，导致所有用户数据丢失。

```typescript
function saveUsers(): void {
  // ...
  fs.writeFileSync(USERS_FILE_PATH, JSON.stringify(obj, null, 2), 'utf-8')  // ⚠️ 非原子写入
}
```

**修复建议：** 使用 write-then-rename 模式：

```typescript
function saveUsers(): void {
  try {
    const obj: Record<string, StoredUser> = {}
    for (const [key, value] of users.entries()) {
      obj[key] = value
    }
    const dir = path.dirname(USERS_FILE_PATH)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const tmpPath = USERS_FILE_PATH + '.tmp'
    fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8')
    fs.renameSync(tmpPath, USERS_FILE_PATH)  // 原子操作
  } catch (err) {
    pinoLogger.error({ err }, 'Failed to save users file')
  }
}
```

---

### S5. SessionStore 同样存在非原子写入问题

**文件：** `apps/server/src/core/sessionStore.ts:37-49` (`save`)

**问题：** 与 S4 相同，`fs.writeFileSync` 直接写目标文件。

**修复建议：** 同 S4，使用 write-then-rename。

---

### S6. 审计日志 appendFileSync 并发不安全

**文件：** `apps/server/src/core/audit.ts:23`

**问题：** `fs.appendFileSync` 在高并发场景下，多进程/多线程同时写入可能导致日志交错或丢失。且使用同步 I/O 阻塞事件循环。

```typescript
fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n', 'utf-8')  // ⚠️ 同步 + 并发风险
```

**修复建议：** 使用异步写入 + 写入队列：

```typescript
import { createWriteStream, type WriteStream } from 'fs'

let writeStream: WriteStream | null = null

function getWriteStream(): WriteStream {
  if (!writeStream) {
    writeStream = createWriteStream(AUDIT_LOG_PATH, { flags: 'a' })
  }
  return writeStream
}

export function auditLog(event: AuditEvent, userId?: string, details?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    userId: userId ?? null,
    details: details ?? null,
  }
  try {
    getWriteStream().write(JSON.stringify(entry) + '\n')
  } catch (err) {
    pinoLogger.error({ err }, 'Failed to write audit log')
  }
}
```

---

### S7. 生产环境缺少 CSP 响应头

**文件：** `apps/web/vite.config.ts:43-55`（仅开发服务器配置）

**问题：** Content-Security-Policy 仅在 Vite dev server 中配置，生产环境（nginx / Fastify static）没有 CSP 头。这使得生产环境容易受到 XSS 攻击。

**修复建议：** 在 Fastify 层添加 CSP：

```typescript
// apps/server/src/index.ts — 在 helmet 配置中添加
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
})
```

---

### S8. WSGateway 错误处理静默吞掉异常

**文件：** `apps/server/src/core/WSGateway.ts:120-132` (Control message handler)

**问题：** Control channel 的 message handler 使用 `try/catch` 包裹整个消息处理，catch 块为空。这会隐藏所有运行时错误，使问题排查极其困难，也可能掩盖安全相关错误。

```typescript
ws.on('message', (raw: Buffer) => {
  // ...
  try {
    const msg = JSON.parse(raw.toString())
    this.handleControlMessage(ws, msg, currentSessionId, currentUser, (sid) => { currentSessionId = sid })
  } catch {
    // ⚠️ 完全静默 — 任何异常都被吞掉
  }
})
```

**修复建议：**

```typescript
try {
  const msg = JSON.parse(raw.toString())
  this.handleControlMessage(ws, msg, currentSessionId, currentUser, (sid) => { currentSessionId = sid })
} catch (err) {
  pinoLogger.warn({ err }, 'Failed to handle control message')
  ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }))
}
```

---

### S9. Docker Compose 开发环境硬编码凭证

**文件：** `docker/docker-compose.yml:37-42` (app-dev)

**问题：** 开发环境配置中硬编码了 JWT secret 和 admin 密码。虽然有注释警告，但这些凭证可能被提交到版本控制，且开发者可能误用于生产。

```yaml
environment:
  - JWT_SECRET=dev-secret-min-32-characters-long-here
  - JWT_REFRESH_SECRET=dev-refresh-secret-min-32-characters-long
  - ADMIN_PASSWORD=admin  # ⚠️ 弱密码
```

**修复建议：** 使用 `.env.local` 文件（已在 `.gitignore` 中）：

```yaml
# docker-compose.yml
env_file:
  - ../.env.local

# .env.local.example（提交到 git）
JWT_SECRET=<generate with: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate with: openssl rand -hex 32>
ADMIN_PASSWORD=<strong-password-here>
```

---

### S10. authToken 未绑定到 Session — 会话劫持风险

**文件：** `apps/server/src/core/WSGateway.ts` (整体架构)

**问题：** 认证完成后，WS 连接不与特定用户绑定。在 Terminal channel 中，任何认证用户可发送 `ATTACH_SESSION` 连接到其他用户的 session（参见 S2）。Control channel 虽然有 `checkSessionOwnership`，但仅在部分消息类型中检查。

**修复建议：** 在所有需要 session 操作的消息类型中，统一添加 ownership 校验。Terminal channel 的 `ATTACH_SESSION` 也需要校验（参见 S2）。

---

## 三、🟡 中等问题（逻辑错误、性能问题）

### M1. AUTH_TIMEOUT_MS 过短 — 慢网络连接困难

**文件：** `apps/server/src/core/WSGateway.ts:14`

**问题：** 认证超时 5 秒。在高延迟移动网络下（3G/4G），从 WS upgrade 到首条 AUTH 消息可能超过 5 秒。

```typescript
const AUTH_TIMEOUT_MS = 5000  // ⚠️ 对移动网络可能不够
```

**修复建议：** 增加到 10-15 秒：

```typescript
const AUTH_TIMEOUT_MS = 15000
```

---

### M2. SessionManager flushBuffer 背压丢弃消息

**文件：** `apps/server/src/core/SessionManager.ts:174-183`

**问题：** 当客户端 `bufferedAmount > BACKPRESSURE_THRESHOLD` 时，直接跳过该客户端（`continue`）。被跳过的数据永久丢失，客户端会看到终端输出不完整。

```typescript
if (client.bufferedAmount > BACKPRESSURE_THRESHOLD) {
  continue  // ⚠️ 数据永久丢失
}
```

**修复建议：** 实现环形缓冲区或通知客户端暂停：

```typescript
if (client.bufferedAmount > BACKPRESSURE_THRESHOLD) {
  // 发送流控信号，让客户端知道有数据丢失
  client.send(JSON.stringify({ type: 'STATUS_UPDATE', sessionId: session.sessionId, status: session.status, message: 'backpressure' }))
  continue
}
```

---

### M3. OfflineCache 序列化 Uint8Array 数据丢失

**文件：** `apps/web/src/lib/offlineCache.ts:55-60`

**问题：** `persist()` 方法过滤掉了 `Uint8Array` 类型的输入，只保存字符串。这意味着二进制终端输入（如特殊按键序列）在离线缓存后会丢失。

```typescript
const serializableInputs = this.inputQueue.filter((i) => typeof i === 'string')
// ⚠️ Uint8Array 输入被丢弃
```

**修复建议：** 将 Uint8Array 转换为 base64 编码存储：

```typescript
private serializeInput(input: string | Uint8Array): { type: 'string' | 'binary'; data: string } {
  if (typeof input === 'string') return { type: 'string', data: input }
  return { type: 'binary', data: btoa(String.fromCharCode(...input)) }
}

private deserializeInput(serialized: { type: 'string' | 'binary'; data: string }): string | Uint8Array {
  if (serialized.type === 'string') return serialized.data
  return new Uint8Array(atob(serialized.data).split('').map(c => c.charCodeAt(0)))
}
```

---

### M4. useDualChannelWS reconnectCount 导致不必要的重渲染

**文件：** `apps/web/src/hooks/useDualChannelWS.ts:83`

**问题：** `reconnectCount` 使用 `useState` 管理，每次重连都会触发使用该 hook 的组件重渲染。但 `reconnectCount` 仅用于 UI 显示重连次数，可以用 ref 替代。

```typescript
const [reconnectCount, setReconnectCount] = useState(0)  // ⚠️ 触发不必要重渲染
```

**修复建议：**

```typescript
const reconnectCountRef = useRef(0)
// 暴露给 UI 时使用单独的 state 或 context
```

---

### M5. TerminalContainer useEffect 依赖导致频繁重连

**文件：** `apps/web/src/components/TerminalContainer.tsx:152-158`

**问题：** connect 的 `useEffect` 依赖 `[accessToken, sessionId, isConnected, connectionPhase, connect]`。当 `accessToken` 因 token 刷新而变化时，会触发重连。token 刷新（每 15 分钟）不应导致 WS 重连。

```typescript
useEffect(() => {
  if (!termRef.current || !accessToken || !sessionId) return
  if (!isConnected && connectionPhase === 'DISCONNECTED') {
    connect(sessionId, cols, rows, termRef.current)
  }
}, [accessToken, sessionId, isConnected, connectionPhase, connect])  // ⚠️ accessToken 变化触发
```

**修复建议：** 使用 ref 追踪 accessToken，不将其作为 effect 依赖：

```typescript
const accessTokenRef = useRef(accessToken)
accessTokenRef.current = accessToken

useEffect(() => {
  if (!termRef.current || !accessTokenRef.current || !sessionId) return
  if (!isConnected && connectionPhase === 'DISCONNECTED') {
    connect(sessionId, cols, rows, termRef.current)
  }
}, [sessionId, isConnected, connectionPhase, connect])  // 移除 accessToken
```

---

### M6. EXT_LANGUAGE_MAP 缺少 .tsx 映射

**文件：** `apps/server/src/routes/fs.ts:15-24`

**问题：** `.ts` 映射到 `typescript`，但 `.tsx`（React TypeScript）未包含。前端项目大量使用 `.tsx` 文件。

```typescript
const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  // ⚠️ 缺少 .tsx
  '.js': 'javascript',
  // ⚠️ 缺少 .jsx
  // ...
}
```

**修复建议：**

```typescript
const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  // ...
}
```

---

### M7. useSessionStore.reset() 引用比较问题

**文件：** `apps/web/src/store/sessionStore.ts:123`

**问题：** `reset` 函数直接使用 `initialState` 对象引用。Zustand 的 `set` 使用浅比较，直接使用同一对象引用可能导致某些订阅者无法感知变化。

```typescript
reset: () => set(initialState),  // ⚠️ 引用始终相同
```

**修复建议：**

```typescript
reset: () => set({ ...initialState }),  // 创建新对象
```

---

### M8. health.test.ts 与实际路由不一致

**文件：** `apps/server/src/__tests__/health.test.ts`

**问题：** 测试中定义的 health 路由返回 `{ status: 'ok', timestamp: Date.now() }`，但实际 `index.ts` 中的 health 路由只返回 `{ status: 'ok' }`（timestamp 已被移除，参见 W18 修复注释）。测试验证的是过时的行为。

**修复建议：** 更新测试以匹配实际行为：

```typescript
it('should return ok status without timestamp', async () => {
  const app = Fastify()
  app.get('/health', async () => ({ status: 'ok' }))
  const res = await app.inject({ method: 'GET', url: '/health' })
  expect(res.statusCode).toBe(200)
  expect(res.json().status).toBe('ok')
  expect(res.json().timestamp).toBeUndefined()  // W18: 不应泄露时间戳
})
```

---

### M9. 缺少 SessionManager 和 WSGateway 的单元测试

**文件：** `apps/server/src/__tests__/` (整个目录)

**问题：** 当前测试仅覆盖 auth、fs、health、security 路由，核心组件 `SessionManager` 和 `WSGateway` 完全没有测试。这两个组件包含最复杂的业务逻辑（session 管理、WS 认证、消息路由、背压控制等）。

**修复建议：** 至少添加以下测试：
- Session 创建 / 销毁生命周期
- Session ownership 校验
- WS 认证流程（成功 / 失败 / 超时）
- 消息路由正确性
- 背压控制行为

---

### M10. 记录回放数据使用 number[] 而非 Uint8Array

**文件：** `apps/server/src/core/WSGateway.ts:228`

**问题：** `GET_RECORDING` 处理中，将 `Buffer` 转换为 `number[]`（`Array.from(c.data)`）。这会显著增加内存使用和 JSON 序列化/反序列化开销。30 分钟的终端录制可能产生大量数据。

```typescript
const data = chunks.map((c) => ({ data: Array.from(c.data), timestamp: c.timestamp }))
// ⚠️ Buffer → number[] 内存膨胀 ~4x
```

**修复建议：** 使用 base64 编码：

```typescript
const data = chunks.map((c) => ({
  data: c.data.toString('base64'),
  timestamp: c.timestamp,
}))
```

---

### M11. fuseTimers Map 无大小限制 — 内存泄漏

**文件：** `apps/server/src/core/SessionManager.ts:26`

**问题：** `fuseTimers` Map 没有大小限制。如果大量 session 创建并销毁，timer 引用可能累积（虽然 `destroySession` 会清理，但如果 session 异常退出未触发 destroy）。

**修复建议：** 在 `destroySession` 中确保清理，并添加防护：

```typescript
// 在 SessionManager 构造函数中添加定期清理
setInterval(() => {
  for (const [key, timer] of this.fuseTimers.entries()) {
    if (!this.sessions.has(key)) {
      clearTimeout(timer)
      this.fuseTimers.delete(key)
    }
  }
}, 60_000)
```

---

### M12. 文件系统路由缺少 PUT 路由的文件类型限制

**文件：** `apps/server/src/routes/fs.ts:136-165`

**问题：** `PUT /api/fs/file` 可以写入任意文件，包括 `.sh`、`.exe`（如果有执行权限）等可执行文件。虽然有 `sanitizePath` 防止路径遍历，但没有限制可写入的文件类型。

**修复建议：** 添加危险扩展名黑名单：

```typescript
const DANGEROUS_EXTENSIONS = new Set(['.sh', '.bash', '.exe', '.bin', '.command', '.bat', '.ps1'])

// 在 PUT handler 中
const ext = path.extname(resolved).toLowerCase()
if (DANGEROUS_EXTENSIONS.has(ext)) {
  return reply.code(403).send({ error: 'Writing executable files is not allowed' })
}
```

---

### M13. auth.ts 的 bcrypt.hashSync 阻塞事件循环

**文件：** `apps/server/src/routes/auth.ts:20, 94, 119`

**问题：** `bcrypt.hashSync` 是同步操作，在 Fastify 的异步事件循环中会阻塞其他请求处理。虽然 hash cost 只有 10，但在高并发登录场景下可能成为瓶颈。

```typescript
const passwordHash = bcrypt.hashSync(password, 10)  // ⚠️ 同步阻塞
```

**修复建议：** 使用异步版本：

```typescript
const passwordHash = await bcrypt.hash(password, 10)
```

---

### M14. AppConfig 类型缺少环境变量验证

**文件：** `apps/server/src/index.ts`

**问题：** 环境变量（`JWT_SECRET`、`JWT_REFRESH_SECRET`、`ADMIN_PASSWORD`、`PROJECT_ROOT`、`PORT`）没有使用 zod 或 joi 等库进行 schema 验证。缺少变量或格式错误会在运行时才暴露。

**修复建议：** 使用 zod 验证：

```typescript
import { z } from 'zod'

const EnvSchema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.string().min(8),
  PROJECT_ROOT: z.string().default('/workspace'),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const env = EnvSchema.parse(process.env)
```

---

### M15. WebSocket 连接关闭时未通知客户端

**文件：** `apps/server/src/core/WSGateway.ts`

**问题：** 当 session 被 `destroySession` 销毁时，直接调用 `ws.close()` 关闭所有连接，没有先发送关闭原因消息。客户端无法区分"服务器主动关闭"和"网络异常断开"。

```typescript
for (const ws of session.termClients) {
  ws.close()  // ⚠️ 无关闭原因
}
```

**修复建议：**

```typescript
const closePayload = JSON.stringify({ type: 'ERROR', message: 'Session destroyed' })
for (const ws of session.termClients) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(closePayload)
  }
  ws.close(1000, 'Session destroyed')
}
```

---

### M16. Control WS 消息类型校验列表不完整

**文件：** `apps/web/src/hooks/useDualChannelWS.ts:19-23`

**问题：** `CONTROL_MSG_TYPES` 缺少 `RECORDING_DATA` 和 `RECORDING_STATUS` 消息类型。如果服务器发送这些消息，客户端会将其丢弃并打印安全警告。

```typescript
const CONTROL_MSG_TYPES = new Set([
  'AUTH', 'AUTH_OK', 'ATTACH_SESSION', 'INIT_SESSION', 'RESIZE',
  'QUICK_ACTION', 'INJECT_CODE', 'OBSERVE_SESSION', 'PING', 'PONG',
  'STATUS_UPDATE', 'SESSION_READY', 'TOKEN_RENEWED', 'ERROR',
  // ⚠️ 缺少: 'RECORDING_DATA', 'RECORDING_STATUS', 'START_RECORDING', 'STOP_RECORDING', 'GET_RECORDING'
])
```

**修复建议：** 补全消息类型列表。

---

### M17. pino logger ESM interop 类型断言不安全

**文件：** `apps/server/src/lib/logger.ts:2`

**问题：** 使用 `as unknown as` 双重类型断言绕过 ESM/CJS 互操作。虽然能工作，但如果 pino 更新导出结构会导致运行时错误。

```typescript
const pino = pinoPkg as unknown as typeof import('pino') extends { default: infer D } ? D : never
```

**修复建议：** 使用更安全的导入方式或添加运行时检查：

```typescript
import pino from 'pino'
// 如果 tsconfig moduleResolution 支持，直接默认导入即可
```

---

### M18. Container 权限配置可能不足

**文件：** `docker/docker-compose.yml:23-26`

**问题：** `cap_add: SETUID, SETGID` 用于 node-pty 的 tmux 会话管理，但这赋予了容器内进程提权能力。应评估是否真的需要这两个 capability。

```yaml
cap_drop:
  - ALL
cap_add:
  - SETUID  # ⚠️ 允许提权
  - SETGID  # ⚠️ 允许提权
```

**修复建议：** 验证 tmux 是否确实需要这些 capability。如果只是需要 pty 支持，可能只需要 `SYS_ADMIN` 或更好的方式是使用 `--privileged` 的最小替代方案。

---

## 四、🟢 轻微问题（代码风格、可维护性）

### L1. 魔法数字缺乏常量定义

**文件：** `apps/server/src/core/SessionManager.ts`

**问题：** 多处使用硬编码数字，如 `BACKPRESSURE_THRESHOLD = 1048576`、`THROTTLE_MS = 16`、`STATE_FUSE_COOLDOWN_MS = 500`。虽然有注释，但建议统一提取为配置常量。

---

### L2. 命名风格不一致

**文件：** 全项目

**问题：** 文件名混合使用 camelCase（`sessionStore.ts`）、PascalCase（`SessionManager.ts`）、kebab-case（`MobileKeyboardAdapter.ts`）。建议统一为 kebab-case 或 camelCase。

---

### L3. 缺少 JSDoc 注释

**文件：** 核心模块

**问题：** 大部分导出的类和函数缺少 JSDoc 注释。`CLIAdapter` 接口有注释，但实现类（`ClaudeCodeAdapter`、`AiderAdapter`）和核心类（`WSGateway`、`SessionManager`）缺少。

---

### L4. error boundary 重试逻辑过于简单

**文件：** `apps/web/src/components/ErrorBoundary.tsx:43`

**问题：** `handleReset` 只是清除错误状态。如果错误是持久性的（如 API 不可用），重试会立即再次失败。应添加重试次数限制或 exponential backoff。

---

### L5. LoginForm 密码最小长度硬编码

**文件：** `apps/web/src/components/LoginForm.tsx:13`

**问题：** 密码最小长度 6 位硬编码在前端。后端没有对应的验证。应由后端统一校验，前端仅做 UX 提示。

---

### L6. FileExplorer 缺少空状态处理

**文件：** `apps/web/src/components/FileExplorer.tsx:124`

**问题：** 当目录为空且 `currentPath` 不为空时，没有显示空目录提示。只有 `currentPath` 为空时才显示 "Empty directory"。

```tsx
{!state.loading && !state.error && state.entries.length === 0 && !state.currentPath && (
  <p className="text-center text-gray-500 text-sm py-8">Empty directory</p>
)}
```

**修复建议：** 移除 `!state.currentPath` 条件。

---

### L7. vite-env.d.ts 缺少 VITE_ 环境变量类型定义

**文件：** `apps/web/src/vite-env.d.ts`

**问题：** 代码中使用了 `import.meta.env.VITE_API_URL` 和 `import.meta.env.VITE_WS_URL`，但类型声明文件中没有定义这些变量的类型。

**修复建议：**

```typescript
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

---

### L8. GestureHandler 与 MobileKeyboardAdapter 事件冲突

**文件：** `apps/web/src/lib/GestureHandler.ts:72-75`, `apps/web/src/adapters/MobileKeyboardAdapter.ts:107-112`

**问题：** 两者都监听 `touchstart`/`touchend` 事件。虽然 `MobileKeyboardAdapter` 在 `GestureHandler` 的 `touchstart` 之后通过 `suppressNextFocus` 协调，但没有显式的事件优先级机制。如果未来添加更多触摸处理器，可能产生冲突。

---

### L9. theme.ts 颜色常量缺少 TypeScript const 断言

**文件：** `apps/web/src/lib/theme.ts`

**问题：** `THEME_COLORS` 已使用 `as const`，这是正确的。但 `XTERM_THEME_DARK` 和 `XTERM_THEME_LIGHT`（在 `TerminalContainer.tsx` 中）没有使用 `as const`，导致类型被拓宽为 `Record<string, string>`。

---

### L10. CI 流水线缺少前端测试

**文件：** `.github/workflows/ci.yml`

**问题：** CI 中 `pnpm test` 只运行后端测试（`apps/server`），前端（`apps/web`）没有任何测试步骤。

**修复建议：** 添加前端 lint 和类型检查步骤，未来添加组件测试。

---

### L11. pnpm-workspace.yaml 未检查

**文件：** `pnpm-workspace.yaml` (未读取但被引用)

**问题：** turbo.json 中引用了 workspace 依赖，但 pnpm-workspace.yaml 的配置未被审查。

---

### L12. 缺少 .gitignore 审查

**文件：** `.gitignore`

**问题：** 未审查 `.gitignore` 是否正确排除了 `.users.json`、`.sessions.json`、`.audit.log`、`.env.local` 等敏感文件。这些文件如果被意外提交到 git，将造成安全风险。

---

## 五、优先修复清单（按优先级排序）

| 优先级 | 编号 | 问题 | 影响 | 修复难度 |
|-------|------|------|------|---------|
| P0 | S2 | Terminal WS 未绑定用户身份 | 会话劫持 | 低 |
| P0 | S3 | ShellAdapter 命令注入 | RCE | 低 |
| P0 | S10 | Session ownership 校验不完整 | 越权访问 | 中 |
| P1 | S1 | WS token URL 泄露 | Token 窃取 | 中 |
| P1 | S4/S5 | 非原子文件写入 | 数据丢失 | 低 |
| P1 | S6 | 审计日志并发不安全 | 日志丢失 | 中 |
| P1 | S7 | 生产环境缺少 CSP | XSS 攻击 | 低 |
| P1 | S9 | 硬编码凭证 | 凭证泄露 | 低 |
| P1 | M13 | bcrypt.hashSync 阻塞 | 性能瓶颈 | 低 |
| P2 | M1 | AUTH_TIMEOUT 过短 | 连接失败 | 低 |
| P2 | M2 | 背压丢弃消息 | 输出不完整 | 中 |
| P2 | M3 | 离线缓存数据丢失 | 功能缺陷 | 中 |
| P2 | M5 | Token 刷新触发重连 | 不必要重连 | 低 |
| P2 | M6 | .tsx 语言映射缺失 | 功能缺陷 | 低 |
| P2 | M9 | 缺少核心组件测试 | 回归风险 | 高 |
| P2 | M12 | 文件类型限制缺失 | 安全风险 | 低 |
| P2 | M16 | 消息类型校验不完整 | 功能缺陷 | 低 |
| P3 | M4 | reconnectCount 重渲染 | 性能 | 低 |
| P3 | M7 | reset 引用问题 | 潜在 bug | 低 |
| P3 | M8 | 测试与实际不一致 | 测试可靠性 | 低 |
| P3 | M10 | 录制数据内存膨胀 | 内存使用 | 中 |
| P3 | M11 | fuseTimers 内存泄漏 | 长期内存增长 | 低 |
| P3 | M14 | 环境变量无 schema 验证 | 运行时错误 | 中 |
| P3 | M15 | 关闭连接无原因通知 | 调试困难 | 低 |
| P3 | M17 | pino ESM interop | 潜在类型错误 | 低 |
| P3 | M18 | Container 权限过大 | 安全风险 | 中 |
| P4 | L1-L12 | 代码风格 / 可维护性 | 开发体验 | 低 |

---

## 六、架构改进建议

### 1. 统一认证层

当前认证分散在三个地方：
- HTTP 路由：`plugins/auth.ts` 的 `onRequest` hook
- Control WS：`routes/control.ts` 的 upgrade 阶段 + `WSGateway.ts` 的首条消息
- Terminal WS：`routes/terminal.ts` 的 upgrade 阶段 + `WSGateway.ts` 的首条消息

**建议：** 抽取统一的 `AuthService` 类，封装 JWT 验证、token 刷新、用户绑定逻辑：

```typescript
class AuthService {
  verifyToken(token: string): JwtPayload
  refreshToken(refreshToken: string): TokenPair
  bindToSession(ws: WebSocket, user: JwtPayload, sessionId: string): boolean
}
```

### 2. Session 生命周期管理

当前 `SessionManager` 职责过重：管理 pty 进程、WS 连接、录制、状态融合、背压控制。建议拆分为：
- `SessionRegistry` — session CRUD + ownership
- `PtyManager` — pty 生命周期
- `BroadcastManager` — WS 广播 + 背压
- `StateFusion` — 状态检测

### 3. 前端状态管理重构

当前 `useSessionStore`（Zustand）承载了过多状态：连接状态、认证 token、终端设置、session 列表。建议拆分为：
- `useAuthStore` — token 管理
- `useConnectionStore` — WS 连接状态
- `useSessionStore` — session 列表 + 切换
- `useSettingsStore` — 字体、主题等

### 4. 错误处理策略

当前错误处理不一致：
- 有些地方用 `try/catch` 静默吞掉（WSGateway message handler）
- 有些地方用 `pinoLogger.error`（auth.ts）
- 有些地方用 `auditLog`（routes）
- 前端有些用 `console.error`，有些用 `console.warn`

**建议：** 定义统一的错误处理策略：
- 安全相关错误 → `auditLog` + `pinoLogger.warn`
- 运行时错误 → `pinoLogger.error`
- 客户端错误 → 发送 `ERROR` 消息
- 前端错误 → 统一 error reporter（未来接入 Sentry 等）

### 5. 添加 API Schema 验证

当前所有请求体都使用 `as { ... }` 类型断言，没有任何运行时验证。建议使用 Fastify 的 JSON Schema 验证或 zod：

```typescript
fastify.post('/login', {
  schema: {
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', minLength: 1, maxLength: 64 },
        password: { type: 'string', minLength: 6, maxLength: 128 },
      },
    },
  },
}, async (request, reply) => {
  // request.body 已经被验证和类型化
})
```

### 6. 考虑引入 WebSocket 库

当前手动管理 WS 连接状态、重连、心跳。建议考虑使用 `reconnecting-websocket` 或自定义封装，减少 `useDualChannelWS` 中的状态管理复杂度（当前 600+ 行）。

---

## 七、总结

项目整体架构合理，monorepo 结构清晰，前后端分离良好。安全方面已做了不少工作（JWT、bcrypt、rate-limit、path traversal 防护、CORS、Helmet、seccomp 等），但存在一些关键遗漏：

1. **最严重的问题**是 Terminal WS channel 缺少 session ownership 校验（S2），以及 ShellAdapter 的命令注入风险（S3）。
2. **数据持久化**方面，用户数据和 session 数据的非原子写入（S4/S5）在生产环境中可能导致数据丢失。
3. **测试覆盖**严重不足，核心组件（SessionManager、WSGateway）没有单元测试。
4. **前端**的 WS 重连逻辑过于复杂（600+ 行），建议重构为更模块化的设计。

建议按优先级清单从 P0 开始修复，预计 P0+P1 的修复工作量约 2-3 天。
