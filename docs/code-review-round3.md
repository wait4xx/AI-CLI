# AI-CLI-Mobile 第三轮代码审查报告

**审查日期：** 2026-05-27  
**审查范围：** 全项目源码 + 测试套件 + 依赖安全 + TypeScript 严格模式  
**审查基准：** 第二轮审查报告 `docs/code-review-round2.md`

---

## 一、测试结果

### `pnpm test` 执行结果

**❌ 失败** — `turbo.json` 配置错误导致 turbo 无法解析。

```
turbo_json_parse_error
  x Found an unknown key `tasks`.
```

**根因：** `turbo.json` 使用 `"tasks"` 键（turbo v2 语法），但项目安装的是 `turbo@1.13.4`（使用 `"pipeline"` 键）。`package.json` 中锁定 `"turbo": "^1.13.0"`。

**CI 影响：** GitHub Actions 中 `pnpm test` 步骤会直接失败。

### 手动运行 vitest 结果（apps/server）

| 测试文件 | 通过 | 失败 | 总计 |
|---------|------|------|------|
| health.test.ts | 1 | 0 | 1 |
| security.test.ts | 3 | 0 | 3 |
| fs.test.ts | 6 | 0 | 6 |
| health.test.js (dist) | 1 | 0 | 1 |
| security.test.js (dist) | 3 | 0 | 3 |
| fs.test.js (dist) | 6 | 0 | 6 |
| auth.test.js (dist) | 5 | 0 | 5 |
| **auth.test.ts** | **4** | **1** | **5** |
| **合计** | **29** | **1** | **30** |

### 失败测试详情

**`auth.test.ts` → `should reject invalid refreshToken`**

```
AssertionError: expected 429 to be 401 // Object.is equality
```

**根因：** `authRoutes` 注册了 `@fastify/rate-limit`（5 次/分钟）。前序测试已消耗配额（login × 2 + refresh × 1 + 错误 login × 1 = 4 次），最后一次 refresh 请求触发速率限制返回 429 而非 401。

**修复建议：** 在测试中禁用速率限制，或提高测试环境的限额：

```typescript
async function buildServer() {
  const app = Fastify()
  await app.register(authPlugin)
  // 测试环境禁用速率限制
  app.addHook('onRequest', async (req) => {
    // 注入跳过 rate limit 的标记
  })
  await app.register(authRoutes, { prefix: '/api/auth' })
  return app
}
```

或在 `authRoutes` 中支持通过环境变量禁用：

```typescript
if (process.env.NODE_ENV !== 'test') {
  await fastify.register(rateLimit, { max: 5, timeWindow: '1 minute', ... })
}
```

---

## 二、TypeScript 严格模式检查

| 包 | `tsc --noEmit` | `strict: true` | 结果 |
|----|---------------|----------------|------|
| `@ai-cli/shared` | ✅ 无错误 | ✅ | 通过 |
| `@ai-cli/server` | ✅ 无错误 | ✅ | 通过 |
| `@ai-cli/web` | ✅ 无错误 | ✅ | 通过 |

所有三个包在 `strict: true` 模式下均无类型错误。

---

## 三、依赖安全审计（pnpm audit）

**10 个漏洞**：4 高危 · 4 中危 · 2 低危

### 高危漏洞

| 包 | 漏洞 | 修复版本 | 当前版本 |
|----|------|---------|---------|
| `fastify` | Content-Type header tab 字符绕过 body 验证 | ≥5.7.2 | 4.29.1 |
| `fast-uri` | percent-encoded dot segments 路径遍历 | ≥3.1.1 | 2.4.0 |
| `fast-uri` | percent-encoded authority delimiters 主机混淆 | ≥3.1.2 | 2.4.0 |
| `glob` | CLI `-c/--cmd` 命令注入（shell:true） | ≥10.5.0 | 10.4.5 |

### 中危漏洞

| 包 | 漏洞 | 修复版本 |
|----|------|---------|
| `esbuild` | dev server CORS 未限制 | ≥0.25.0 |
| `fastify` | X-Forwarded-Proto/Host 可伪造 | ≥5.8.3 |
| `vite` | Optimized Deps `.map` 路径遍历 | ≥6.4.2 |
| `turbo` | Login callback CSRF/session fixation | ≥2.9.14 |

### 低危漏洞

| 包 | 漏洞 | 修复版本 |
|----|------|---------|
| `fastify` | sendWebStream 无限制内存分配 DoS | ≥5.7.3 |
| `turbo` | Yarn Berry 检测时意外本地代码执行 | ≥2.9.14 |

### 修复建议

- **fastify**: 当前使用 v4.29.1，多个漏洞修复在 v5.x。升级到 v5 是 breaking change，建议评估迁移成本。短期可通过 `@fastify/helmet` + 严格 CSP + 输入验证缓解。
- **glob**: `@fastify/static@7.0.4` 依赖 glob@10.4.5，升级 `@fastify/static` 可修复。
- **turbo**: 建议升级到 v2.x（同时修复 `turbo.json` 语法问题）。
- **esbuild/vite**: 升级 vite 到最新版本。

---

## 四、第二轮问题修复验证

### ✅ 已修复（5 个第二轮新发现问题）

| 编号 | 问题 | 验证 |
|------|------|------|
| N1 | RECORDING_DATA 类型不匹配 | ✅ `protocol.ts` 已改为 `data: string` |
| N2 | M12 过度阻断代码文件 | ✅ `DANGEROUS_EXTENSIONS` 仅保留二进制文件，.js/.py 等已移除 |
| N3 | sendInjectCode 字符长度 vs 字节长度 | ✅ 改用 `new TextEncoder().encode(code).length` |
| N4 | destroySession 未通知 Terminal 客户端 | ✅ 向 termClients 发送 JSON ERROR 消息后再关闭 |
| N5 | ShellAdapter 手动 split 路径 | ✅ 改用 `path.basename(path.resolve(shell))` |

### ✅ 已修复（第二轮部分修复项）

| 编号 | 问题 | 验证 |
|------|------|------|
| M4 | reconnectCount UI 回归 | ✅ 使用 `useRef` + `useState` 组合，ref 用于内部逻辑，state 用于 UI |
| L9 | XTERM_THEME 缺少 as const | ✅ 已确认修复（第二轮已标记） |

### ⚠️ 仍为部分修复（3 个）

| 编号 | 问题 | 现状 |
|------|------|------|
| S1 | Token 通过 URL Query 传输 | 仍有 upgrade 阶段校验，但 token 仍出现在日志中 |
| S7 | Helmet 未配置自定义 CSP | 仅 `await fastify.register(helmet)`，未配置 directives |
| M18 | Container cap_add SETUID/SETGID | 未变更，注释未更新评估结果 |

### ❌ 仍未修复（4 个）

| 编号 | 问题 | 影响 |
|------|------|------|
| M8 | health.test.ts 与实际路由不一致 | 低（测试仍通过但验证过时行为） |
| M9 | SessionManager/WSGateway 无单元测试 | 高（核心组件无测试覆盖） |
| M14 | AppConfig 缺少环境变量 schema 验证 | 中 |
| M17 | pino logger ESM interop 类型断言 | 低 |

---

## 五、🆕 新发现问题

### 🆕 R1. 🔴 turbo.json 使用 v2 语法但安装 v1 turbo（严重）

**文件：** `turbo.json:4`, `package.json:18`

**问题：** `turbo.json` 使用 `"tasks"` 键（turbo v2 语法），但 `package.json` 声明 `"turbo": "^1.13.0"`（安装了 v1.13.4）。这导致 `turbo run test` 完全失败，CI 流水线中断。

```json
// turbo.json（当前 — 错误）
"tasks": { ... }

// turbo v1 正确语法
"pipeline": { ... }
```

**影响：** `pnpm test`、`pnpm build`、`pnpm lint` 等所有 turbo 命令在 v1 下均失败。

**修复方案（二选一）：**
1. 降级语法：将 `turbo.json` 中的 `"tasks"` 改为 `"pipeline"`
2. 升级 turbo：`pnpm add -Dw turbo@latest`（推荐，同时修复安全漏洞）

---

### 🆕 R2. 🟡 测试夹具受速率限制干扰（中等）

**文件：** `apps/server/src/__tests__/auth.test.ts`

**问题：** `authRoutes` 中注册的 rate limit（5 次/分钟）在测试中生效。测试用例按顺序执行，前序测试消耗了请求配额，导致最后一个测试 `should reject invalid refreshToken` 收到 429 而非 401。

**修复建议：** 在测试环境中通过环境变量或插件选项禁用速率限制。

---

### 🆕 R3. 🟡 dist/ 目录中存在过期编译产物被 vitest 扫描（中等）

**文件：** `apps/server/dist/__tests__/`

**问题：** vitest 配置未排除 `dist/` 目录。当前 `dist/` 中有上一次编译的测试文件（如 `dist/__tests__/auth.test.js`），vitest 同时运行源码测试和编译产物测试，导致：
- 测试数量翻倍（30 个中 15 个是 dist 副本）
- dist 测试可能与源码不同步
- 错误报告混淆

**修复建议：** 在 `apps/server/vitest.config.ts` 中排除 dist：

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['dist/**', 'node_modules/**'],
  },
})
```

---

### 🆕 R4. 🟡 Helmet 未配置严格 CSP（中等）

**文件：** `apps/server/src/index.ts:48`

**问题：** `await fastify.register(helmet)` 使用默认配置，未设置自定义 CSP directives。`vite.config.ts` 中已定义完整的 CSP 策略，但生产环境的 Helmet 未同步。

**修复建议：**

```typescript
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

### 🆕 R5. 🟢 CI 中 `pnpm test` 步骤会因 R1 失败（轻微）

**文件：** `.github/workflows/ci.yml:31`

**问题：** CI 流水线的 `pnpm test` 步骤依赖 turbo，会因 R1（turbo.json 语法错误）而失败。这意味着当前 main 分支的 CI 是红的。

---

### 🆕 R6. 🟢 health.test.ts 测试与实际路由行为不一致（轻微）

**文件：** `apps/server/src/__tests__/health.test.ts:10`

**问题：** 测试断言 `expect(res.json().timestamp).toBeDefined()`，但实际路由（`index.ts:93`）返回 `{ status: 'ok' }` 无 timestamp 字段。测试通过是因为 `toBeDefined()` 在字段不存在时返回 `undefined`（不报错），但实际上验证的是错误行为。

**注意：** health.test.ts 创建了自己的 Fastify 实例，独立于 `index.ts` 中的路由定义，所以测试的并不是真实的 `/health` 端点。

---

## 六、总体评估

### 修复质量评分：8.5/10（较第二轮 7.5 提升）

**进步：**
- 第二轮发现的 5 个新问题（N1-N5）全部修复
- M4（reconnectCount UI 回归）已正确修复
- 代码质量整体提升，类型安全良好

**遗留问题：**
- turbo.json 配置错误导致 CI 中断（R1）
- 测试受速率限制干扰（R2）
- 依赖存在 4 个高危安全漏洞
- 核心组件仍无单元测试（M9）

### 风险矩阵

| 等级 | 问题 | 影响 |
|------|------|------|
| 🔴 严重 | R1 — turbo.json 语法错误 | CI 完全中断，`pnpm test/build/lint` 失败 |
| 🔴 严重 | 依赖漏洞 — fastify v4 多个高危 | 生产环境安全风险 |
| 🟡 中等 | R2 — 测试速率限制干扰 | 测试可靠性降低 |
| 🟡 中等 | R3 — dist 测试重复执行 | 测试效率和准确性 |
| 🟡 中等 | R4 — Helmet 未配置严格 CSP | 生产环境 XSS 防护不足 |
| 🟡 中等 | M9 — 核心组件无测试 | 回归风险高 |
| 🟢 低 | R6 — health test 不一致 | 测试验证的是过时行为 |
| 🟢 低 | 其余未修复项 | 不影响核心功能 |

### 建议下一步

1. **立即修复** R1：将 `turbo.json` 的 `"tasks"` 改为 `"pipeline"`，或升级 turbo 到 v2
2. **立即修复** R2：测试中禁用速率限制
3. **短期修复** R3：vitest 排除 dist 目录
4. **短期修复** R4：配置 Helmet 自定义 CSP
5. **中期规划** fastify v5 升级（解决多个高危漏洞）
6. **中期补充** SessionManager/WSGateway 单元测试（M9）

---

## 七、附录：文件审查覆盖范围

| 目录 | 文件数 | 已审查 | 覆盖率 |
|------|--------|--------|--------|
| apps/server/src/ | 15 | 15 | 100% |
| apps/web/src/ | 14 | 14 | 100% |
| packages/shared/src/ | 1 | 1 | 100% |
| docker/ | 3 | 3 | 100% |
| 根目录配置 | 5 | 5 | 100% |

### 审查覆盖的关键安全点

- [x] JWT 认证流程（登录、刷新、WS 握手）
- [x] Session 所有权校验
- [x] 路径遍历防护（sanitizePath + realpath）
- [x] 文件类型黑名单
- [x] 速率限制配置
- [x] CSP 安全头
- [x] Docker 安全配置（seccomp、cap_drop、资源限制）
- [x] 输入验证（终端尺寸、注入代码大小）
- [x] 依赖安全漏洞
- [x] TypeScript 严格模式
