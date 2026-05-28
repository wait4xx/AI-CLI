# 后端框架与 API 设计

> 📖 本篇是学习指南的第十篇，面向初级程序员，从零开始讲解后端框架选型、API 设计、认证授权、WebSocket 服务端开发等核心知识。
> 所有示例均来自 AI-CLI-Mobile 项目的真实代码，让你在学理论的同时看懂实际项目是怎么做的。

---

## 目录

- [第一章：RESTful API 设计原则](#第一章restful-api-设计原则)
- [第二章：Fastify 框架入门](#第二章fastify-框架入门)
- [第三章：Fastify 中间件与钩子](#第三章fastify-中间件与钩子)
- [第四章：请求验证](#第四章请求验证)
- [第五章：认证与授权](#第五章认证与授权)
- [第六章：WebSocket 服务端开发](#第六章websocket-服务端开发)
- [第七章：错误处理与日志](#第七章错误处理与日志)
- [第八章：文件系统 API](#第八章文件系统-api)

---

# 第一章：RESTful API 设计原则

## 1.1 什么是 REST？

REST（Representational State Transfer）是一种 API 设计风格，不是协议。它用 HTTP 方法来表达"做什么"，用 URL 来表达"对谁做"。

> 💡 **通俗理解**：REST 就是让 URL 变成"名词"，HTTP 方法变成"动词"。
> 比如"查看用户列表"不是 `GET /getUsers`，而是 `GET /users`——`users` 是名词，`GET` 是动词。

### REST 的核心约束

```mermaid
graph TD
    A[REST 架构约束] --> B[客户端-服务器分离]
    A --> C[无状态]
    A --> D[可缓存]
    A --> E[统一接口]
    A --> F[分层系统]
    
    E --> E1[资源标识 - URL]
    E --> E2[资源表示 - JSON]
    E --> E3[自描述消息 - HTTP 方法]
    E --> E4[超媒体驱动 - HATEOAS]
    
    style A fill:#e1f5fe
    style E fill:#fff3e0
```

| 约束 | 含义 | 项目中的体现 |
|------|------|-------------|
| 客户端-服务器 | 前后端分离 | 前端（apps/web）和后端（apps/server）独立部署 |
| 无状态 | 每次请求携带完整信息 | JWT Token 放在 Header 中，服务端不存储 session |
| 统一接口 | 用标准 HTTP 方法操作资源 | GET/POST/PUT/DELETE 对应 CRUD |
| 可缓存 | 响应可被缓存 | 静态文件通过 @fastify/static 提供缓存头 |
| 分层系统 | 客户端不需要知道是否直连服务器 | Nginx → Fastify → PTY 的多层架构 |

## 1.2 HTTP 方法语义

HTTP 定义了多种方法，每种方法有明确的语义：

```mermaid
graph LR
    subgraph "安全方法（不修改数据）"
        GET["GET<br/>读取资源"]
        HEAD["HEAD<br/>读取头部"]
        OPTIONS["OPTIONS<br/>查询支持的方法"]
    end
    
    subgraph "幂等方法（多次调用结果相同）"
        PUT["PUT<br/>整体替换"]
        DELETE["DELETE<br/>删除资源"]
    end
    
    subgraph "非幂等方法"
        POST["POST<br/>创建/提交"]
        PATCH["PATCH<br/>部分修改"]
    end
    
    style GET fill:#c8e6c9
    style HEAD fill:#c8e6c9
    style OPTIONS fill:#c8e6c9
    style PUT fill:#fff9c4
    style DELETE fill:#fff9c4
    style POST fill:#ffcdd2
    style PATCH fill:#ffcdd2
```

### 详细对比表

| 方法 | 语义 | 幂等性 | 安全性 | 典型用途 | 项目示例 |
|------|------|--------|--------|---------|---------|
| **GET** | 读取资源 | ✅ 幂等 | ✅ 安全 | 查询数据 | `GET /api/fs/tree` 获取目录列表 |
| **POST** | 创建资源/执行操作 | ❌ 非幂等 | ❌ 不安全 | 提交表单、创建数据 | `POST /api/auth/login` 用户登录 |
| **PUT** | 整体替换资源 | ✅ 幂等 | ❌ 不安全 | 更新整个资源 | `PUT /api/fs/file` 写入文件 |
| **DELETE** | 删除资源 | ✅ 幂等 | ❌ 不安全 | 删除数据 | `DELETE /api/auth/users/:username` 删除用户 |
| **PATCH** | 部分修改资源 | ❌ 非幂等 | ❌ 不安全 | 更新部分字段 | 本项目未使用 |
| **HEAD** | 获取响应头 | ✅ 幂等 | ✅ 安全 | 检查资源是否存在 | 本项目未使用 |
| **OPTIONS** | 查询支持的方法 | ✅ 幂等 | ✅ 安全 | CORS 预检请求 | CORS 中间件自动处理 |

> ⚠️ **初学者常见错误**：用 GET 来删除数据（如 `GET /api/deleteUser?id=123`）。
> 这违反了 REST 语义——GET 应该是"安全的"，不应该有副作用。

### 什么是幂等性？

**幂等**意味着：同一个请求执行一次和执行多次，效果完全一样。

```
PUT /api/fs/file  {"path": "hello.txt", "content": "world"}

执行 1 次：hello.txt 内容 = "world"
执行 5 次：hello.txt 内容 = "world"  ← 结果一样，所以 PUT 是幂等的

POST /api/auth/login  {"username": "admin", "password": "123"}

执行 1 次：返回 token
执行 5 次：返回 5 个不同的 token  ← 结果不一样，所以 POST 不是幂等的
```

## 1.3 HTTP 状态码选择指南

状态码告诉客户端"发生了什么"。选对状态码是 API 设计的基本功。

### 状态码分类

```mermaid
graph TD
    A[HTTP 状态码] --> B["1xx 信息性<br/>（很少用）"]
    A --> C["2xx 成功 ✅"]
    A --> D["3xx 重定向"]
    A --> E["4xx 客户端错误 ❌"]
    A --> F["5xx 服务端错误 💥"]
    
    C --> C1["200 OK"]
    C --> C2["201 Created"]
    C --> C3["204 No Content"]
    
    E --> E1["400 Bad Request"]
    E --> E2["401 Unauthorized"]
    E --> E3["403 Forbidden"]
    E --> E4["404 Not Found"]
    E --> E4b["409 Conflict"]
    E --> E5["413 Payload Too Large"]
    E --> E6["429 Too Many Requests"]
    
    F --> F1["500 Internal Server Error"]
    
    style C fill:#c8e6c9
    style E fill:#ffcdd2
    style F fill:#ff8a80
```

### 常用状态码详解

| 状态码 | 含义 | 什么时候用 | 项目中的使用 |
|--------|------|-----------|-------------|
| **200** | OK | 请求成功，返回数据 | `GET /api/fs/file` 成功读取文件 |
| **201** | Created | 资源创建成功 | `POST /api/auth/users` 创建新用户 |
| **400** | Bad Request | 请求参数错误 | 缺少必填字段、格式不对 |
| **401** | Unauthorized | 未认证（没登录或 token 无效） | JWT 过期、密码错误 |
| **403** | Forbidden | 已认证但权限不足 | 非管理员访问管理接口、路径穿越被拦截 |
| **404** | Not Found | 资源不存在 | 文件不存在、用户不存在 |
| **409** | Conflict | 资源冲突 | 创建已存在的用户名 |
| **413** | Payload Too Large | 请求体太大 | 文件内容超过 1MB |
| **429** | Too Many Requests | 请求频率超限 | 登录接口限流 5次/分钟 |
| **500** | Internal Server Error | 服务器内部错误 | 文件写入失败、未知异常 |

> 💡 **401 vs 403 的区别**（初学者最容易混淆的两个状态码）：
> - **401 Unauthorized** = "你是谁？"（没登录或 token 过期）
> - **403 Forbidden** = "我知道你是谁，但你没权限"（权限不够）

### 项目中的状态码使用示例

```typescript
// 来自 apps/server/src/routes/auth.ts
// POST /api/auth/login 的状态码选择逻辑

// 400 - 请求参数不完整
if (!username || !password) {
  return reply.code(400).send({ error: 'Username and password required' })
}

// 401 - 用户不存在（不暴露"用户不存在"这个信息，统一返回"凭证无效"）
const user = getUser(username)
if (!user) {
  return reply.code(401).send({ error: 'Invalid credentials' })
}

// 401 - 密码错误
const valid = await bcrypt.compare(password, user.passwordHash)
if (!valid) {
  return reply.code(401).send({ error: 'Invalid credentials' })
}

// 200 - 登录成功
return { accessToken, refreshToken }
```

> 🔒 **安全提示**：登录失败时，"用户不存在"和"密码错误"返回相同的 `401 Invalid credentials`。
> 这是为了防止攻击者通过错误信息枚举出系统中存在哪些用户名。

## 1.4 URL 设计规范

### 命名规则

```mermaid
graph TD
    subgraph "✅ 好的 URL 设计"
        G1["GET /api/auth/users"]
        G2["POST /api/auth/users"]
        G3["DELETE /api/auth/users/admin"]
        G4["GET /api/fs/tree?path=src"]
        G5["GET /api/fs/file?path=src/index.ts"]
    end
    
    subgraph "❌ 坏的 URL 设计"
        B1["GET /api/getUsers"]
        B2["POST /api/createUser"]
        B3["GET /api/deleteUser?name=admin"]
        B4["POST /api/readFile"]
    end
    
    style G1 fill:#c8e6c9
    style G2 fill:#c8e6c9
    style G3 fill:#c8e6c9
    style G4 fill:#c8e6c9
    style G5 fill:#c8e6c9
    style B1 fill:#ffcdd2
    style B2 fill:#ffcdd2
    style B3 fill:#ffcdd2
    style B4 fill:#ffcdd2
```

### URL 结构解析

一个完整的 URL 由以下部分组成：

```mermaid
graph LR
    A["https://"] --> B["server.com"]
    B --> C[":3000"]
    C --> D["/api/auth"]
    D --> E["/users"]
    E --> F["/admin"]
    F --> G["?page=1"]
    G --> H["#section"]
    
    A --> A1["协议"]
    B --> B1["主机名"]
    C --> C1["端口"]
    D --> D1["路径前缀"]
    E --> E1["资源名"]
    F --> F1["资源标识"]
    G --> G1["查询参数"]
    H --> H1["锚点"]
    
    style A1 fill:#e3f2fd
    style B1 fill:#e3f2fd
    style C1 fill:#e3f2fd
    style D1 fill:#e8f5e9
    style E1 fill:#e8f5e9
    style F1 fill:#e8f5e9
    style G1 fill:#fff3e0
    style H1 fill:#f3e5f5
```

### 项目 URL 结构详解

```
https://server.com:3000/api/auth/users/admin
│          │          │     │    │     │     │
│          │          │     │    │     │     └── 资源标识符
│          │          │     │    │     └── 资源集合
│          │          │     │    └── 模块前缀
│          │          │     └── API 版本前缀
│          │          └── 端口
│          └── 主机名
└── 协议
```
```

### URL 设计最佳实践

| 规则 | 说明 | 示例 |
|------|------|------|
| 用名词，不用动词 | HTTP 方法已经表达了动作 | ✅ `GET /users` ❌ `GET /getUsers` |
| 用复数名词 | 统一风格 | ✅ `/users` ❌ `/user` |
| 用小写字母 | URL 大小写敏感 | ✅ `/api/auth` ❌ `/api/Auth` |
| 用连字符分隔单词 | 提高可读性 | ✅ `/user-profile` ❌ `/userProfile` |
| 层级用 `/` 表达 | 表达资源的从属关系 | `/users/:username/password` |
| 查询参数用于过滤 | 非层级关系的过滤条件 | `/api/fs/tree?path=src` |
| 版本号放 URL 前缀 | 方便后续升级 | `/api/v1/users`（本项目未使用版本号） |

### 项目中的 URL 设计分析

AI-CLI-Mobile 的 API 分为三大模块：

```mermaid
graph LR
    subgraph "认证模块 /api/auth/*"
        A1["POST /api/auth/login"]
        A2["POST /api/auth/refresh"]
        A3["GET /api/auth/users"]
        A4["POST /api/auth/users"]
        A5["DELETE /api/auth/users/:username"]
        A6["PUT /api/auth/users/:username/password"]
    end
    
    subgraph "文件系统模块 /api/fs/*"
        B1["GET /api/fs/tree"]
        B2["GET /api/fs/file"]
        B3["PUT /api/fs/file"]
    end
    
    subgraph "WebSocket 通道"
        C1["WS /ws/terminal"]
        C2["WS /ws/control"]
    end
    
    subgraph "系统"
        D1["GET /health"]
        D2["GET /docs"]
    end
    
    style A1 fill:#e3f2fd
    style A2 fill:#e3f2fd
    style B1 fill:#e8f5e9
    style B2 fill:#e8f5e9
    style C1 fill:#fff3e0
    style C2 fill:#fff3e0
```

### API 完整列表

| 方法 | 路径 | 功能 | 认证 | 限流 |
|------|------|------|------|------|
| `GET` | `/health` | 健康检查 | ❌ | ❌ |
| `GET` | `/docs` | Swagger 文档 | ❌ | ❌ |
| `POST` | `/api/auth/login` | 用户登录 | ❌ | ✅ 5次/分钟 |
| `POST` | `/api/auth/refresh` | 刷新 Token | ❌ | ❌ |
| `GET` | `/api/auth/users` | 获取用户列表 | ✅ 管理员 | ❌ |
| `POST` | `/api/auth/users` | 创建用户 | ✅ 管理员 | ❌ |
| `DELETE` | `/api/auth/users/:username` | 删除用户 | ✅ 管理员 | ❌ |
| `PUT` | `/api/auth/users/:username/password` | 修改密码 | ✅ 管理员 | ❌ |
| `GET` | `/api/fs/tree` | 获取目录列表 | ✅ | ✅ 100次/分钟 |
| `GET` | `/api/fs/file` | 读取文件 | ✅ | ✅ 100次/分钟 |
| `PUT` | `/api/fs/file` | 写入文件 | ✅ | ✅ 100次/分钟 |
| `WS` | `/ws/terminal` | 终端 WebSocket | ✅ Token | ❌ |
| `WS` | `/ws/control` | 控制 WebSocket | ✅ Token | ❌ |

### RESTful 响应格式约定

项目采用统一的 JSON 响应格式：

```typescript
// 成功响应 —— 直接返回数据
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

// 成功响应 —— 带列表
{
  "users": [
    { "userId": "xxx", "username": "admin", "createdAt": "2024-01-01T00:00:00Z" }
  ]
}

// 错误响应 —— 统一用 error 字段
{
  "error": "Invalid credentials"
}
```

> 💡 项目没有使用 `{ code, data, message }` 这种包装格式，而是直接返回数据或错误。
> 这种风格更简洁，在小型项目中很常见。

### 常见的响应格式对比

| 格式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 直接返回数据 | 简洁、直观 | 无法统一处理错误码 | 小型项目、内部 API |
| `{ code, data, message }` | 统一、前端易处理 | 冗余、不够 RESTful | 大型项目、公开 API |
| `{ data, errors }` | 符合 JSON:API 规范 | 学习成本高 | 企业级 API |

## 1.5 RESTful API 设计常见错误

### 错误 1：URL 中包含动词

```mermaid
graph LR
    subgraph "❌ 错误"
        E1["GET /api/getUsers"]
        E2["POST /api/createUser"]
        E3["GET /api/deleteUser?id=1"]
        E4["POST /api/updateUser"]
    end
    
    subgraph "✅ 正确"
        G1["GET /api/users"]
        G2["POST /api/users"]
        G3["DELETE /api/users/1"]
        G4["PUT /api/users/1"]
    end
    
    style E1 fill:#ffcdd2
    style E2 fill:#ffcdd2
    style E3 fill:#ffcdd2
    style E4 fill:#ffcdd2
    style G1 fill:#c8e6c9
    style G2 fill:#c8e6c9
    style G3 fill:#c8e6c9
    style G4 fill:#c8e6c9
```

### 错误 2：错误的状态码使用

```typescript
// ❌ 错误：所有响应都返回 200
app.get('/api/users/:id', (req, res) => {
  const user = findUser(req.params.id)
  if (!user) {
    // 不应该返回 200 + 错误信息
    return res.status(200).json({ success: false, message: 'User not found' })
  }
  res.json(user)
})

// ✅ 正确：使用语义化的状态码
fastify.get('/users/:id', async (request, reply) => {
  const user = findUser(request.params.id)
  if (!user) {
    return reply.code(404).send({ error: 'User not found' })
  }
  return user
})
```

### 错误 3：不一致的命名风格

```typescript
// ❌ 错误：混用驼峰和下划线
{
  "user_name": "admin",     // 下划线
  "createdAt": "2024-01-01", // 驼峰
  "is_active": true          // 下划线
}

// ✅ 正确：统一使用驼峰（JavaScript/TypeScript 社区惯例）
{
  "userName": "admin",
  "createdAt": "2024-01-01",
  "isActive": true
}
```

### 错误 4：忽略分页

```typescript
// ❌ 错误：返回所有数据
GET /api/users → { users: [...10000条数据...] }

// ✅ 正确：支持分页
GET /api/users?page=1&limit=20 → {
  "users": [...20条数据...],
  "total": 10000,
  "page": 1,
  "limit": 20,
  "totalPages": 500
}
```

### 错误 5：忽略版本控制

```typescript
// ❌ 错误：破坏性变更影响所有客户端
GET /api/users → { name: "admin" }  // v1
GET /api/users → { fullName: "admin" }  // v2，破坏了 v1 客户端

// ✅ 正确：使用版本号
GET /api/v1/users → { name: "admin" }
GET /api/v2/users → { fullName: "admin" }
```

## 1.6 REST vs GraphQL vs gRPC 对比

除了 REST，还有其他 API 设计风格：

```mermaid
graph TD
    A[API 设计风格] --> B[REST]
    A --> C[GraphQL]
    A --> D[gRPC]
    
    B --> B1["基于 HTTP 方法和 URL"]
    B --> B2["JSON 数据格式"]
    B --> B3["最广泛使用"]
    
    C --> C1["客户端定义查询"]
    C --> C2["单一端点"]
    C --> C3["避免过度获取"]
    
    D --> D1["基于 HTTP/2"]
    D --> D2["Protocol Buffers"]
    D --> D3["高性能微服务"]
    
    style B fill:#e8f5e9
    style C fill:#e3f2fd
    style D fill:#fff3e0
```

| 特性 | REST | GraphQL | gRPC |
|------|------|---------|------|
| 数据格式 | JSON | JSON | Protobuf（二进制） |
| 传输协议 | HTTP/1.1+ | HTTP/1.1+ | HTTP/2 |
| 数据获取 | 固定结构 | 按需获取 | 固定结构 |
| 学习曲线 | 低 | 中 | 高 |
| 工具生态 | 最成熟 | 快速成长 | 成熟 |
| 适用场景 | 通用 Web API | 复杂数据查询 | 微服务间通信 |
| 实时支持 | 需 WebSocket | Subscription | 流式 RPC |
| 浏览器支持 | 原生 | 原生 | 需 grpc-web |

> 💡 **为什么项目选择 REST？**
> 1. 简单直接——API 数量不多（~10 个），不需要 GraphQL 的灵活性
> 2. WebSocket 已经处理了实时通信需求
> 3. 前端是 SPA，不需要 gRPC 的高性能
> 4. REST 的工具链（Swagger、Postman）最成熟

---

# 第二章：Fastify 框架入门

## 2.1 为什么选择 Fastify？

Node.js 有多个 HTTP 框架可选，项目选择了 Fastify。我们来对比一下主流框架：

### 框架对比

```mermaid
graph LR
    subgraph "Node.js HTTP 框架"
        Express["Express<br/>最老牌"]
        Koa["Koa<br/>Express 原班人马"]
        Fastify["Fastify<br/>高性能"]
        Hono["Hono<br/>新一代"]
    end
    
    Express -->|中间件模型| E1["回调地狱风险"]
    Koa -->|洋葱模型| K1["async/await"]
    Fastify -->|插件+钩子| F1["类型安全+高性能"]
    Hono -->|轻量| H1["边缘计算"]
    
    style Fastify fill:#e8f5e9
```

| 特性 | Express | Koa | Fastify | Hono |
|------|---------|-----|---------|------|
| **发布年份** | 2010 | 2013 | 2016 | 2022 |
| **性能** | 中等 | 中等 | ⭐ 高 | ⭐ 高 |
| **TypeScript 支持** | 一般（@types） | 一般 | ⭐ 原生 | ⭐ 原生 |
| **JSON Schema 验证** | 需第三方 | 需第三方 | ⭐ 内置 | 需第三方 |
| **插件系统** | 中间件 | 中间件 | ⭐ 封装式插件 | 中间件 |
| **Swagger/OpenAPI** | 需手动 | 需手动 | ⭐ 官方插件 | 需第三方 |
| **日志** | 需 morgan/winston | 需第三方 | ⭐ 内置 pino | 需第三方 |
| **WebSocket** | 需 ws + 升级 | 需第三方 | ⭐ @fastify/websocket | 内置 |
| **学习曲线** | 低 | 低 | 中 | 低 |
| **npm 周下载量** | ~3000 万 | ~100 万 | ~300 万 | ~50 万 |

### Fastify 的核心优势

```mermaid
graph TD
    A[Fastify 核心优势] --> B[性能]
    A --> C[类型安全]
    A --> D[插件封装]
    A --> E[Schema 验证]
    A --> F[日志内置]
    
    B --> B1["JSON 序列化速度是 Express 的 2-3 倍"]
    B --> B2["底层使用 find-my-way 路由库"]
    
    C --> C1["TypeScript-first 设计"]
    C --> C2["decorate() 类型安全扩展"]
    
    D --> D1["fastify-plugin 避免封装作用域"]
    D --> D2["插件自动加载和排序"]
    
    E --> E1["JSON Schema 自动验证请求/响应"]
    E --> E2["验证失败自动生成 400 错误"]
    
    F --> F1["内置 pino 高性能日志"]
    F --> F2["生产环境自动 JSON 格式"]
    
    style A fill:#e1f5fe
```

> 💡 **为什么项目选择 Fastify？**
> 1. **性能**：AI-CLI-Mobile 需要处理大量 WebSocket 消息，Fastify 的低开销很重要
> 2. **类型安全**：TypeScript 项目需要框架级别的类型支持
> 3. **插件生态**：@fastify/websocket、@fastify/swagger 等官方插件质量高
> 4. **Schema 验证**：内置的 JSON Schema 验证让 API 文档和验证一体化

## 2.2 创建 Fastify 实例

来看项目的入口文件是怎么初始化 Fastify 的：

```typescript
// apps/server/src/index.ts（简化版）

import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import { pinoLogger } from './lib/logger.js'

// 创建 Fastify 实例，传入自定义的 pino logger
const fastify = Fastify({ loggerInstance: pinoLogger })

async function start() {
  // 注册插件
  await fastify.register(cors, { origin: true })
  await fastify.register(helmet)
  await fastify.register(websocket)
  
  // 注册路由
  await fastify.register(authRoutes, { prefix: '/api/auth' })
  await fastify.register(fsRoutes, { prefix: '/api/fs' })
  await fastify.register(terminalRoutes)
  await fastify.register(controlRoutes)
  
  // 启动服务器
  await fastify.listen({ port: 3000, host: '0.0.0.0' })
}

start()
```

### `Fastify()` 构造函数参数

| 参数 | 类型 | 说明 | 项目用法 |
|------|------|------|---------|
| `logger` | `boolean` | 是否启用内置日志 | 未使用（用自定义 logger） |
| `loggerInstance` | `pino.Logger` | 自定义 pino 实例 | ✅ 传入 `pinoLogger` |
| `trustProxy` | `boolean` | 是否信任代理头 | 未设置 |
| `bodyLimit` | `number` | 请求体大小限制 | 未设置（用默认 1MB） |
| `connectionTimeout` | `number` | 连接超时 | 未设置 |

## 2.3 路由注册与处理

### 基本路由注册

Fastify 有多种注册路由的方式：

```typescript
// 方式 1：直接在实例上注册（适合简单场景）
fastify.get('/health', async () => ({ status: 'ok' }))

// 方式 2：使用路由函数（适合模块化）✅ 项目使用这种方式
async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    // 处理逻辑
  })
  fastify.get('/users', async (request, reply) => {
    // 处理逻辑
  })
}

// 注册时指定前缀
await fastify.register(authRoutes, { prefix: '/api/auth' })
// 最终路径：/api/auth/login, /api/auth/users
```

### 路由处理函数签名

```typescript
// Fastify 路由处理函数的完整签名
fastify.get('/path', {
  // 路由选项
  schema: { ... },        // JSON Schema 验证
  preHandler: async () => {},  // 前置钩子
  // ...
}, async (request, reply) => {
  // request —— 请求对象
  //   request.body     —— 请求体（POST/PUT）
  //   request.query    —— 查询参数（?key=value）
  //   request.params   —— 路径参数（:id）
  //   request.headers  —— 请求头
  //   request.user     —— 解码后的 JWT payload（由 auth 插件注入）
  
  // reply —— 响应对象
  //   reply.code(201)       —— 设置状态码
  //   reply.send(data)      —— 发送响应
  //   reply.type('text/html') —— 设置 Content-Type
  
  return { data: 'hello' }  // 等价于 reply.send({ data: 'hello' })
})
```

### 项目中的路由模块结构

```mermaid
graph TD
    subgraph "index.ts（入口）"
        Entry["Fastify 实例"]
    end
    
    subgraph "插件层"
        AuthPlugin["auth.ts 插件<br/>JWT 验证钩子"]
        CorsPlugin["@fastify/cors"]
        HelmetPlugin["@fastify/helmet"]
        WSPlugin["@fastify/websocket"]
        SwaggerPlugin["@fastify/swagger"]
    end
    
    subgraph "路由层"
        AuthRoutes["routes/auth.ts<br/>/api/auth/*"]
        FSRoutes["routes/fs.ts<br/>/api/fs/*"]
        TermRoutes["routes/terminal.ts<br/>/ws/terminal"]
        CtrlRoutes["routes/control.ts<br/>/ws/control"]
    end
    
    subgraph "核心层"
        WSGateway["WSGateway<br/>WebSocket 网关"]
        SessionMgr["SessionManager<br/>会话管理"]
    end
    
    Entry --> AuthPlugin
    Entry --> CorsPlugin
    Entry --> HelmetPlugin
    Entry --> WSPlugin
    Entry --> SwaggerPlugin
    
    Entry --> AuthRoutes
    Entry --> FSRoutes
    Entry --> TermRoutes
    Entry --> CtrlRoutes
    
    TermRoutes --> WSGateway
    CtrlRoutes --> WSGateway
    WSGateway --> SessionMgr
    
    style Entry fill:#e1f5fe
    style AuthPlugin fill:#fff3e0
    style WSGateway fill:#e8f5e9
```

## 2.4 请求与响应类型定义

### Fastify 的类型扩展

项目通过 TypeScript 的模块声明扩展了 Fastify 的类型：

```typescript
// apps/server/src/types/fastify.d.ts

import { JwtPayload } from '@ai-cli/shared'
import type { WSGateway } from '../core/WSGateway.js'

declare module 'fastify' {
  // 扩展 Request 类型，添加 user 属性
  interface FastifyRequest {
    user?: JwtPayload
  }

  // 扩展 Instance 类型，添加 wsGateway 属性
  interface FastifyInstance {
    wsGateway: WSGateway
  }
}
```

> 💡 **为什么要扩展类型？**
> 默认的 `FastifyRequest` 没有 `user` 属性。auth 插件在验证 JWT 后会把 payload 存到 `request.user`，
> 但 TypeScript 不知道这个属性存在。通过 `declare module` 扩展，我们告诉 TypeScript "request 上有 user"，
> 从而获得完整的类型检查和自动补全。

### 使用 `decorate()` 添加实例属性

```typescript
// apps/server/src/index.ts

// 创建 WSGateway 实例
const wsGateway = new WSGateway(sessionManager, config.JWT_SECRET, config.JWT_REFRESH_SECRET)

// 使用 fastify.decorate() 将 wsGateway 挂载到 fastify 实例上
// 这比 `fastify.wsGateway = wsGateway` 更安全，Fastify 会做类型检查
fastify.decorate('wsGateway', wsGateway)

// 之后在路由中可以这样访问：
// fastify.wsGateway.handleTerminalConnection(socket)
```

### 请求参数的类型断言

由于项目没有使用完整的 JSON Schema 验证（部分路由使用了），很多地方使用类型断言：

```typescript
// 方式 1：类型断言（项目中大部分路由使用这种方式）
const body = request.body as Record<string, unknown>
const username = typeof body.username === 'string' ? body.username : ''

// 方式 2：Schema 验证（更安全，项目中部分路由使用）
fastify.post('/login', {
  schema: {
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
      },
    },
  },
}, async (request) => {
  // 当 Schema 定义后，request.body 会自动获得类型
  // 但项目中为了灵活性，仍然使用了类型断言
})
```

## 2.5 Fastify 插件系统

Fastify 的插件系统是它最强大的特性之一。插件可以：

1. 注册路由
2. 添加钩子（生命周期钩子）
3. 扩展实例（decorate）
4. 封装作用域（encapsulation）

### 插件注册流程

```mermaid
sequenceDiagram
    participant Main as index.ts
    participant FW as Fastify
    participant Plugin as 插件
    participant Route as 路由模块
    
    Main->>FW: Fastify({ loggerInstance })
    Main->>FW: register(cors)
    FW->>FW: 注册 CORS 中间件
    Main->>FW: register(helmet)
    FW->>FW: 注册安全头
    Main->>FW: register(websocket)
    FW->>FW: 注册 WebSocket 支持
    Main->>FW: register(authPlugin)
    FW->>Plugin: 执行插件函数
    Plugin->>FW: 添加 onRequest 钩子
    Main->>FW: register(authRoutes, { prefix: '/api/auth' })
    FW->>Route: 执行路由函数
    Route->>FW: 注册 POST /login, GET /users 等
    Main->>FW: listen({ port: 3000 })
    FW->>FW: 开始监听
```

### fastify-plugin 的作用

```typescript
// apps/server/src/plugins/auth.ts

import fp from 'fastify-plugin'

async function authPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    // JWT 验证逻辑
  })
}

// ⚠️ 关键：使用 fp() 包装
// fastify-plugin 告诉 Fastify：不要把这个插件封装在独立作用域中
// 这样插件中添加的钩子（如 onRequest）对所有路由都生效
export default fp(authPlugin)
```

**封装作用域**是 Fastify 的一个重要概念：

```mermaid
graph TD
    subgraph "不使用 fp()（封装）"
        A[fastify 实例] --> B[插件 A 的作用域]
        B --> C[插件 A 的路由]
        A --> D[插件 B 的作用域]
        D --> E[插件 B 的路由]
        B -.->|"❌ 看不到"| E
        D -.->|"❌ 看不到"| C
    end
    
    subgraph "使用 fp()（不封装）"
        F[fastify 实例] --> G[插件 A 的钩子]
        F --> H[插件 A 的路由]
        F --> I[插件 B 的路由]
        G -.->|"✅ 对所有路由生效"| H
        G -.->|"✅ 对所有路由生效"| I
    end
    
    style B fill:#ffcdd2
    style D fill:#ffcdd2
    style G fill:#c8e6c9
```

> 💡 **简单理解**：
> - 不用 `fp()`：插件的钩子只对**该插件内注册的路由**生效
> - 用 `fp()`：插件的钩子对**整个 Fastify 实例的路由**都生效
>
> 项目中 auth 插件使用 `fp()` 是因为 JWT 验证需要对所有 API 路由生效。

## 2.6 Fastify 与 Express 代码对比

为了帮助有 Express 经验的开发者快速上手，这里做一个详细的代码对比：

### 创建服务器

```typescript
// ─── Express ───
const express = require('express')
const app = express()

app.use(express.json())  // 需要手动配置 JSON 解析
app.use(cors())           // 需要手动配置 CORS

app.listen(3000, () => {
  console.log('Server listening on port 3000')
})

// ─── Fastify ───
import Fastify from 'fastify'
import cors from '@fastify/cors'

const fastify = Fastify({ logger: true })  // 日志内置

await fastify.register(cors)  // CORS 通过插件注册

await fastify.listen({ port: 3000 })  // 支持 async/await
```

### 路由定义

```typescript
// ─── Express ───
app.get('/api/users', (req, res) => {
  const users = getUsers()
  res.json({ users })
})

app.post('/api/users', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' })
  }
  // 创建用户...
  res.status(201).json({ userId: '123' })
})

// ─── Fastify ───
fastify.get('/api/users', async (request, reply) => {
  const users = getUsers()
  return { users }  // 直接返回对象，Fastify 自动序列化
})

fastify.post('/api/users', {
  schema: {  // 内置验证
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string' },
        password: { type: 'string' },
      },
    },
  },
}, async (request, reply) => {
  const { username, password } = request.body
  // 创建用户...
  return reply.code(201).send({ userId: '123' })
})
```

### 中间件 vs 插件

```typescript
// ─── Express 中间件 ───
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.slice(7)
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()  // 手动调用 next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

app.use('/api', authMiddleware)  // 挂载中间件

// ─── Fastify 插件 ───
import fp from 'fastify-plugin'

async function authPlugin(fastify) {
  fastify.addHook('onRequest', async (request, reply) => {
    const token = request.headers.authorization?.slice(7)
    if (!token) {
      return reply.code(401).send({ error: 'No token' })
      // 不需要手动调用 next()，return 即可
    }
    try {
      request.user = jwt.verify(token, SECRET)
    } catch {
      return reply.code(401).send({ error: 'Invalid token' })
    }
  })
}

fastify.register(fp(authPlugin))  // 注册插件
```

### 对比总结表

| 操作 | Express | Fastify |
|------|---------|---------|
| 创建实例 | `express()` | `Fastify({ logger: true })` |
| JSON 解析 | `app.use(express.json())` | 内置 |
| 路由注册 | `app.get(path, handler)` | `fastify.get(path, opts, handler)` |
| 响应发送 | `res.json(data)` | `return data` 或 `reply.send(data)` |
| 状态码 | `res.status(201).json(...)` | `reply.code(201).send(...)` |
| 中间件 | `app.use(fn)` | `fastify.addHook('onRequest', fn)` |
| 错误处理 | `next(err)` | `reply.code(500).send(...)` |
| 参数验证 | 需 express-validator | 内置 JSON Schema |
| 日志 | 需 morgan/winston | 内置 pino |
| 类型安全 | @types/express | 原生 TypeScript |

## 2.7 Fastify 性能优化原理

Fastify 为什么比 Express 快？

### 1. JSON 序列化加速

```mermaid
graph LR
    subgraph "Express"
        E1["JSON.stringify()
        通用序列化"]
    end
    
    subgraph "Fastify"
        F1["fast-json-stringify
        基于 Schema 的序列化"]
        F2["编译时生成序列化函数
        运行时直接调用"]
    end
    
    E1 --> E2["运行时遍历对象
        性能较差"]
    F1 --> F2
    
    style E2 fill:#ffcdd2
    style F2 fill:#c8e6c9
```

Fastify 使用 `fast-json-stringify` 库，它在启动时根据 JSON Schema 编译出专用的序列化函数。这样在运行时就不需要遍历对象结构了，直接按已知格式拼接字符串。

### 2. 路由查找优化

Fastify 使用 `find-my-way` 路由库，它使用**基数树（Radix Tree）**数据结构来存储路由，查找时间复杂度是 O(n)，其中 n 是 URL 路径的长度（不是路由数量）。

```mermaid
graph TD
    Root["/"] --> API["api"]
    API --> Auth["auth"]
    API --> FS["fs"]
    Auth --> Login["login"]
    Auth --> Users["users"]
    Users --> Username[":username"]
    Username --> Password["password"]
    FS --> Tree["tree"]
    FS --> File["file"]
    
    style Root fill:#e1f5fe
    style Login fill:#c8e6c9
    style Users fill:#c8e6c9
    style Tree fill:#c8e6c9
    style File fill:#c8e6c9
```

### 3. 生命周期钩子的优化

Express 的中间件是**链式执行**的，每个中间件都需要手动调用 `next()`。
Fastify 的钩子是**预编译**的，在路由注册时就确定了执行顺序，运行时直接按序执行。

### 性能对比基准测试

```mermaid
graph LR
    subgraph "基准测试结果（req/sec）"
        A["Fastify
~30,000"] --> B["Express
~10,000"]
        B --> C["Koa
~15,000"]
    end
    
    style A fill:#c8e6c9
    style B fill:#ffcdd2
    style C fill:#fff9c4
```

| 框架 | 请求/秒 | 延迟 (p99) | 内存占用 |
|------|---------|-----------|----------|
| Fastify | ~30,000 | ~3ms | 低 |
| Express | ~10,000 | ~10ms | 中 |
| Koa | ~15,000 | ~7ms | 中 |

> ⚠️ **注意**：基准测试结果仅供参考，实际性能取决于业务逻辑、数据库查询等因素。
> 对于大多数应用来说，框架本身的性能差异不是瓶颈。

### Fastify 内存优化

```typescript
// Fastify 使用对象池减少 GC 压力
// 每个请求复用 Request 和 Reply 对象

// ❌ Express：每次请求创建新的 req/res 对象
app.get('/test', (req, res) => {
  // req 和 res 是新创建的对象
  res.json({ ok: true })
})

// ✅ Fastify：复用 Request/Reply 对象
fastify.get('/test', async (request, reply) => {
  // request 和 reply 是复用的对象
  return { ok: true }
})
```

---

# 第三章：Fastify 中间件与钩子

## 3.1 Fastify 生命周期

Fastify 不像 Express 那样使用"中间件链"，而是使用**生命周期钩子**。每个请求都会经过一系列固定的阶段：

```mermaid
graph TD
    A[请求到达] --> B["onRequest<br/>最早的钩子"]
    B --> C["preParsing<br/>解析前"]
    C --> D["preValidation<br/>验证前"]
    D --> E["preHandler<br/>处理前"]
    E --> F["handler<br/>路由处理函数"]
    F --> G["preSerialization<br/>序列化前"]
    G --> H["onSend<br/>发送前"]
    H --> I["onResponse<br/>响应后"]
    
    B -.->|"可选"| C
    D -.->|"可选"| E
    
    style A fill:#e1f5fe
    style F fill:#c8e6c9
    style I fill:#fff3e0
```

### 各钩子的用途

| 钩子 | 执行时机 | 典型用途 | 项目中的使用 |
|------|---------|---------|-------------|
| **onRequest** | 最早，路由匹配前 | 认证、日志、CORS | ✅ JWT 验证 |
| **preParsing** | 请求体解析前 | 修改原始请求体 | 未使用 |
| **preValidation** | Schema 验证前 | 修改验证前的数据 | 未使用 |
| **preHandler** | 路由处理前 | 权限检查、数据预处理 | ✅ requireAdmin |
| **preSerialization** | 响应序列化前 | 修改响应数据 | 未使用 |
| **onSend** | 响应发送前 | 修改响应头、压缩 | 未使用 |
| **onResponse** | 响应发送后 | 清理、日志 | 未使用 |
| **onError** | 发生错误时 | 错误处理 | 未使用 |

### 生命周期钩子与 Express 中间件的区别

```mermaid
graph TD
    subgraph "Express 中间件链"
        E1["请求"] --> E2["中间件 1
next()"] --> E3["中间件 2
next()"] --> E4["路由处理"] --> E5["响应"]
    end
    
    subgraph "Fastify 生命周期钩子"
        F1["请求"] --> F2["onRequest"] --> F3["preParsing"] --> F4["preValidation"] --> F5["preHandler"] --> F6["handler"] --> F7["onSend"] --> F8["onResponse"]
    end
    
    style E2 fill:#fff3e0
    style E3 fill:#fff3e0
    style F2 fill:#e3f2fd
    style F5 fill:#e3f2fd
```

| 特性 | Express 中间件 | Fastify 钩子 |
|------|---------------|-------------|
| 执行模型 | 链式，手动调用 `next()` | 生命周期，自动执行 |
| 错误传播 | 通过 `next(err)` | 通过 `reply.code()` 或 throw |
| 作用域 | 全局或路由级别 | 全局、插件级别或路由级别 |
| 类型安全 | 弱（需手动类型断言） | 强（TypeScript 原生支持） |
| 性能 | 每次请求动态执行 | 预编译，直接执行 |

## 3.2 项目中的 Auth 插件——生命周期钩子实战

Auth 插件是项目中最核心的中间件，它使用 `onRequest` 钩子实现 JWT 认证：

```typescript
// apps/server/src/plugins/auth.ts（完整逻辑）

import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'

// 白名单路径——这些路径不需要认证
const WHITELIST_PATHS = ['/health', '/api/auth/login', '/api/auth/refresh']

async function authPlugin(fastify: FastifyInstance) {
  // 添加 onRequest 钩子——每个请求最先执行的逻辑
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    
    // 1. 提取 URL 路径（去掉查询参数）
    const urlPath = request.url.split('?')[0]
    
    // 2. 白名单路径直接放行
    if (WHITELIST_PATHS.some(p => urlPath === p)) {
      return  // 不做任何检查，直接进入下一个处理阶段
    }

    // 3. 检查 Authorization 头
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' })
    }

    // 4. 提取并验证 JWT
    const token = authHeader.slice(7)  // 去掉 "Bearer " 前缀
    try {
      const decoded = jwt.verify(token, getConfig().JWT_SECRET) as JwtPayload
      request.user = decoded  // 将解码后的用户信息存到 request 上
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }
  })
}

// 使用 fp() 包装，让钩子对所有路由生效
export default fp(authPlugin)
```

### 请求处理流程图

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant FW as Fastify
    participant Auth as Auth 钩子
    participant Handler as 路由处理
    
    Client->>FW: GET /api/fs/tree
    FW->>Auth: onRequest 钩子
    Auth->>Auth: urlPath = "/api/fs/tree"
    Auth->>Auth: 不在白名单中
    Auth->>Auth: 检查 Authorization 头
    Auth->>Auth: 验证 JWT
    Auth->>Auth: request.user = decoded
    
    alt Token 有效
        Auth->>FW: 继续处理
        FW->>Handler: 调用路由处理函数
        Handler->>Handler: 可以使用 request.user
        Handler->>FW: 返回数据
        FW->>Client: 200 { entries: [...] }
    else Token 无效
        Auth->>FW: reply.code(401)
        FW->>Client: 401 { error: "Invalid or expired token" }
    end
```

## 3.3 preHandler 钩子——路由级别的权限控制

除了全局的 `onRequest` 钩子，项目还使用了路由级别的 `preHandler` 钩子来实现管理员权限检查：

```typescript
// apps/server/src/routes/auth.ts

// 定义管理员权限检查函数
async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const adminUsername = getConfig().ADMIN_USERNAME
  // 检查当前用户是否是管理员
  if (!request.user || (request.user as JwtPayload).username !== adminUsername) {
    return reply.code(403).send({ error: 'Admin access required' })
  }
}

// 在特定路由上使用 preHandler
fastify.get('/users', {
  preHandler: requireAdmin,  // 只有管理员能访问
  schema: { ... },
}, async () => {
  const userList = listUsers().map(({ passwordHash: _, ...rest }) => rest)
  return { users: userList }
})
```

### 钩子执行顺序

```mermaid
graph LR
    A["onRequest<br/>（全局 JWT 验证）"] --> B["preHandler<br/>（requireAdmin）"] --> C["handler<br/>（业务逻辑）"]
    
    A -->|"通过"| B
    A -->|"失败 → 401"| X1["返回错误"]
    B -->|"通过"| C
    B -->|"失败 → 403"| X2["返回错误"]
    
    style A fill:#fff3e0
    style B fill:#e3f2fd
    style C fill:#c8e6c9
    style X1 fill:#ffcdd2
    style X2 fill:#ffcdd2
```

> 💡 **onRequest vs preHandler**：
> - `onRequest`：全局的，对所有路由生效，用于认证（"你是谁？"）
> - `preHandler`：路由级别的，只对特定路由生效，用于授权（"你能做什么？"）
>
> 先认证（onRequest），再授权（preHandler），最后执行业务逻辑（handler）。

## 3.4 其他钩子使用场景

### onSend 钩子——响应修改

```typescript
// 示例：添加自定义响应头（项目未使用，但值得了解）
fastify.addHook('onSend', async (request, reply, payload) => {
  reply.header('X-Response-Time', Date.now() - request.startTime)
  return payload  // 必须返回 payload
})
```

### onError 钩子——错误日志

```typescript
// 示例：记录所有错误（项目未使用，但值得了解）
fastify.addHook('onError', async (request, reply, error) => {
  pinoLogger.error({
    err: error,
    url: request.url,
    method: request.method,
  }, 'Request error')
})
```

## 3.5 钩子执行顺序详解

当一个请求到达时，钩子按照以下顺序执行：

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant FW as Fastify 框架
    participant OR as onRequest 钩子
    participant PP as preParsing 钩子
    participant PV as preValidation 钩子
    participant PH as preHandler 钩子
    participant H as handler 处理函数
    participant PS as preSerialization 钩子
    participant OS as onSend 钩子
    participant RS as onResponse 钩子
    
    Client->>FW: HTTP 请求
    FW->>OR: 1. onRequest
    Note over OR: 路由匹配前执行
    Note over OR: 认证、日志、CORS
    OR->>PP: 2. preParsing
    Note over PP: 解析请求体前
    PP->>PV: 3. preValidation
    Note over PV: Schema 验证前
    PV->>PH: 4. preHandler
    Note over PH: 路由处理前
    Note over PH: 权限检查、数据预处理
    PH->>H: 5. handler
    Note over H: 业务逻辑
    H->>PS: 6. preSerialization
    Note over PS: 响应序列化前
    PS->>OS: 7. onSend
    Note over OS: 响应发送前
    OS->>RS: 8. onResponse
    Note over RS: 响应发送后
    RS->>FW: 完成
```

### 钩子中的错误处理

```typescript
// 在钩子中返回错误，后续钩子和 handler 不会执行
fastify.addHook('onRequest', async (request, reply) => {
  // 检查认证
  if (!request.headers.authorization) {
    // 直接返回 401，后续钩子和 handler 都不会执行
    return reply.code(401).send({ error: 'No auth header' })
  }
  
  // 如果这里 throw Error，会被 Fastify 捕获，返回 500
  // throw new Error('Something went wrong')
})

// 路由级别的 preHandler 也可以返回错误
fastify.get('/admin/users', {
  preHandler: async (request, reply) => {
    if (!request.user.isAdmin) {
      return reply.code(403).send({ error: 'Admin only' })
    }
  }
}, async (request) => {
  // 只有管理员能到达这里
  return { users: listUsers() }
})
```

### 多个钩子的执行顺序

```typescript
// 全局钩子（最先执行）
fastify.addHook('onRequest', async (request) => {
  request.startTime = Date.now()
  console.log('全局 onRequest 1')
})

fastify.addHook('onRequest', async (request) => {
  console.log('全局 onRequest 2')
})

// 插件钩子（中间执行）
async function myPlugin(fastify) {
  fastify.addHook('onRequest', async (request) => {
    console.log('插件 onRequest')
  })
  fastify.addHook('preHandler', async (request) => {
    console.log('插件 preHandler')
  })
}
fastify.register(myPlugin)

// 路由钩子（最后执行）
fastify.get('/test', {
  preHandler: async (request) => {
    console.log('路由 preHandler')
  }
}, async (request) => {
  console.log('handler')
  return { ok: true }
})

// 执行顺序：
// 全局 onRequest 1
// 全局 onRequest 2
// 插件 onRequest
// 插件 preHandler
// 路由 preHandler
// handler
```

## 3.6 钩子最佳实践

### 最佳实践 1：在 onRequest 中做认证

```typescript
// ✅ 正确：认证放在 onRequest（全局，路由匹配前执行）
fastify.addHook('onRequest', async (request, reply) => {
  // JWT 验证
})

// ❌ 错误：认证放在 preHandler
// preHandler 在路由匹配后执行，未匹配的路由不会被认证
fastify.addHook('preHandler', async (request, reply) => {
  // JWT 验证（太晚了！）
})
```

### 最佳实践 2：在 preHandler 中做授权

```typescript
// ✅ 正确：授权放在 preHandler（路由级别）
fastify.get('/admin/users', {
  preHandler: requireAdmin  // 只有这个路由需要管理员权限
}, async () => {
  return { users: listUsers() }
})

// ❌ 错误：授权放在 onRequest
// 这会导致所有路由都需要管理员权限
fastify.addHook('onRequest', async (request, reply) => {
  requireAdmin(request, reply)  // 太早了！所有路由都会被拦截
})
```

### 最佳实践 3：在 onSend 中记录响应时间

```typescript
fastify.addHook('onSend', async (request, reply, payload) => {
  const duration = Date.now() - (request.startTime || Date.now())
  pinoLogger.info({
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    duration,
  }, 'Request completed')
  return payload  // 必须返回 payload
})
```

---

# 第四章：请求验证

## 4.1 为什么需要请求验证？

用户发送的请求数据是**不可信的**。如果不验证就直接使用，会导致：

```mermaid
graph TD
    A[未验证的请求数据] --> B[SQL 注入]
    A --> C[路径穿越]
    A --> D[类型错误导致崩溃]
    A --> E[业务逻辑漏洞]
    
    B --> B1["'; DROP TABLE users; --"]
    C --> C1["../../etc/passwd"]
    D --> D1["期望 number，收到 string"]
    E --> E1["密码为空也能注册"]
    
    style A fill:#ffcdd2
```

> 💡 **核心原则**：永远不要信任客户端发来的数据。所有输入都要验证。

## 4.2 验证的层次

```mermaid
graph TD
    A[客户端请求] --> B["第 1 层：类型验证\ntypeof check"]
    B --> C["第 2 层：格式验证\nJSON Schema / Zod"]
    C --> D["第 3 层：业务验证\n自定义逻辑"]
    D --> E["处理请求"]
    
    B -->|"类型不匹配"| F["400 Bad Request"]
    C -->|"格式不合法"| G["400 Bad Request"]
    D -->|"业务规则违反"| H["400/409/422"]
    
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#e8f5e9
```

### 第 1 层：类型验证

最基本的验证，确保数据类型正确：

```typescript
// 手动类型检查（项目中大量使用）
const body = request.body as Record<string, unknown>
const username = typeof body.username === 'string' ? body.username : ''
const password = typeof body.password === 'string' ? body.password : ''

if (!username || !password) {
  return reply.code(400).send({ error: 'Username and password required' })
}
```

### 第 2 层：格式验证

使用 JSON Schema 或 Zod 进行更严格的验证：

```typescript
// JSON Schema 验证（Fastify 内置）
fastify.post('/users', {
  schema: {
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', minLength: 2, maxLength: 32 },
        password: { type: 'string', minLength: 6 },
      },
    },
  },
}, async (request) => {
  // Fastify 已经验证了 body 的类型和格式
  const { username, password } = request.body as { username: string; password: string }
})
```

### 第 3 层：业务验证

业务逻辑层面的验证，通常需要查询数据库或其他外部资源：

```typescript
// 业务验证示例
async (request, reply) => {
  const { username } = request.body
  
  // 检查用户名是否已存在（需要查询存储）
  if (hasUser(username)) {
    return reply.code(409).send({ error: 'User already exists' })
  }
  
  // 检查用户名格式（业务规则）
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return reply.code(400).send({ error: 'Username must be alphanumeric' })
  }
}
```

## 4.3 JSON Schema 验证

Fastify 内置了 JSON Schema 验证。你只需要在路由选项中定义 schema，Fastify 会自动验证请求。

### JSON Schema 基础

```typescript
// 一个完整的 JSON Schema 示例
const schema = {
  // 请求体验证
  body: {
    type: 'object',
    required: ['username', 'password'],  // 必填字段
    properties: {
      username: { 
        type: 'string', 
        minLength: 2, 
        maxLength: 32 
      },
      password: { 
        type: 'string', 
        minLength: 6 
      },
    },
  },
  
  // 查询参数验证
  querystring: {
    type: 'object',
    properties: {
      path: { type: 'string' },
    },
  },
  
  // 路径参数验证
  params: {
    type: 'object',
    properties: {
      username: { type: 'string' },
    },
  },
  
  // 响应体验证（用于文档生成）
  response: {
    200: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
    401: {
      type: 'object',
      properties: {
        error: { type: 'string' },
      },
    },
  },
}
```

### 项目中的 Schema 使用

```typescript
// apps/server/src/routes/auth.ts — POST /api/auth/login

fastify.post('/login', {
  schema: {
    summary: '用户登录',           // Swagger 文档标题
    description: '使用用户名和密码登录', // Swagger 文档描述
    security: [],                   // 覆盖全局安全设置（登录不需要 JWT）
    body: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', description: '用户名' },
        password: { type: 'string', description: '密码' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          accessToken: { type: 'string', description: '访问令牌（15分钟有效）' },
          refreshToken: { type: 'string', description: '刷新令牌（7天有效）' },
        },
      },
      401: {
        type: 'object',
        properties: { error: { type: 'string' } },
      },
    },
  },
}, async (request, reply) => {
  // 路由处理逻辑
})
```

### JSON Schema 类型速查表

| 类型 | 关键字 | 示例 | 说明 |
|------|--------|------|------|
| 字符串 | `type: 'string'` | `{ type: 'string', minLength: 1 }` | 文本 |
| 数字 | `type: 'number'` | `{ type: 'number', minimum: 0 }` | 浮点数 |
| 整数 | `type: 'integer'` | `{ type: 'integer', min: 1, max: 65535 }` | 整数 |
| 布尔 | `type: 'boolean'` | `{ type: 'boolean' }` | true/false |
| 数组 | `type: 'array'` | `{ type: 'array', items: { type: 'string' } }` | 列表 |
| 对象 | `type: 'object'` | `{ type: 'object', properties: { ... } }` | 键值对 |
| 枚举 | `enum` | `{ enum: ['dev', 'prod'] }` | 固定值列表 |
| 联合 | `oneOf` | `{ oneOf: [{ type: 'string' }, { type: 'number' }] }` | 多种类型 |

## 4.3 Zod Schema 验证

项目使用 Zod 来验证**环境变量**。Zod 是一个 TypeScript-first 的验证库，比 JSON Schema 更适合程序化的验证。

### Zod vs JSON Schema 对比

| 特性 | JSON Schema | Zod |
|------|-------------|-----|
| 定义方式 | 声明式对象 | 链式 API |
| TypeScript 类型推导 | 需要额外工具 | ⭐ 内置 `z.infer` |
| 运行时验证 | Fastify 内置 | 需手动调用 |
| 错误信息 | 较通用 | ⭐ 可自定义 |
| 适用场景 | API 请求验证 | 环境变量、配置、复杂数据 |

### Zod 核心概念

```mermaid
graph TD
    A["Zod 核心概念"] --> B["Schema 定义"]
    A --> C["验证"]
    A --> D["类型推导"]
    
    B --> B1["z.string() 字符串"]
    B --> B2["z.number() 数字"]
    B --> B3["z.boolean() 布尔"]
    B --> B4["z.object() 对象"]
    B --> B5["z.array() 数组"]
    B --> B6["z.enum() 枚举"]
    
    C --> C1["schema.parse(data)
验证失败抛异常"]
    C --> C2["schema.safeParse(data)
返回结果对象"]
    
    D --> D1["z.infer<typeof schema>
自动推导 TypeScript 类型"]
    
    style A fill:#e1f5fe
    style C fill:#e8f5e9
    style D fill:#fff3e0
```

### Zod 验证方法对比

```typescript
// 方法 1：parse() —— 验证失败抛异常
try {
  const config = configSchema.parse(process.env)
  // 验证成功
} catch (err) {
  // 验证失败，err 是 ZodError 实例
  console.error(err.issues)
}

// 方法 2：safeParse() —— 返回结果对象（项目使用这种方式）
const result = configSchema.safeParse(process.env)
if (result.success) {
  // 验证成功
  const config = result.data
} else {
  // 验证失败
  const errors = result.error.issues
}
```

| 方法 | 成功 | 失败 | 适用场景 |
|------|------|------|----------|
| `parse()` | 返回数据 | 抛异常 | 快速开发、简单场景 |
| `safeParse()` | `{ success: true, data }` | `{ success: false, error }` | 需要错误处理、生产环境 |
| `parseAsync()` | 返回 Promise | 抛异常 | 异步验证 |
| `safeParseAsync()` | 返回 Promise | 返回结果对象 | 异步验证 + 错误处理 |

### 项目中的 Zod 验证

```typescript
// apps/server/src/lib/config.ts

import { z } from 'zod/v4'

const configSchema = z.object({
  // 必需字段——验证失败会报错
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // 可选字段——有默认值
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PROJECT_ROOT: z.string().default('/workspace'),
  
  // 可选字段——无默认值
  ADMIN_PASSWORD: z.union([
    z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'), 
    z.literal('')
  ]).optional(),
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
})

// 自动推导 TypeScript 类型
export type AppConfig = z.infer<typeof configSchema>
// 等价于：
// type AppConfig = {
//   JWT_SECRET: string
//   JWT_REFRESH_SECRET: string
//   NODE_ENV: 'development' | 'production' | 'test'
//   PORT: number
//   ...
// }
```

### 验证流程

```mermaid
graph TD
    A["process.env<br/>环境变量"] --> B["configSchema.safeParse(env)"]
    
    B -->|成功| C["result.data<br/>类型安全的配置对象"]
    B -->|失败| D["result.error.issues<br/>错误详情列表"]
    
    D --> E["格式化错误信息"]
    E --> F["打印到日志"]
    F --> G["process.exit(1)<br/>退出进程"]
    
    C --> H["返回 AppConfig"]
    
    style A fill:#e1f5fe
    style C fill:#c8e6c9
    style G fill:#ffcdd2
```

```typescript
// apps/server/src/lib/config.ts — validateConfig 函数

export function validateConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const result = configSchema.safeParse(env)
  
  if (!result.success) {
    // 将所有验证错误格式化为可读的字符串
    const errors = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Environment variable validation failed:\n${errors}`)
  }
  
  return result.data  // 返回类型安全的配置对象
}
```

### Zod 常用方法速查

```typescript
// 字符串
z.string()                    // 字符串
z.string().min(6)             // 最少 6 个字符
z.string().max(100)           // 最多 100 个字符
z.string().email()            // 邮箱格式
z.string().url()              // URL 格式
z.string().regex(/^[a-z]+$/)  // 正则匹配

// 数字
z.number()                    // 数字
z.number().int()              // 整数
z.number().min(0)             // 最小值
z.number().max(65535)         // 最大值
z.coerce.number()             // 字符串转数字（环境变量常用）

// 枚举
z.enum(['a', 'b', 'c'])      // 枚举值
z.literal('hello')            // 精确匹配

// 可选
z.string().optional()         // 可选（undefined）
z.string().nullable()         // 可以为 null
z.string().default('value')   // 默认值

// 联合
z.union([z.string(), z.number()])  // 多种类型
z.string().min(8).or(z.literal('')) // 8位以上或空字符串

// 对象
z.object({ key: z.string() }) // 对象
z.object({}).passthrough()    // 允许额外字段
z.object({}).strict()         // 禁止额外字段
```

---

# 第五章：认证与授权

## 5.1 认证 vs 授权

```mermaid
graph LR
    A[用户请求] --> B{认证 Authentication}
    B -->|"你是谁？<br/>验证身份"| C{授权 Authorization}
    C -->|"你能做什么？<br/>检查权限"| D[允许访问]
    C -->|"权限不足"| E[403 Forbidden]
    B -->|"身份不明"| F[401 Unauthorized]
    
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#c8e6c9
    style E fill:#ffcdd2
    style F fill:#ffcdd2
```

| 概念 | 英文 | 问的问题 | 实现方式 | 状态码 |
|------|------|---------|---------|--------|
| 认证 | Authentication | "你是谁？" | JWT、密码、OAuth | 401 |
| 授权 | Authorization | "你能做什么？" | 角色、权限检查 | 403 |

## 5.2 JWT 原理与实现

### 什么是 JWT？

JWT（JSON Web Token）是一种自包含的身份令牌。它把用户信息编码在 token 本身中，服务端不需要存储 session。

### JWT 结构

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTYiLCJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzAzMjc1MjAwLCJleHAiOjE3MDMyNzYxMDB9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

由三部分组成，用 . 分隔：

┌──────────────────────────────────────────────────────────────────┐
│ Header（头部）                                                    │
│ { "alg": "HS256", "typ": "JWT" }                                │
│ → Base64 编码 → eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9           │
├──────────────────────────────────────────────────────────────────┤
│ Payload（载荷）                                                   │
│ { "userId": "123456", "username": "admin", "iat": ..., "exp": ..│
│ } → Base64 编码 → eyJ1c2VySWQiOiIxMjM0NTYiLC...               │
├──────────────────────────────────────────────────────────────────┤
│ Signature（签名）                                                 │
│ HMACSHA256(base64(header) + "." + base64(payload), secret)      │
│ → 签名 → SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c          │
└──────────────────────────────────────────────────────────────────┘
```

### JWT 工作流程

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Server as 服务端
    
    Note over Client,Server: 1. 登录
    Client->>Server: POST /api/auth/login<br/>{username, password}
    Server->>Server: 验证密码
    Server->>Server: 生成 accessToken (15min)<br/>生成 refreshToken (7d)
    Server->>Client: {accessToken, refreshToken}
    
    Note over Client,Server: 2. 访问 API
    Client->>Server: GET /api/fs/tree<br/>Authorization: Bearer <accessToken>
    Server->>Server: jwt.verify(token, secret)
    Server->>Server: request.user = decoded
    Server->>Client: 200 { entries: [...] }
    
    Note over Client,Server: 3. Token 过期
    Client->>Server: GET /api/fs/tree<br/>Authorization: Bearer <expired_token>
    Server->>Server: jwt.verify() 失败
    Server->>Client: 401 Invalid or expired token
    
    Note over Client,Server: 4. 刷新 Token
    Client->>Server: POST /api/auth/refresh<br/>{refreshToken}
    Server->>Server: jwt.verify(refreshToken, refreshSecret)
    Server->>Server: 生成新 accessToken
    Server->>Client: {accessToken}
```

### 项目中的 JWT 实现

```typescript
// apps/server/src/routes/auth.ts — generateTokenPair 函数

function generateTokenPair(userId: string, username: string): TokenPair {
  const config = getConfig()
  
  // 生成 Access Token（短期，15分钟）
  const accessToken = jwt.sign(
    { userId, username },     // Payload
    config.JWT_SECRET,         // 签名密钥
    { expiresIn: '15m' }       // 过期时间
  )
  
  // 生成 Refresh Token（长期，7天）
  const refreshToken = jwt.sign(
    { userId, username },
    config.JWT_REFRESH_SECRET, // 使用不同的密钥！
    { expiresIn: '7d' }
  )
  
  return { accessToken, refreshToken }
}
```

> ⚠️ **重要安全实践**：Access Token 和 Refresh Token 使用**不同的密钥**签名。
> 这样即使 Access Token 的密钥泄露，攻击者也无法伪造 Refresh Token。

## 5.3 bcrypt 密码哈希

### 为什么不能存储明文密码？

```
❌ 错误做法：存储明文密码
数据库：{ username: "admin", password: "123456" }
→ 数据库泄露 = 所有用户密码泄露

✅ 正确做法：存储密码哈希
数据库：{ username: "admin", passwordHash: "$2a$10$N9qo8uLOickgx2ZMRZoMye..." }
→ 数据库泄露 = 攻击者拿到的是哈希值，无法直接还原密码
```

### bcrypt 的工作原理

```mermaid
graph TD
    subgraph "注册时"
        A["密码: mypassword"] --> B["bcrypt.hash(password, 10)"]
        B --> C["$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"]
    end
    
    subgraph "登录时"
        D["密码: mypassword"] --> E["bcrypt.compare(password, hash)"]
        F["哈希值: $2a$10$N9qo8uLO..."] --> E
        E --> G{结果}
        G -->|"true"| H["✅ 密码正确"]
        G -->|"false"| I["❌ 密码错误"]
    end
    
    style C fill:#e8f5e9
    style H fill:#c8e6c9
    style I fill:#ffcdd2
```

### bcrypt 参数说明

```typescript
// bcrypt.hash(password, saltRounds)
// saltRounds = 10 表示 2^10 = 1024 轮迭代
// 轮数越多越安全，但也越慢

await bcrypt.hash('mypassword', 10)
// 结果：$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
//       │ │  │                    └── 哈希值
//       │ │  └── salt（随机生成）
//       │ └── cost factor（10）
//       └── 算法版本
```

### 项目中的密码处理

```typescript
// apps/server/src/routes/auth.ts — 登录验证

// 注册/创建用户时：哈希密码
const passwordHash = await bcrypt.hash(password, 10)

// 登录时：比较密码
const user = getUser(username)
if (!user) {
  return reply.code(401).send({ error: 'Invalid credentials' })
}

const valid = await bcrypt.compare(password, user.passwordHash)
if (!valid) {
  return reply.code(401).send({ error: 'Invalid credentials' })
}
```

> 💡 **为什么用 `await bcrypt.hash()` 而不是 `bcrypt.hashSync()`？**
> bcrypt 是 CPU 密集型操作（故意设计得很慢，防止暴力破解）。
> 使用同步版本会阻塞 Node.js 的事件循环，导致所有其他请求排队等待。
> 使用异步版本可以利用 Node.js 的线程池，不阻塞主线程。

## 5.4 双 Token 机制

### 为什么需要两个 Token？

```mermaid
graph TD
    A["只有一个 Token 的问题"] --> B["Token 有效期短（如15分钟）"]
    A --> C["Token 有效期长（如7天）"]
    
    B --> B1["频繁要求重新登录<br/>用户体验差"]
    C --> C1["泄露后长期有效<br/>安全风险高"]
    
    D["双 Token 解决方案"] --> E["Access Token（15分钟）"]
    D --> F["Refresh Token（7天）"]
    
    E --> E1["用于 API 访问"]
    E --> E2["泄露影响有限"]
    F --> F1["用于刷新 Access Token"]
    F --> F2["存储更安全"]
    
    style A fill:#ffcdd2
    style D fill:#c8e6c9
```

### 双 Token 工作流程

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Server as 服务端
    
    Note over Client,Server: 登录获取 Token 对
    Client->>Server: POST /login {username, password}
    Server->>Client: {accessToken(15min), refreshToken(7d)}
    
    Note over Client,Server: 正常使用
    Client->>Server: GET /api/fs/tree<br/>Authorization: Bearer <accessToken>
    Server->>Client: 200 { entries }
    
    Note over Client,Server: Access Token 过期
    Client->>Server: GET /api/fs/tree<br/>Authorization: Bearer <expired>
    Server->>Client: 401 Invalid or expired token
    
    Note over Client,Server: 用 Refresh Token 刷新
    Client->>Server: POST /api/auth/refresh {refreshToken}
    Server->>Server: 验证 refreshToken
    Server->>Server: 生成新 accessToken
    Server->>Client: {accessToken: "<new>"}
    
    Note over Client,Server: 用新 Token 重试
    Client->>Server: GET /api/fs/tree<br/>Authorization: Bearer <new>
    Server->>Client: 200 { entries }
```

### 项目中的 Refresh Token 实现

```typescript
// apps/server/src/routes/auth.ts — POST /api/auth/refresh

fastify.post('/refresh', {
  schema: {
    security: [],  // 不需要 JWT 认证（因为 token 可能已过期）
    body: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string' },
      },
    },
  },
}, async (request, reply) => {
  const body = request.body as Record<string, unknown>
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : ''

  if (!refreshToken) {
    return reply.code(400).send({ error: 'Refresh token required' })
  }

  try {
    const config = getConfig()
    // 使用 refresh secret 验证 refresh token
    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as JwtPayload
    
    // 生成新的 access token
    const accessToken = jwt.sign(
      { userId: decoded.userId, username: decoded.username },
      config.JWT_SECRET,      // 使用 access secret 签名
      { expiresIn: '15m' }
    )
    return { accessToken }
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired refresh token' })
  }
})
```

### WebSocket 中的 Token 刷新

项目在 WebSocket 控制通道中也支持 Token 刷新——因为 WebSocket 连接是长连接，access token 可能在连接期间过期：

```typescript
// apps/server/src/core/WSGateway.ts — handleControlMessage

case 'REFRESH': {
  try {
    // 验证 refresh token
    const decoded = jwt.verify(msg.refreshToken, this.jwtRefreshSecret) as JwtPayload
    // 生成新的 access token
    const newAccessToken = jwt.sign(
      { userId: decoded.userId, username: decoded.username },
      this.jwtSecret,
      { expiresIn: '15m' },
    )
    // 通过 WebSocket 返回新 token
    ws.send(JSON.stringify({ type: 'TOKEN_RENEWED', accessToken: newAccessToken }))
  } catch {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid refresh token' }))
  }
  break
}
```

## 5.5 项目认证架构全景

```mermaid
graph TD
    subgraph "客户端"
        Login["POST /login<br/>username + password"]
        API["GET /api/*<br/>Bearer token"]
        Refresh["POST /refresh<br/>refreshToken"]
        WS["WebSocket<br/>?token=xxx"]
    end
    
    subgraph "服务端认证层"
        AuthPlugin["Auth Plugin<br/>onRequest 钩子"]
        RateLimit["@fastify/rate-limit<br/>5次/分钟"]
        WsAuth["wsAuth.ts<br/>WebSocket 升级验证"]
    end
    
    subgraph "服务端业务层"
        AuthRoutes["auth.ts 路由"]
        FSRoutes["fs.ts 路由"]
        WSGateway["WSGateway"]
    end
    
    subgraph "存储"
        Users[".users.json<br/>用户数据"]
        JWT["JWT Secret<br/>环境变量"]
    end
    
    Login --> RateLimit
    RateLimit --> AuthRoutes
    AuthRoutes --> Users
    AuthRoutes --> JWT
    
    API --> AuthPlugin
    AuthPlugin -->|"验证 JWT"| JWT
    AuthPlugin -->|"注入 request.user"| FSRoutes
    
    Refresh --> AuthRoutes
    
    WS --> WsAuth
    WsAuth -->|"验证 token"| JWT
    WsAuth --> WSGateway
    
    style AuthPlugin fill:#fff3e0
    style WsAuth fill:#fff3e0
    style RateLimit fill:#e3f2fd
```

## 5.6 安全最佳实践总结

| 实践 | 说明 | 项目中的体现 |
|------|------|-------------|
| 密码哈希 | 不存储明文密码 | bcrypt，salt rounds = 10 |
| 双 Token | 短期 access + 长期 refresh | 15 分钟 + 7 天 |
| 不同密钥 | access 和 refresh 用不同密钥 | JWT_SECRET vs JWT_REFRESH_SECRET |
| 密钥长度 | 至少 32 字符 | Zod `.min(32)` 校验 |
| 统一错误信息 | 不暴露具体失败原因 | "Invalid credentials" |
| 限流 | 防止暴力破解 | 5 次/分钟 |
| 白名单 | 公开接口不需要认证 | `/health`, `/login`, `/refresh` |
| 管理员检查 | 敏感操作需要额外权限 | `requireAdmin` preHandler |

## 5.7 JWT 深入理解

### JWT 的 Payload 不是加密的！

很多初学者误以为 JWT 是加密的。实际上，JWT 的 Payload 只是 Base64 编码，任何人都可以解码：

```bash
# 解码 JWT 的 Payload
$ echo 'eyJ1c2VySWQiOiIxMjM0NTYiLCJ1c2VybmFtZSI6ImFkbWluIn0' | base64 -d
{"userId":"123456","username":"admin"}
```

> ⚠️ **绝对不要在 JWT 中存放敏感信息**（如密码、信用卡号）。
> JWT 的安全性在于**签名**，不在于加密。签名确保数据没被篡改，但不隐藏数据。

### JWT 的三种算法

```mermaid
graph TD
    A["JWT 签名算法"] --> B["HS256
HMAC + SHA-256"]
    A --> C["RS256
RSA + SHA-256"]
    A --> D["ES256
ECDSA + SHA-256"]
    
    B --> B1["对称加密
同一密钥签名和验证"]
    B --> B2["速度快
适合单服务"]
    
    C --> C1["非对称加密
私钥签名，公钥验证"]
    C --> C2["安全性高
适合分布式"]
    
    D --> D1["非对称加密
更短的密钥
相同安全性"]
    D --> D2["性能更好
新一代算法"]
    
    style B fill:#e8f5e9
    style C fill:#e3f2fd
    style D fill:#fff3e0
```

| 算法 | 类型 | 密钥长度 | 速度 | 安全性 | 适用场景 |
|------|------|---------|------|--------|----------|
| HS256 | 对称 | 256-bit | ⭐ 最快 | 高 | 单体应用、内部服务 |
| RS256 | 非对称 | 2048-bit | 慢 | ⭐ 最高 | 分布式系统、第三方验证 |
| ES256 | 非对称 | 256-bit | 快 | 高 | 移动应用、IoT |

> 💡 **项目使用 HS256**：因为是单体应用，不需要非对称加密的复杂性。
> 密钥通过环境变量注入，安全性由部署环境保证。

### JWT 签名验证过程

```mermaid
graph TD
    A[收到 JWT Token] --> B[分割三部分]
    B --> C["Base64 解码 Header"]
    B --> D["Base64 解码 Payload"]
    B --> E["提取 Signature"]
    
    C --> F["获取算法: HS256"]
    D --> G["获取数据: userId, username"]
    
    F --> H["用相同算法和密钥
重新计算签名"]
    C --> H
    D --> H
    
    H --> I{"重新计算的签名
== 收到的签名？"}
    I -->|"是"| J["✅ 签名有效
数据未被篡改"]
    I -->|"否"| K["❌ 签名无效
数据可能被篡改"]
    
    style J fill:#c8e6c9
    style K fill:#ffcdd2
```

### JWT 常见攻击与防御

| 攻击方式 | 描述 | 防御措施 |
|---------|------|----------|
| 签名伪造 | 攻击者修改 Payload 并重新签名 | 使用强密钥（≥32 字符） |
| 算法混淆 | 将 alg 从 HS256 改为 none | Fastify/JWT 库默认拒绝 none |
| 密钥泄露 | JWT_SECRET 被泄露 | 定期轮换密钥，使用环境变量 |
| Token 窃取 | 从 URL/日志中获取 Token | HTTPS，不在 URL 中放 Token |
| 重放攻击 | 使用过期 Token | 设置合理的过期时间 |

### JWT 与 Session 对比

```mermaid
graph LR
    subgraph "Session 模式"
        S1["客户端"] -->|"Cookie: session_id"| S2["服务端"]
        S2 --> S3["Session Store
(Redis/内存)"]
        S3 -->|"查找 session_id"| S4["获取用户信息"]
    end
    
    subgraph "JWT 模式"
        J1["客户端"] -->|"Authorization: Bearer token"| J2["服务端"]
        J2 -->|"验证签名"| J3["从 token 中获取用户信息"]
    end
    
    style S3 fill:#fff3e0
    style J3 fill:#c8e6c9
```

| 特性 | Session | JWT |
|------|---------|-----|
| 存储位置 | 服务端（Redis/内存） | 客户端（Header/Cookie） |
| 扩展性 | 需要共享存储（多服务器） | ⭐ 无状态，天然支持分布式 |
| 性能 | 需要查询存储 | ⭐ 直接验证签名，无需查询 |
| 撤销 | 容易（删除 session） | 困难（需要黑名单） |
| 跨域 | 受 Cookie 限制 | ⭐ 支持 |
| 存储大小 | 无限（服务端） | 有限（JWT 太大影响传输） |

> 💡 **为什么项目选择 JWT？**
> 1. 无状态——不需要 Redis 等外部存储
> 2. 分布式友好——多实例部署无需共享 session
> 3. WebSocket 兼容——可以作为查询参数传递
> 4. 简单——项目用户量小，不需要复杂的 session 管理

## 5.8 密码学基础

### 哈希函数的特性

```mermaid
graph TD
    A["哈希函数 H(x)"] --> B["单向性"]
    A --> C["确定性"]
    A --> D["抗碰撞性"]
    A --> E["雪崩效应"]
    
    B --> B1["知道 H(x)，无法推导出 x"]
    C --> C1["相同的输入，总是产生相同的输出"]
    D --> D1["很难找到 x ≠ y 使得 H(x) = H(y)"]
    E --> E1["输入的微小变化导致输出巨大变化"]
    
    style A fill:#e1f5fe
```

### 哈希示例

```bash
# SHA-256 哈希示例
$ echo -n "hello" | sha256sum
2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824

$ echo -n "hellp" | sha256sum  # 只改了一个字母
...
完全不同的哈希值！
```

### 加密 vs 哈希 vs 编码

```mermaid
graph TD
    A["数据处理方式"] --> B["编码 Encoding"]
    A --> C["哈希 Hashing"]
    A --> D["加密 Encryption"]
    
    B --> B1["Base64, URL 编码"]
    B --> B2["可逆（双向）"]
    B --> B3["不提供安全性"]
    
    C --> C1["SHA-256, bcrypt"]
    C --> C2["不可逆（单向）"]
    C --> C3["用于完整性校验"]
    
    D --> D1["AES, RSA"]
    D --> D2["可逆（需要密钥）"]
    D --> D3["用于数据保密"]
    
    style B fill:#e3f2fd
    style C fill:#fff3e0
    style D fill:#e8f5e9
```

| 特性 | 编码 | 哈希 | 加密 |
|------|------|------|------|
| 可逆性 | 可逆 | 不可逆 | 可逆（需要密钥） |
| 目的 | 数据格式转换 | 完整性校验 | 数据保密 |
| 密钥 | 无 | 无 | 有 |
| 示例 | Base64 | SHA-256, bcrypt | AES, RSA |
| 应用 | JWT Payload | 密码存储 | HTTPS, 数据加密 |

### 对称加密 vs 非对称加密

```mermaid
graph LR
    subgraph "对称加密（AES）"
        S1["发送方"] -->|"明文 + 密钥"| S2["加密"]
        S2 -->|"密文"| S3["接收方"]
        S3 -->|"密文 + 密钥"| S4["解密"]
        S4 -->|"明文"| S5["结果"]
    end
    
    subgraph "非对称加密（RSA）"
        A1["发送方"] -->|"明文 + 公钥"| A2["加密"]
        A2 -->|"密文"| A3["接收方"]
        A3 -->|"密文 + 私钥"| A4["解密"]
        A4 -->|"明文"| A5["结果"]
    end
    
    style S2 fill:#fff3e0
    style A2 fill:#e3f2fd
```

| 特性 | 对称加密 | 非对称加密 |
|------|---------|----------|
| 密钥 | 同一个密钥 | 公钥 + 私钥对 |
| 速度 | ⭐ 快 | 慢 |
| 密钥分发 | 困难（需要安全通道） | 容易（公钥可公开） |
| 适用场景 | 大量数据加密 | 密钥交换、数字签名 |
| 典型算法 | AES-256 | RSA-2048, ECDSA |

> 💡 **HTTPS 的工作原理**：
> 1. 客户端和服务器通过非对称加密交换一个对称密钥
> 2. 后续通信使用对称加密（速度快）
> 3. 这样既解决了密钥分发问题，又保证了性能

### 数字签名

```mermaid
graph TD
    subgraph "签名过程"
        A1["原始数据"] --> A2["哈希计算"]
        A2 --> A3["哈希值"]
        A3 --> A4["用私钥加密"]
        A4 --> A5["数字签名"]
    end
    
    subgraph "验证过程"
        B1["原始数据"] --> B2["哈希计算"]
        B2 --> B3["哈希值 1"]
        B4["数字签名"] --> B5["用公钥解密"]
        B5 --> B6["哈希值 2"]
        B3 --> B7{"比较"}
        B6 --> B7
        B7 -->|"相同"| B8["✅ 签名有效"]
        B7 -->|"不同"| B9["❌ 签名无效"]
    end
    
    style B8 fill:#c8e6c9
    style B9 fill:#ffcdd2
```

> 💡 **JWT 的签名就是数字签名**：
> 1. 将 Header 和 Payload 进行 Base64 编码
> 2. 用密钥（HS256）或私钥（RS256）对编码后的数据进行签名
> 3. 验证时，用相同的密钥或公钥验证签名

### 为什么用 bcrypt 而不是 SHA-256？

```mermaid
graph TD
    A["密码哈希需求"] --> B["SHA-256"]
    A --> C["bcrypt"]
    
    B --> B1["计算速度：极快（每秒数十亿次）"]
    B --> B2["暴力破解：容易"]
    B --> B3["彩虹表攻击：容易"]
    
    C --> C1["计算速度：故意很慢"]
    C --> C2["暴力破解：困难"]
    C --> C3["彩虹表攻击：每次加盐，无法预计算"]
    
    style B fill:#ffcdd2
    style C fill:#c8e6c9
```

| 特性 | SHA-256 | bcrypt |
|------|---------|--------|
| 设计目的 | 通用哈希 | 密码哈希 |
| 计算速度 | 极快 | ⭐ 故意慢（可配置） |
| 加盐（Salt） | 需手动实现 | ⭐ 内置 |
| 迭代次数 | 固定 | ⭐ 可配置（cost factor） |
| GPU 抵抗 | 弱 | ⭐ 强（内存密集型） |
| 适用场景 | 文件校验、数字签名 | 密码存储 |

## 5.9 安全攻击类型与防御

### 常见 Web 安全攻击

```mermaid
graph TD
    A["Web 安全攻击"] --> B["注入攻击"]
    A --> C["认证攻击"]
    A --> D["授权攻击"]
    A --> E["其他攻击"]
    
    B --> B1["SQL 注入"]
    B --> B2["命令注入"]
    B --> B3["路径穿越"]
    
    C --> C1["暴力破解"]
    C --> C2["凭证填充"]
    C --> C3["Token 窃取"]
    
    D --> D1["权限提升"]
    D --> D2["IDOR"]
    
    E --> E1["XSS"]
    E --> E2["CSRF"]
    E --> E3["DoS"]
    
    style B fill:#ffcdd2
    style C fill:#ffcdd2
    style D fill:#ffcdd2
    style E fill:#ffcdd2
```

### 项目中的防御措施

| 攻击类型 | 防御措施 | 项目中的实现 |
|---------|---------|-------------|
| 命令注入 | 参数化命令 | `execFile` 替代 `exec` |
| 路径穿越 | 路径校验 | `sanitizePath()` + `realpath()` |
| 暴力破解 | 限流 | `@fastify/rate-limit` 5次/分钟 |
| Token 窃取 | HTTPS + 短期 Token | 15 分钟过期 |
| 权限提升 | 权限检查 | `requireAdmin` + `validateSessionAccess` |
| XSS | CSP | `@fastify/helmet` Content-Security-Policy |
| CSRF | 无状态 Token | JWT 不使用 Cookie |
| DoS | 请求限制 | 文件大小 1MB，请求体限制 |

---

# 第六章：WebSocket 服务端开发

## 6.1 WebSocket 协议基础

### HTTP vs WebSocket

```mermaid
graph LR
    subgraph "HTTP 模式（请求-响应）"
        C1[客户端] -->|"请求"| S1[服务端]
        S1 -->|"响应"| C1
        C1 -->|"请求"| S1
        S1 -->|"响应"| C1
        Note1["每次通信都需要客户端发起"]
    end
    
    subgraph "WebSocket 模式（双向通信）"
        C2[客户端] <-->|"双向消息"| S2[服务端]
        Note2["任何一方都可以主动发送"]
    end
    
    style C1 fill:#e3f2fd
    style S1 fill:#e3f2fd
    style C2 fill:#e8f5e9
    style S2 fill:#e8f5e9
```

| 特性 | HTTP | WebSocket |
|------|------|-----------|
| 通信模式 | 请求-响应 | 全双工 |
| 连接 | 短连接（每次新建） | 长连接（一次握手） |
| 服务端推送 | 不支持（需轮询） | ✅ 原生支持 |
| 头部开销 | 每次请求都带完整头部 | 握手后几乎无开销 |
| 适用场景 | REST API、静态资源 | 实时通信、终端、聊天 |

### WebSocket 握手过程

WebSocket 连接从一个 HTTP 请求开始：

```
客户端发送升级请求：
GET /ws/terminal HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

服务端回复：
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=

→ 握手完成，后续通信使用 WebSocket 协议
```

## 6.2 @fastify/websocket 使用

### 注册 WebSocket 插件

```typescript
// apps/server/src/index.ts

import websocket from '@fastify/websocket'

// 注册 WebSocket 插件
await fastify.register(websocket)

// 注册后，路由选项中可以使用 websocket: true
```

### 注册 WebSocket 路由

```typescript
// apps/server/src/routes/terminal.ts

import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'

export async function terminalRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/terminal', {
    websocket: true,  // ⚠️ 关键：标记为 WebSocket 路由
    schema: {
      hide: true,  // 不在 Swagger UI 中显示（WebSocket 无法用 REST 文档描述）
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'JWT access token' },
        },
      },
    },
  }, (socket, request) => {
    // 1. 验证升级请求中的 token
    if (!verifyWsUpgradeToken(request, socket, 'Terminal')) return

    // 2. 交给 WSGateway 处理后续消息
    fastify.wsGateway.handleTerminalConnection(socket)
  })
}
```

### WebSocket 升级认证

WebSocket 不能像 HTTP 那样使用 `Authorization` 头。项目通过查询参数传递 token：

```typescript
// apps/server/src/lib/wsAuth.ts

export function verifyWsUpgradeToken(
  request: FastifyRequest,
  ws: WebSocket,
  channelName: string,
): JwtPayload | null {
  // 从查询参数中提取 token
  const token = (request.query as Record<string, string | undefined>)?.token
  const secret = getConfig().JWT_SECRET

  if (!token) {
    pinoLogger.warn(`${channelName} WS upgrade rejected — missing token`)
    ws.close(4001, 'Missing token')  // 使用自定义关闭码
    return null
  }

  try {
    return jwt.verify(token, secret) as JwtPayload
  } catch {
    pinoLogger.warn(`${channelName} WS upgrade rejected — invalid token`)
    ws.close(4001, 'Invalid token')
    return null
  }
}
```

> ⚠️ **安全注意**：token 放在 URL 查询参数中，可能会出现在服务器日志、浏览器历史记录中。
> 但在 WebSocket 升级场景下，这是标准做法。token 只在升级时使用一次，后续通信不再需要。

## 6.3 双通道架构

项目使用两个独立的 WebSocket 通道：

```mermaid
graph TD
    subgraph "客户端"
        TerminalClient["终端通道<br/>/ws/terminal"]
        ControlClient["控制通道<br/>/ws/control"]
    end
    
    subgraph "服务端"
        WSGateway["WSGateway"]
        
        TerminalHandler["handleTerminalConnection<br/>二进制模式"]
        ControlHandler["handleControlConnection<br/>JSON 模式"]
        
        SessionManager["SessionManager"]
        PTY["node-pty<br/>终端进程"]
    end
    
    TerminalClient <-->|"二进制数据<br/>终端 I/O"| TerminalHandler
    ControlClient <-->|"JSON 消息<br/>控制指令"| ControlHandler
    
    TerminalHandler --> SessionManager
    ControlHandler --> SessionManager
    SessionManager --> PTY
    
    style TerminalClient fill:#e3f2fd
    style ControlClient fill:#fff3e0
    style TerminalHandler fill:#e3f2fd
    style ControlHandler fill:#fff3e0
```

### 为什么需要两个通道？

| 通道 | 数据类型 | 用途 | 特点 |
|------|---------|------|------|
| **Terminal** | 二进制 | 终端 I/O（键盘输入、屏幕输出） | 高频、低延迟、二进制 |
| **Control** | JSON | 会话管理（创建、销毁、调整大小） | 低频、结构化、可读 |

> 💡 **分离的好处**：
> 1. 终端数据是高频的二进制流，不需要 JSON 解析开销
> 2. 控制消息是低频的 JSON，需要可读性和类型安全
> 3. 两个通道独立认证和管理，一个断开不影响另一个

## 6.4 WSGateway 实现详解

### 状态机

```mermaid
stateDiagram-v2
    [*] --> UNAUTHENTICATED: WebSocket 连接建立
    
    UNAUTHENTICATED --> AUTHENTICATED: 收到 AUTH 消息<br/>token 验证通过
    UNAUTHENTICATED --> [*]: 15秒超时<br/>或 token 无效
    
    AUTHENTICATED --> SESSION_ATTACHED: 收到 ATTACH/INIT<br/>会话绑定成功
    AUTHENTICATED --> [*]: 连接关闭
    
    SESSION_ATTACHED --> SESSION_ATTACHED: 正常消息处理
    SESSION_ATTACHED --> [*]: 连接关闭
    
    state UNAUTHENTICATED {
        [*] --> 等待AUTH
        等待AUTH: 收到 JSON 消息
        等待AUTH: 解析 type === 'AUTH'
        等待AUTH: 验证 accessToken
    }
    
    state SESSION_ATTACHED {
        [*] --> 处理消息
        处理消息: Terminal → 二进制模式
        处理消息: Control → JSON 消息路由
    }
```

### WebSocket 性能优化

#### 优化 1：二进制 vs 文本消息

```typescript
// ❌ 文本消息（需要 JSON 序列化/反序列化）
ws.send(JSON.stringify({ type: 'KEY', data: 'a' }))
// 接收方：const msg = JSON.parse(data.toString())

// ✅ 二进制消息（直接发送字节）
ws.send(Buffer.from([0x00]))  // PING
ws.send(Buffer.from([0x01]))  // PONG
// 接收方：if (data[0] === 0x00) { /* PING */ }
```

| 消息类型 | 序列化开销 | 传输大小 | 适用场景 |
|---------|-----------|---------|----------|
| 文本 JSON | 高（JSON.stringify） | 较大 | 控制消息、低频通信 |
| 二进制 | 无 | ⭐ 最小 | 终端 I/O、高频通信 |

#### 优化 2：消息合并（Throttling）

```typescript
// 项目中的节流优化
private onData(session: Session, data: string): void {
  const buf = Buffer.from(data, 'utf-8')
  session.outputBuffer.push(buf)  // 缓存数据

  if (!session.throttleTimer) {
    session.throttleTimer = setTimeout(() => {
      this.flushBuffer(session)  // 合并后一次发送
    }, THROTTLE_MS)  // 16ms ≈ 60fps
  }
}

private flushBuffer(session: Session): void {
  const chunks = session.outputBuffer
  session.outputBuffer = []
  session.throttleTimer = null

  if (chunks.length === 0) return
  const merged = Buffer.concat(chunks)  // 合并所有缓冲数据

  for (const client of session.termClients) {
    client.send(merged)  // 一次发送
  }
}
```

```mermaid
sequenceDiagram
    participant PTY as PTY 输出
    participant Buffer as 缓冲区
    participant WS as WebSocket
    
    PTY->>Buffer: "H" (0ms)
    PTY->>Buffer: "e" (2ms)
    PTY->>Buffer: "l" (4ms)
    PTY->>Buffer: "l" (6ms)
    PTY->>Buffer: "o" (8ms)
    
    Note over Buffer: 16ms 后触发 flush
    Buffer->>WS: "Hello" (合并后一次发送)
    
    PTY->>Buffer: "W" (20ms)
    PTY->>Buffer: "o" (22ms)
    PTY->>Buffer: "r" (24ms)
    PTY->>Buffer: "l" (26ms)
    PTY->>Buffer: "d" (28ms)
    
    Note over Buffer: 16ms 后触发 flush
    Buffer->>WS: "World" (合并后一次发送)
```

#### 优化 3：背压控制

```typescript
// 项目中的背压处理
const BACKPRESSURE_THRESHOLD = 1048576  // 1MB

for (const client of session.termClients) {
  if (client.readyState !== 1) continue
  if (client.bufferedAmount > BACKPRESSURE_THRESHOLD) {
    // 客户端接收太慢，跳过本次发送
    this.sendBackpressureWarning(session)
    continue
  }
  client.send(merged)
}
```

```mermaid
graph TD
    A["PTY 输出数据"] --> B{"bufferedAmount
> 1MB?"}
    B -->|"否"| C["发送数据"]
    B -->|"是"| D["跳过本次发送"]
    D --> E["发送背压警告"]
    
    C --> F["客户端接收"]
    E --> G["客户端显示警告"]
    
    style B fill:#fff3e0
    style D fill:#ffcdd2
    style C fill:#c8e6c9
```

### WebSocket 安全最佳实践

| 实践 | 说明 | 项目中的实现 |
|------|------|-------------|
| 升级时认证 | WebSocket 握手时验证身份 | `verifyWsUpgradeToken()` |
| 消息验证 | 验证每条消息的格式和权限 | `validateSessionAccess()` |
| 会话隔离 | 用户只能访问自己的会话 | `getOwner()` 权限检查 |
| 大小限制 | 限制消息大小 | `INJECT_CODE_MAX_SIZE = 1MB` |
| 超时断开 | 认证超时自动断开 | `AUTH_TIMEOUT_MS = 15s` |
| 心跳检测 | 定期检测连接状态 | `PING_INTERVAL_MS = 30s` |
| 优雅关闭 | 关闭前通知客户端 | `broadcastControl(ERROR)` |

### Terminal 通道认证流程

```typescript
// apps/server/src/core/WSGateway.ts — handleTerminalConnection（简化）

handleTerminalConnection(ws: WebSocket): void {
  let state = WSState.UNAUTHENTICATED
  let currentUser: JwtPayload | null = null
  let sessionId: string | null = null

  // 认证超时：15秒内必须完成认证
  const authTimeout = setTimeout(() => {
    if (state === WSState.UNAUTHENTICATED) {
      ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Auth timeout')
    }
  }, AUTH_TIMEOUT_MS)

  ws.on('message', (data: Buffer) => {
    // 阶段 1：未认证 → 等待 AUTH 消息
    if (state === WSState.UNAUTHENTICATED) {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'AUTH') {
        this.verifyAuth(ws, msg, (payload) => {
          clearTimeout(authTimeout)
          state = WSState.AUTHENTICATED
          currentUser = payload
          ws.send(JSON.stringify({ type: 'AUTH_OK' }))
        })
      }
      return
    }

    // 阶段 2：已认证但未绑定会话 → 等待 ATTACH_SESSION
    if (sessionId === null) {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'ATTACH_SESSION' && msg.sessionId) {
        // 验证会话归属
        const owner = this.sessionManager.getOwner(msg.sessionId)
        if (owner && owner !== currentUser.userId) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
          return
        }
        sessionId = msg.sessionId
        this.sessionManager.attachClient(sessionId, ws, undefined)
      }
      return
    }

    // 阶段 3：二进制模式
    // 心跳检测（PING = 0x00, PONG = 0x01）
    if (data.length === 1 && data[0] === TERM_PING) {
      ws.send(Buffer.from([TERM_PONG]))
      return
    }

    // 转发键盘输入到 PTY
    this.sessionManager.sendInput(sessionId, data)
  })
}
```

### Control 通道消息路由

```typescript
// apps/server/src/core/WSGateway.ts — handleControlMessage（switch 路由）

private handleControlMessage(
  ws: WebSocket,
  msg: ControlClientMessage,
  currentSessionId: string | null,
  currentUser: JwtPayload | null,
  setSessionId: (sid: string) => void,
): void {
  switch (msg.type) {
    case 'PING':
      ws.send(JSON.stringify({ type: 'PONG' }))
      break

    case 'REFRESH':
      // 刷新 access token
      break

    case 'INIT_SESSION':
      // 创建新会话
      break

    case 'ATTACH_SESSION':
      // 连接到已有会话
      break

    case 'RESIZE':
      // 调整终端大小
      break

    case 'QUICK_ACTION':
      // 发送快捷操作
      break

    case 'INJECT_CODE':
      // 注入代码到终端
      break

    case 'OBSERVE_SESSION':
      // 只读观察会话
      break

    case 'START_RECORDING':
      // 开始录制
      break

    case 'STOP_RECORDING':
      // 停止录制
      break

    case 'GET_RECORDING':
      // 获取录制数据
      break
  }
}
```

## 6.5 消息类型定义

项目在 `packages/shared/src/protocol.ts` 中定义了所有消息类型：

```typescript
// Control Channel 客户端 → 服务端消息
export type ControlClientMessage =
  | { type: 'AUTH'; accessToken: string; protocolVersion: string }
  | { type: 'REFRESH'; refreshToken: string }
  | { type: 'PING' }
  | { type: 'INIT_SESSION'; sessionId: string; cols: number; rows: number; adapter: string }
  | { type: 'ATTACH_SESSION'; sessionId: string }
  | { type: 'RESIZE'; sessionId: string; cols: number; rows: number }
  | { type: 'QUICK_ACTION'; sessionId: string; payload: string }
  | { type: 'INJECT_CODE'; sessionId: string; code: string }
  | { type: 'START_RECORDING'; sessionId: string }
  | { type: 'STOP_RECORDING'; sessionId: string }
  | { type: 'GET_RECORDING'; sessionId: string; startTime?: number; endTime?: number }
  | { type: 'OBSERVE_SESSION'; sessionId: string }

// Control Channel 服务端 → 客户端消息
export type ControlServerMessage =
  | { type: 'AUTH_OK' }
  | { type: 'TOKEN_RENEWED'; accessToken: string }
  | { type: 'PONG' }
  | { type: 'STATUS_UPDATE'; sessionId: string; status: AgentStatus; message?: string }
  | { type: 'SESSION_READY'; sessionId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'RECORDING_DATA'; sessionId: string; data: Array<{ data: string; timestamp: number }> }
  | { type: 'RECORDING_STATUS'; sessionId: string; recording: boolean; duration: number }
```

> 💡 **使用联合类型（Union Type）的好处**：
> TypeScript 的联合类型配合 `switch (msg.type)` 可以实现**类型收窄（narrowing）**，
> 在每个 `case` 分支中，`msg` 的类型会自动收窄到对应的类型，获得完整的类型检查和自动补全。

## 6.6 Keep-Alive 机制

WebSocket 连接可能因为网络问题静默断开。项目实现了双向心跳检测：

```typescript
// Terminal 通道：二进制心跳
private setupTerminalKeepAlive(ws: WebSocket): void {
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      // 发送 PONG (0x01) 作为服务端心跳探测
      ws.send(Buffer.from([TERM_PONG]))
    }
  }, PING_INTERVAL_MS)  // 30秒
  this.pingTimers.set(ws, timer)
}

// Control 通道：JSON 心跳
private setupControlKeepAlive(ws: WebSocket): void {
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PING' }))
    }
  }, PING_INTERVAL_MS)  // 30秒
  this.pingTimers.set(ws, timer)
}
```

### 心跳流程图

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Server as 服务端
    
    Note over Client,Server: Terminal 通道心跳（二进制）
    Server->>Client: 0x01 (PONG)
    Client->>Server: 0x00 (PING)
    Note right of Server: 30秒间隔
    
    Note over Client,Server: Control 通道心跳（JSON）
    Server->>Client: {"type":"PING"}
    Client->>Server: {"type":"PING"}
    Server->>Client: {"type":"PONG"}
    Note right of Server: 30秒间隔
```

## 6.7 WebSocket 错误处理与重连

### WebSocket 关闭码

WebSocket 定义了一套标准的关闭码：

| 关闭码 | 名称 | 说明 | 项目中的使用 |
|--------|------|------|-------------|
| 1000 | Normal Closure | 正常关闭 | ✅ 连接正常结束 |
| 1001 | Going Away | 服务器关闭或页面跳转 | ✅ 服务器关闭 |
| 1002 | Protocol Error | 协议错误 | ❌ |
| 1003 | Unsupported Data | 不支持的数据类型 | ❌ |
| 1006 | Abnormal Closure | 异常关闭（无关闭帧） | ✅ 网络断开 |
| 1007 | Invalid Frame | 无效的帧数据 | ❌ |
| 1008 | Policy Violation | 策略违规 | ❌ |
| 1009 | Message Too Big | 消息太大 | ❌ |
| 1011 | Internal Error | 服务器内部错误 | ❌ |
| 4001 | 自定义 | 认证失败 | ✅ JWT 验证失败 |
| 4002 | 自定义 | 协议版本不匹配 | ✅ 版本撕裂 |

```typescript
// 项目中定义的自定义关闭码
export const WS_CLOSE_CODE = {
  AUTH_FAILED: 4001,         // 认证失败
  PROTOCOL_MISMATCH: 4002,   // 协议版本不匹配
} as const

// 使用示例
ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Missing access token')
ws.close(WS_CLOSE_CODE.PROTOCOL_MISMATCH, 'Protocol version mismatch')
```

### 客户端重连策略

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Server as 服务端
    
    Client->>Server: WebSocket 连接
    Server->>Client: 连接成功
    
    Note over Client,Server: 正常通信中...
    
    Note over Client: 网络断开！
    Client->>Server: 连接断开
    
    Note over Client: 检测到断开
    Note over Client: 等待 1 秒（指数退避）
    Client->>Server: 重连尝试 1
    Note over Client: 失败
    Note over Client: 等待 2 秒
    Client->>Server: 重连尝试 2
    Note over Client: 失败
    Note over Client: 等待 4 秒
    Client->>Server: 重连尝试 3
    Server->>Client: 重连成功！
    
    Note over Client,Server: 恢复通信
```

### 指数退避算法

```typescript
// 客户端重连逻辑示例
class WebSocketClient {
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private baseDelay = 1000  // 1 秒
  
  connect() {
    const ws = new WebSocket('ws://server/ws/control?token=xxx')
    
    ws.onopen = () => {
      this.reconnectAttempts = 0  // 重置计数器
      console.log('Connected!')
    }
    
    ws.onclose = (event) => {
      if (event.code === 4001) {
        // 认证失败，不重连
        console.error('Authentication failed')
        return
      }
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        // 指数退避：1s, 2s, 4s, 8s, 16s, ...
        const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts)
        const jitter = Math.random() * 1000  // 随机抖动，避免惊群效应
        
        console.log(`Reconnecting in ${delay + jitter}ms...`)
        setTimeout(() => {
          this.reconnectAttempts++
          this.connect()
        }, delay + jitter)
      } else {
        console.error('Max reconnect attempts reached')
      }
    }
  }
}
```

### 惊群效应与抖动

```mermaid
graph TD
    A["服务器重启"] --> B["所有客户端同时断开"]
    B --> C["无抖动：所有客户端同时重连"]
    B --> D["有抖动：客户端错开重连"]
    
    C --> C1["服务器瞬间收到
1000 个连接请求
→ 再次崩溃"]
    
    D --> D1["服务器逐步接收
连接请求
→ 平稳恢复"]
    
    style C1 fill:#ffcdd2
    style D1 fill:#c8e6c9
```

> 💡 **抖动（Jitter）**：在重连延迟上添加随机值，避免所有客户端在同一时刻重连。
> 这是一个简单但非常有效的技术，可以防止服务器在重启后被大量连接请求压垮。

## 6.8 WebSocket 与 HTTP 对比总结

| 特性 | HTTP | WebSocket |
|------|------|-----------|
| 连接模式 | 请求-响应（短连接） | 全双工（长连接） |
| 通信方向 | 客户端发起 | 双向 |
| 协议开销 | 每次请求带完整头部 | 握手后几乎无开销 |
| 数据格式 | 文本（JSON）或二进制 | 文本或二进制 |
| 状态 | 无状态 | 有状态 |
| 代理/CDN | 良好支持 | 部分支持 |
| 防火墙 | 良好支持 | 可能被阻止 |
| 浏览器支持 | 所有浏览器 | 所有现代浏览器 |
| 适用场景 | REST API、静态资源 | 实时通信、游戏、终端 |

---

# 第七章：错误处理与日志

## 7.1 全局错误处理策略

### 错误处理的层次

```mermaid
graph TD
    A[请求到达] --> B[路由处理]
    
    B -->|正常| C[返回响应]
    B -->|业务错误| D["reply.code(4xx)<br/>返回错误信息"]
    B -->|未捕获异常| E[Fastify 默认错误处理]
    E --> F["500 Internal Server Error"]
    
    subgraph "项目中的错误处理策略"
        G["路由层：业务错误<br/>400/401/403/404/409/413"]
        H["Fastify 层：未捕获错误<br/>500"]
        I["进程层：致命错误<br/>process.exit(1)"]
    end
    
    style G fill:#fff3e0
    style H fill:#ffcdd2
    style I fill:#ff8a80
```

### 项目中的错误处理模式

**模式 1：try-catch 包裹**

```typescript
// 预期内的错误用 try-catch 处理
try {
  const stat = await fs.stat(resolved)
} catch {
  return reply.code(404).send({ error: 'Path not found' })
}
```

**模式 2：前置校验**

```typescript
// 在执行操作前先校验
if (!relativePath) {
  return reply.code(400).send({ error: 'Missing path parameter' })
}

if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE) {
  return reply.code(413).send({ error: 'Content too large (max 1MB)' })
}
```

**模式 3：致命错误直接退出**

```typescript
// 启动时配置校验失败 → 退出
try {
  config = validateConfig()
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  pinoLogger.fatal(message)
  process.exit(1)
}
```

### 错误响应格式

项目统一使用 `{ error: string }` 格式：

```typescript
// 正确的错误响应
{ error: 'Missing or invalid authorization header' }
{ error: 'Invalid credentials' }
{ error: 'Path traversal detected' }
{ error: 'Content too large (max 1MB)' }

// 状态码 + 错误信息的对应关系
400 → 参数错误
401 → 认证失败
403 → 权限不足
404 → 资源不存在
409 → 资源冲突
413 → 数据太大
429 → 请求过于频繁
500 → 服务器内部错误
```

## 7.2 pino 日志库

### 为什么选择 pino？

| 日志库 | 性能 | JSON 输出 | TypeScript | 生态 |
|--------|------|-----------|-----------|------|
| **pino** | ⭐ 最快 | ⭐ 原生 | ⭐ 好 | Fastify 内置 |
| winston | 中等 | 支持 | 一般 | 最流行 |
| bunyan | 快 | ⭐ 原生 | 一般 | 维护较少 |
| log4js | 慢 | 支持 | 一般 | Java 风格 |

> 💡 pino 的性能优势来自它的设计哲学：**只做最少的事**。
> 格式化、颜色、传输都交给独立的进程（pino-pretty），主进程只负责序列化 JSON。

### 项目中的 Logger 实现

```typescript
// apps/server/src/lib/logger.ts

import pinoPkg from 'pino'
import { getConfig } from './config.js'

let _logger: ReturnType<typeof pino> | null = null

function getLogger() {
  if (!_logger) {
    const config = getConfig()
    const isProduction = config.NODE_ENV === 'production'
    
    _logger = pino({
      level: config.LOG_LEVEL,  // 从配置读取日志级别
      
      // 开发环境：使用 pino-pretty 美化输出
      // 生产环境：纯 JSON 输出（便于日志收集系统解析）
      ...(isProduction
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,           // 彩色输出
                translateTime: 'SYS:HH:MM:ss',  // 时间格式
                ignore: 'pid,hostname',   // 隐藏不需要的字段
              },
            },
          }),
    })
  }
  return _logger
}

// 使用 Proxy 实现延迟初始化
// 这样模块级别的 pinoLogger.info() 调用不会在 import 时就触发初始化
export const pinoLogger = new Proxy({} as ReturnType<typeof pino>, {
  get(_target, prop: string) {
    const logger = getLogger()
    const fn = (logger as Record<string, unknown>)[prop]
    return typeof fn === 'function' ? fn.bind(logger) : fn
  },
})
```

### 日志级别

```typescript
// 从最严重到最详细
pinoLogger.fatal('Server crashed')      // 致命错误，进程即将退出
pinoLogger.error({ err }, 'DB failed')  // 错误，但进程还能继续
pinoLogger.warn('Token expiring soon')  // 警告，需要关注
pinoLogger.info({ port }, 'Listening')  // 信息，正常运行状态
pinoLogger.debug('Request received')    // 调试，开发时用
pinoLogger.trace('Raw data')            // 追踪，最详细

// 配置 LOG_LEVEL 后，低于该级别的日志不会输出
// 例如 LOG_LEVEL=info 时，debug 和 trace 不会输出
```

### 结构化日志

```typescript
// pino 推荐使用结构化日志（对象 + 消息）
pinoLogger.info({ port: 3000 }, 'Server listening')
// 输出：{"level":30,"time":1703275200000,"port":3000,"msg":"Server listening"}

pinoLogger.error({ err, sessionId }, 'Failed to restore session')
// 输出：{"level":50,"time":1703275200000,"err":{...},"sessionId":"xxx","msg":"Failed to restore session"}

// 相比字符串拼接，结构化日志更容易被日志系统搜索和过滤
// ❌ pinoLogger.error(`Failed to restore session ${sessionId}: ${err}`)
// ✅ pinoLogger.error({ err, sessionId }, 'Failed to restore session')
```

## 7.3 审计日志设计

### 审计日志 vs 应用日志

| 特性 | 应用日志（pino） | 审计日志（audit） |
|------|----------------|-----------------|
| 目的 | 调试和监控 | 安全合规和事后追溯 |
| 内容 | 技术细节 | 业务事件 |
| 存储 | stdout / 文件 | 独立文件 |
| 格式 | 灵活 | 结构化 JSON |
| 保留期 | 短期 | 长期 |


### 审计日志的重要性

```mermaid
graph TD
    A["审计日志的价值"] --> B["安全合规"]
    A --> C["事件追溯"]
    A --> D["威胁检测"]
    A --> E["责任认定"]
    
    B --> B1["满足 GDPR、SOC2 等合规要求"]
    B --> B2["证明组织采取了安全措施"]
    
    C --> C1["安全事件发生后还原现场"]
    C --> C2["了解攻击者的行为路径"]
    
    D --> D1["实时监控异常行为"]
    D --> D2["发现潜在的安全威胁"]
    
    E --> E1["确定谁在什么时候做了什么"]
    E --> E2["内部调查和问责"]
    
    style A fill:#e1f5fe
```

### 审计日志最佳实践

| 实践 | 说明 | 项目中的实现 |
|------|------|-------------|
| 记录所有关键操作 | 登录、文件操作、用户管理 | ✅ 14 种事件类型 |
| 包含时间戳 | 精确到毫秒 | ✅ ISO 8601 格式 |
| 包含用户信息 | 谁做的 | ✅ userId 字段 |
| 包含操作详情 | 做了什么 | ✅ details 对象 |
| 包含客户端信息 | 从哪里来的 | ✅ IP 地址 |
| 异步写入 | 不阻塞主业务 | ✅ WriteStream |
| 独立存储 | 与应用日志分离 | ✅ .audit.log 文件 |
| 防篡改 | 日志不可被修改 | ⚠️ 未实现（可追加哈希链） |
| 定期归档 | 防止文件过大 | ⚠️ 未实现（可添加日志轮转） |

### 审计日志分析示例

```bash
# 查询所有登录失败事件
cat .audit.log | jq 'select(.event == "LOGIN_FAILED")'

# 查询特定用户的操作
cat .audit.log | jq 'select(.userId == "abc-123")'

# 查询文件写入操作
cat .audit.log | jq 'select(.event == "FILE_WRITE")'

# 统计每小时的登录次数
cat .audit.log | jq -r 'select(.event == "LOGIN") | .timestamp' | cut -c1-13 | sort | uniq -c
```
### 审计日志实现

```typescript
// apps/server/src/core/audit.ts

import { createWriteStream, WriteStream } from 'fs'

// 审计事件类型——用联合类型约束可记录的事件
export type AuditEvent =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SESSION_CREATE'
  | 'SESSION_DESTROY'
  | 'FILE_READ'
  | 'FILE_WRITE'
  | 'FILE_WRITE_BLOCKED'
  | 'WS_CONNECT'
  | 'WS_DISCONNECT'
  | 'USER_LIST'
  | 'USER_CREATE'
  | 'USER_DELETE'
  | 'USER_PASSWORD_CHANGE'

// 使用 WriteStream 异步写入，避免阻塞事件循环
let stream: WriteStream | null = null

function getStream(): WriteStream {
  if (!stream) {
    stream = createWriteStream(getAuditLogPath(), { flags: 'a' })  // 'a' = append
    stream.on('error', (err) => {
      pinoLogger.error({ err }, 'Audit log stream error')
      stream?.destroy()
      stream = null
    })
  }
  return stream
}

export function auditLog(
  event: AuditEvent,
  userId?: string,
  details?: Record<string, unknown>
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    userId: userId ?? null,
    details: details ?? null,
  }

  const line = JSON.stringify(entry) + '\n'

  try {
    const ok = getStream().write(line)
    if (!ok) {
      // 背压：缓冲区满了，记录警告
      pinoLogger.warn('Audit log write returned false (backpressure)')
    }
  } catch (err) {
    pinoLogger.error({ err }, 'Failed to write audit log, retrying with fresh stream')
    stream?.destroy()
    stream = null
    try {
      getStream().write(line)
    } catch (retryErr) {
      pinoLogger.error({ err: retryErr }, 'Audit log retry also failed')
    }
  }
}
```

### 审计日志输出格式

```json
{"timestamp":"2024-12-22T12:00:00.000Z","event":"LOGIN","userId":"abc-123","details":{"username":"admin","ip":"192.168.1.1"}}
{"timestamp":"2024-12-22T12:01:00.000Z","event":"FILE_WRITE","userId":"abc-123","details":{"path":"src/index.ts","size":1234}}
{"timestamp":"2024-12-22T12:02:00.000Z","event":"LOGIN_FAILED","userId":null,"details":{"username":"hacker","reason":"user not found","ip":"10.0.0.1"}}
{"timestamp":"2024-12-22T12:03:00.000Z","event":"FILE_WRITE_BLOCKED","userId":"abc-123","details":{"path":"malware.exe","ext":".exe"}}
```

### 项目中审计日志的使用场景

```typescript
// 1. 登录成功
auditLog('LOGIN', user.userId, { username, ip: request.ip })

// 2. 登录失败
auditLog('LOGIN_FAILED', undefined, { username, reason: 'user not found', ip: request.ip })

// 3. 用户管理
auditLog('USER_CREATE', request.user!.userId, { createdUser: username })
auditLog('USER_DELETE', request.user!.userId, { deletedUser: username })
auditLog('USER_PASSWORD_CHANGE', request.user!.userId, { targetUser: username })

// 4. 文件操作
auditLog('FILE_READ', request.user?.userId, { path: relativePath })
auditLog('FILE_WRITE', request.user?.userId, { path: relativePath, size })
auditLog('FILE_WRITE_BLOCKED', request.user?.userId, { path: relativePath, ext })

// 5. 会话管理
auditLog('SESSION_CREATE', undefined, { sessionId, adapter: adapterName })
auditLog('SESSION_DESTROY', undefined, { sessionId })
```

## 7.4 错误恢复机制

项目实现了自动错误恢复：

```typescript
// apps/server/src/core/SessionManager.ts

// 每 10 秒检查一次，尝试恢复 ERROR 状态的会话
private startErrorRecoveryLoop(): void {
  this.errorRecoveryTimer = setInterval(() => {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'ERROR') {
        this.recoverFromError(sessionId).catch((err) => {
          pinoLogger.error({ err, sessionId }, 'Error recovery failed')
        })
      }
    }
  }, ERROR_RECOVERY_INTERVAL_MS)  // 10 秒
}

async recoverFromError(sessionId: string): Promise<void> {
  const session = this.sessions.get(sessionId)
  if (!session || session.status !== 'ERROR') return

  const tmuxSessionName = `aicli-${sessionId}`
  try {
    // 检查 tmux 会话是否还活着
    await execFileAsync('tmux', ['has-session', '-t', tmuxSessionName])
    // 还活着 → 重置为 IDLE
    this.updateStatus(session, 'IDLE')
  } catch {
    // 已经死了 → 销毁会话
    this.destroySession(sessionId)
  }
}
```

### 错误恢复流程图

```mermaid
graph TD
    A["会话进入 ERROR 状态"] --> B["10秒后自动检查"]
    B --> C{"tmux 会话<br/>还活着？"}
    C -->|"是"| D["重置为 IDLE"]
    C -->|"否"| E["销毁会话"]
    D --> F["会话恢复正常使用"]
    E --> G["清理资源"]
    
    style A fill:#ffcdd2
    style D fill:#c8e6c9
    style E fill:#ffcdd2
```

## 7.5 常见错误处理模式

### 模式 1：错误优先模式（Error-First Pattern）

```typescript
// 在每个操作开始时先检查错误条件
async function handleRequest(request, reply) {
  // 1. 先检查认证
  if (!request.user) {
    return reply.code(401).send({ error: 'Not authenticated' })
  }
  
  // 2. 再检查参数
  const { id } = request.params
  if (!id) {
    return reply.code(400).send({ error: 'Missing id parameter' })
  }
  
  // 3. 检查资源存在
  const resource = await findResource(id)
  if (!resource) {
    return reply.code(404).send({ error: 'Resource not found' })
  }
  
  // 4. 检查权限
  if (resource.ownerId !== request.user.userId) {
    return reply.code(403).send({ error: 'Access denied' })
  }
  
  // 5. 执行业务逻辑（到这里，所有检查都已通过）
  return { data: resource }
}
```

### 模式 2：try-catch 分层模式

```typescript
// 外层：捕获所有未处理的错误
async function handleRequest(request, reply) {
  try {
    // 内层：捕获特定操作的错误
    try {
      const data = await riskyOperation()
      return { data }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return reply.code(404).send({ error: 'File not found' })
      }
      throw err  // 重新抛出未知错误
    }
  } catch (err) {
    // 最外层：处理未知错误
    pinoLogger.error({ err }, 'Unexpected error')
    return reply.code(500).send({ error: 'Internal server error' })
  }
}
```

### 模式 3：结果类型模式（Result Type）

```typescript
// 使用 Result 类型代替 throw
interface Success<T> {
  ok: true
  data: T
}

interface Failure {
  ok: false
  error: string
  code: number
}

type Result<T> = Success<T> | Failure

// 使用示例
function findUser(id: string): Result<User> {
  const user = users.get(id)
  if (!user) {
    return { ok: false, error: 'User not found', code: 404 }
  }
  return { ok: true, data: user }
}

// 在路由中使用
const result = findUser(request.params.id)
if (!result.ok) {
  return reply.code(result.code).send({ error: result.error })
}
return { user: result.data }
```

## 7.6 日志最佳实践

### 日志级别使用指南

```mermaid
graph TD
    A["日志级别"] --> B["FATAL"]
    A --> C["ERROR"]
    A --> D["WARN"]
    A --> E["INFO"]
    A --> F["DEBUG"]
    A --> G["TRACE"]
    
    B --> B1["进程即将退出
需要立即关注"]
    C --> C1["操作失败
但进程还能继续"]
    D --> D1["潜在问题
需要关注"]
    E --> E1["正常运行状态
关键业务事件"]
    F --> F1["开发调试信息
生产环境关闭"]
    G --> G1["最详细的信息
很少使用"]
    
    style B fill:#ff8a80
    style C fill:#ffcdd2
    style D fill:#fff9c4
    style E fill:#c8e6c9
    style F fill:#e3f2fd
    style G fill:#f3e5f5
```

### 结构化日志最佳实践

```typescript
// ❌ 错误：字符串拼接日志
pinoLogger.info('User ' + username + ' logged in from ' + ip)
pinoLogger.error('Failed to read file: ' + err.message)

// ✅ 正确：结构化日志
pinoLogger.info({ username, ip }, 'User logged in')
pinoLogger.error({ err, filePath }, 'Failed to read file')

// ✅ 更好：包含上下文信息
pinoLogger.info({
  userId: user.id,
  username: user.username,
  ip: request.ip,
  userAgent: request.headers['user-agent'],
  timestamp: new Date().toISOString(),
}, 'User logged in')
```

### 日志中的敏感信息处理

```typescript
// ❌ 错误：记录敏感信息
pinoLogger.info({ password: '123456' }, 'User login attempt')
pinoLogger.info({ token: 'eyJhbG...' }, 'API request')
pinoLogger.info({ creditCard: '4111-1111-1111-1111' }, 'Payment processed')

// ✅ 正确：脱敏处理
pinoLogger.info({ username: 'admin' }, 'User login attempt')
pinoLogger.info({ tokenLength: token.length }, 'API request')
pinoLogger.info({ last4: '1111' }, 'Payment processed')
```

### 日志上下文信息

| 场景 | 应该记录的信息 | 不应该记录的信息 |
|------|---------------|------------------|
| 用户登录 | 用户名、IP、时间、结果 | 密码、Token |
| 文件操作 | 文件路径、操作类型、用户 | 文件内容 |
| API 请求 | 方法、URL、状态码、耗时 | 请求体（可能含敏感数据） |
| 错误 | 错误类型、堆栈、上下文 | 用户密码、密钥 |
| 数据库查询 | 查询类型、表名、耗时 | 查询结果（可能含敏感数据） |

## 7.7 日志收集与监控

### 日志架构

```mermaid
graph LR
    subgraph "应用层"
        A1["Fastify 应用"] --> B1["pino 日志库"]
    end
    
    subgraph "传输层"
        B1 --> C1["stdout"]
        B1 --> C2["文件"]
    end
    
    subgraph "收集层"
        C1 --> D1["Docker 日志驱动"]
        C2 --> D2["Filebeat"]
    end
    
    subgraph "存储层"
        D1 --> E1["ELK Stack"]
        D2 --> E1
        E1 --> F1["Elasticsearch"]
    end
    
    subgraph "展示层"
        F1 --> G1["Kibana"]
    end
    
    style A1 fill:#e3f2fd
    style B1 fill:#e8f5e9
    style F1 fill:#fff3e0
    style G1 fill:#f3e5f5
```

### 日志级别配置

```typescript
// 不同环境使用不同的日志级别
const config = {
  development: {
    LOG_LEVEL: 'debug',  // 开发环境：显示所有日志
  },
  production: {
    LOG_LEVEL: 'info',   // 生产环境：只显示 info 及以上
  },
  test: {
    LOG_LEVEL: 'silent', // 测试环境：静默
  },
}

// 项目中的实现
const logger = pino({
  level: config.LOG_LEVEL,
  ...(isProduction ? {} : {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
})
```

---

# 第八章：文件系统 API

## 8.1 文件读写操作

### API 设计

项目提供了三个文件系统 API：

| 方法 | 路径 | 功能 | 参数 |
|------|------|------|------|
| GET | `/api/fs/tree` | 获取目录列表 | `?path=相对路径` |
| GET | `/api/fs/file` | 读取文件内容 | `?path=文件路径` |
| PUT | `/api/fs/file` | 写入文件 | `{ path, content }` |

### 目录列表 API

```typescript
// apps/server/src/routes/fs.ts — GET /api/fs/tree

fastify.get('/tree', async (request, reply) => {
  const relativePath = (request.query as Record<string, string | undefined>).path || ''

  // 1. 路径安全校验
  const resolved = await sanitizePath(relativePath)
  if (!resolved) {
    return reply.code(403).send({ error: 'Path traversal detected' })
  }

  // 2. 检查路径是否存在且是目录
  let stat: fsSync.Stats
  try {
    stat = await fs.stat(resolved)
  } catch {
    return reply.code(404).send({ error: 'Path not found' })
  }

  if (!stat.isDirectory()) {
    return reply.code(400).send({ error: 'Not a directory' })
  }

  // 3. 读取目录内容，过滤隐藏文件
  const entries = await fs.readdir(resolved, { withFileTypes: true })
  const result = entries
    .filter(e => !shouldHide(e.name))  // 过滤 . 开头和 node_modules
    .map(async (e) => {
      const s = await fs.stat(path.join(resolved, e.name))
      return {
        name: e.name,
        path: path.join(relativePath, e.name),
        type: e.isDirectory() ? 'directory' : 'file',
        size: e.isFile() ? s.size : undefined,
        modified: s.mtime.toISOString(),
      }
    })

  return { entries: await Promise.all(result) }
})
```

### 文件读取 API

```typescript
// apps/server/src/routes/fs.ts — GET /api/fs/file

fastify.get('/file', async (request, reply) => {
  const relativePath = (request.query as Record<string, string | undefined>).path
  if (!relativePath) {
    return reply.code(400).send({ error: 'Missing path parameter' })
  }

  const resolved = await sanitizePath(relativePath)
  if (!resolved) {
    return reply.code(403).send({ error: 'Path traversal detected' })
  }

  // 检查文件大小
  const stat = await fs.stat(resolved)
  if (stat.size > MAX_FILE_SIZE) {  // 1MB
    return reply.code(413).send({ error: 'File too large' })
  }

  const content = await fs.readFile(resolved, 'utf-8')

  // 审计日志
  auditLog('FILE_READ', request.user?.userId, { path: relativePath })

  return {
    content,
    path: relativePath,
    size: stat.size,
    language: getLanguage(resolved),  // 根据扩展名识别语言
  }
})
```

## 8.2 路径安全校验

### 路径穿越攻击

路径穿越（Path Traversal）是一种常见的安全攻击：

```
正常请求：GET /api/fs/file?path=src/index.ts
→ 读取 /workspace/src/index.ts ✅

恶意请求：GET /api/fs/file?path=../../etc/passwd
→ 读取 /etc/passwd ❌（如果没做校验）

恶意请求：GET /api/fs/file?path=src/../../etc/passwd
→ 读取 /etc/passwd ❌（如果没做校验）
```

### 路径穿越攻击手法详解

```mermaid
graph TD
    A["攻击手法"] --> B["直接穿越"]
    A --> C["编码绕过"]
    A --> D["空字节注入"]
    A --> E["符号链接"]
    A --> F["双重编码"]
    
    B --> B1["../../etc/passwd"]
    B --> B2["使用 .. 回到上级目录"]
    
    C --> C1["%2e%2e%2f"]
    C --> C2["URL 编码的 .. 和 /"]
    
    D --> D1["file.txt%00.jpg"]
    D --> D2["空字节截断文件名"]
    
    E --> E1["link -> /etc"]
    E --> E2["符号链接指向外部目录"]
    
    F --> F1["%252e%252e%252f"]
    F --> F2["对 % 本身再次编码"]
    
    style B fill:#ffcdd2
    style C fill:#ffcdd2
    style D fill:#ffcdd2
    style E fill:#ffcdd2
    style F fill:#ffcdd2
```

### 攻击手法示例

```typescript
// 攻击 1：直接穿越
GET /api/fs/file?path=../../etc/passwd
// path.resolve('/workspace', '../../etc/passwd') = '/etc/passwd'

// 攻击 2：编码绕过
GET /api/fs/file?path=%2e%2e%2f%2e%2e%2fetc%2fpasswd
// URL 解码后 = '../../etc/passwd'

// 攻击 3：空字节注入
GET /api/fs/file?path=file.txt%00.jpg
// 如果不检查 \0，可能截断为 'file.txt'

// 攻击 4：符号链接
// 在项目目录创建：ln -s /etc /workspace/etc
GET /api/fs/file?path=etc/passwd
// 如果不解析符号链接，会读取到 /etc/passwd

// 攻击 5：双重编码
GET /api/fs/file?path=%252e%252e%252f
// 第一次解码：%2e%2e%2f
// 第二次解码：../../
```

### 项目中的路径校验

```typescript
// apps/server/src/routes/fs.ts — sanitizePath 函数

async function sanitizePath(inputPath: string): Promise<string | null> {
  // 防御 1：拒绝空字节（防止 null byte 注入）
  if (inputPath.includes('\0')) return null
  
  // 防御 2：解析为绝对路径
  const root = getProjectRoot()
  const resolved = path.resolve(root, inputPath)
  
  // 防御 3：检查是否在项目根目录内
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null  // 路径穿越！
  }
  
  // 防御 4：解析符号链接，再次检查
  try {
    const real = await fs.realpath(resolved)
    if (!real.startsWith(root + path.sep) && real !== root) {
      return null  // 符号链接指向外部！
    }
    return real
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return resolved  // 文件不存在但路径合法
    return null
  }
}
```

### 路径校验流程图

```mermaid
graph TD
    A["输入路径: ../../etc/passwd"] --> B{"包含空字节?"}
    B -->|"是"| X1["❌ 返回 null"]
    B -->|"否"| C["path.resolve(root, inputPath)"]
    C --> D{"在项目根目录内?"}
    D -->|"否"| X2["❌ 返回 null"]
    D -->|"是"| E["fs.realpath() 解析符号链接"]
    E --> F{"真实路径在根目录内?"}
    F -->|"否"| X3["❌ 返回 null"]
    F -->|"是"| G["✅ 返回真实路径"]
    
    style X1 fill:#ffcdd2
    style X2 fill:#ffcdd2
    style X3 fill:#ffcdd2
    style G fill:#c8e6c9
```

> 💡 **为什么要解析符号链接？**
> 如果项目目录内有一个符号链接指向 `/etc`：
> ```
> /workspace/etc -> /etc
> ```
> 那么 `path.resolve('/workspace', 'etc/passwd')` 会返回 `/workspace/etc/passwd`，
> 通过了路径检查。但实际读取的是 `/etc/passwd`。
> 所以必须用 `fs.realpath()` 解析符号链接后再次检查。

## 8.3 原子写入（write-then-rename）

### 为什么要原子写入？

```
❌ 普通写入的风险：
1. 开始写入文件（清空原有内容）
2. 写入新内容...
3. ⚡ 此时进程崩溃或断电！
4. 文件内容 = 空 或 不完整 → 数据丢失！

✅ 原子写入的安全性：
1. 写入到临时文件（.tmp）
2. 写入完成后，rename 替换原文件
3. rename 是操作系统级别的原子操作
4. 即使崩溃，原文件仍然完整
```

### 项目中的原子写入实现

```typescript
// apps/server/src/routes/fs.ts — PUT /api/fs/file

// 写入文件使用 write-then-rename 模式
const tmpPath = resolved + '.tmp'
try {
  // 1. 先写入临时文件
  await fs.writeFile(tmpPath, content, 'utf-8')
  // 2. 原子替换原文件
  await fs.rename(tmpPath, resolved)
} catch {
  // 清理可能残留的临时文件
  await fs.unlink(tmpPath).catch(() => {})
  return reply.code(500).send({ error: 'Failed to write file' })
}
```

同样的模式也用在用户数据持久化中：

```typescript
// apps/server/src/plugins/auth.ts — saveUsers 函数

function saveUsers(): void {
  const usersFilePath = getUsersFilePath()
  const tmpPath = usersFilePath + '.tmp'
  
  // 1. 写入临时文件
  fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8')
  // 2. 原子替换
  fs.renameSync(tmpPath, usersFilePath)
}
```

### 原子写入流程图

```mermaid
sequenceDiagram
    participant App as 应用
    participant FS as 文件系统
    
    Note over App,FS: 普通写入（不安全）
    App->>FS: 打开原文件，清空内容
    App->>FS: 写入新内容...
    Note over App: ⚡ 崩溃！
    Note over FS: 文件内容为空或不完整
    
    Note over App,FS: 原子写入（安全）
    App->>FS: 创建临时文件 file.tmp
    App->>FS: 写入新内容到 file.tmp
    App->>FS: rename(file.tmp, file)
    Note over FS: 原子操作，要么完成要么没发生
    Note over App: 即使崩溃，原文件仍然完整
```

## 8.4 文件类型与大小限制

### 危险文件类型拦截

```typescript
// apps/server/src/routes/fs.ts

const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi',    // Windows 可执行文件
  '.ps1', '.vbs',                              // Windows 脚本
  '.dll', '.so', '.dylib',                     // 动态链接库
  '.app',                                      // macOS 应用
])

// 写入时检查
const ext = path.extname(resolved).toLowerCase()
if (DANGEROUS_EXTENSIONS.has(ext)) {
  auditLog('FILE_WRITE_BLOCKED', request.user?.userId, { path: relativePath, ext })
  return reply.code(403).send({ error: `File type '${ext}' is not allowed for security reasons` })
}
```

### 文件大小限制

```typescript
const MAX_FILE_SIZE = 1048576  // 1MB

// 读取时检查
if (stat.size > MAX_FILE_SIZE) {
  return reply.code(413).send({ error: 'File too large' })
}

// 写入时检查
if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE) {
  return reply.code(413).send({ error: 'Content too large (max 1MB)' })
}
```

### 代码语言识别

```typescript
// 根据文件扩展名识别编程语言（用于前端代码高亮）
const EXT_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.json': 'json',
  '.md': 'markdown',
  '.css': 'css',
  '.html': 'html',
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.c': 'c',
  '.cpp': 'cpp',
  // ...
}

function getLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  return EXT_LANGUAGE_MAP[ext] || 'text'
}
```

## 8.5 速率限制

文件系统 API 添加了速率限制，防止滥用：

```typescript
// apps/server/src/routes/fs.ts

await fastify.register(rateLimit, {
  max: 100,           // 每个时间窗口最多 100 次请求
  timeWindow: '1 minute',  // 时间窗口：1 分钟
  hook: 'preHandler',      // 在 preHandler 阶段检查
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: '请求过于频繁，请稍后再试',
  }),
})
```

### 项目中的速率限制策略

| 接口 | 限制 | 时间窗口 | 目的 |
|------|------|---------|------|
| `/api/auth/login` | 5 次 | 1 分钟 | 防止暴力破解 |
| `/api/fs/*` | 100 次 | 1 分钟 | 防止 API 滥用 |

## 8.6 文件系统安全深度解析

### 路径穿越攻击详解

```mermaid
graph TD
    A["攻击者输入"] --> B{"路径校验"}
    
    C["../../etc/passwd"] --> B
    D["src/../../etc/passwd"] --> B
    E["src/../../../etc/shadow"] --> B
    F["....//....//etc/passwd"] --> B
    G["src%2F..%2F..%2Fetc%2Fpasswd"] --> B
    
    B -->|"检测到穿越"| H["❌ 403 Forbidden"]
    B -->|"路径合法"| I["✅ 允许访问"]
    
    style H fill:#ffcdd2
    style I fill:#c8e6c9
```

### 常见路径穿越攻击手法

| 攻击手法 | 示例 | 防御方式 |
|---------|------|----------|
| 直接穿越 | `../../etc/passwd` | `path.resolve()` + 前缀检查 |
| 编码绕过 | `%2e%2e%2f` | URL 解码后再检查 |
| 空字节注入 | `file.txt%00.jpg` | 检查 `\0` 字符 |
| 符号链接 | `link -> /etc` | `fs.realpath()` 解析 |
| 双重编码 | `%252e%252e` | 多次 URL 解码 |
| Unicode 规范化 | `..%c0%af` | Unicode 规范化处理 |

### 项目中的防御实现

```typescript
// apps/server/src/routes/fs.ts — sanitizePath 函数

async function sanitizePath(inputPath: string): Promise<string | null> {
  // 防御 1：空字节注入
  if (inputPath.includes('\0')) return null
  
  // 防御 2：路径解析
  const root = getProjectRoot()
  const resolved = path.resolve(root, inputPath)
  
  // 防御 3：前缀检查
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null
  }
  
  // 防御 4：符号链接解析
  try {
    const real = await fs.realpath(resolved)
    if (!real.startsWith(root + path.sep) && real !== root) {
      return null
    }
    return real
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return resolved  // 文件不存在但路径合法
    return null
  }
}
```

### 路径校验的 4 层防御

```mermaid
graph TD
    A["输入路径"] --> B["第 1 层：空字节检查"]
    B --> C["第 2 层：path.resolve() 解析"]
    C --> D["第 3 层：前缀检查"]
    D --> E["第 4 层：realpath() 符号链接检查"]
    E --> F["返回安全路径"]
    
    B -->|"包含 \0"| G["❌ 拒绝"]
    C -->|"解析失败"| H["❌ 拒绝"]
    D -->|"不在根目录内"| I["❌ 拒绝"]
    E -->|"符号链接指向外部"| J["❌ 拒绝"]
    
    style F fill:#c8e6c9
    style G fill:#ffcdd2
    style H fill:#ffcdd2
    style I fill:#ffcdd2
    style J fill:#ffcdd2
```

## 8.7 文件 I/O 性能优化

### 异步 vs 同步 I/O

```typescript
// ❌ 同步 I/O（阻塞事件循环）
const data = fs.readFileSync('file.txt', 'utf-8')  // 阻塞！
console.log(data)
// 其他请求必须等待...

// ✅ 异步 I/O（不阻塞事件循环）
const data = await fs.readFile('file.txt', 'utf-8')  // 不阻塞
console.log(data)
// 其他请求可以并行处理
```

### 流式处理大文件

```typescript
// ❌ 错误：一次性读取整个文件到内存
const content = await fs.readFile('huge-file.txt', 'utf-8')  // 可能 OOM！

// ✅ 正确：使用流式处理
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

const stream = createReadStream('huge-file.txt')
const rl = createInterface({ input: stream })

for await (const line of rl) {
  // 逐行处理，内存占用恒定
  processLine(line)
}
```

### 并行 I/O 操作

```typescript
// ❌ 串行读取多个文件
const file1 = await fs.readFile('file1.txt')
const file2 = await fs.readFile('file2.txt')
const file3 = await fs.readFile('file3.txt')
// 总时间 = 时间1 + 时间2 + 时间3

// ✅ 并行读取多个文件
const [file1, file2, file3] = await Promise.all([
  fs.readFile('file1.txt'),
  fs.readFile('file2.txt'),
  fs.readFile('file3.txt'),
])
// 总时间 = max(时间1, 时间2, 时间3)
```

### 项目中的并行 I/O 示例

```typescript
// apps/server/src/routes/fs.ts — 目录列表

// 并行获取所有文件的 stat 信息
const result = (
  await Promise.all(
    entries.filter(e => !shouldHide(e.name)).map(async (e) => {
      const fullPath = path.join(resolved, e.name)
      try {
        const s = await fs.stat(fullPath)
        return {
          name: e.name,
          path: path.join(relativePath, e.name),
          type: e.isDirectory() ? 'directory' : 'file',
          size: e.isFile() ? s.size : undefined,
          modified: s.mtime.toISOString(),
        }
      } catch {
        return null
      }
    }),
  )
).filter(Boolean)
```

## 8.8 文件操作最佳实践

### 最佳实践 1：总是检查文件是否存在

```typescript
// ❌ 错误：直接操作文件
await fs.unlink('file.txt')  // 如果文件不存在会抛错

// ✅ 正确：先检查再操作
try {
  await fs.access('file.txt')
  await fs.unlink('file.txt')
} catch {
  // 文件不存在，忽略
}
```

### 最佳实践 2：使用原子写入

```typescript
// ❌ 错误：直接写入（可能导致数据丢失）
await fs.writeFile('important.json', data)

// ✅ 正确：原子写入
const tmpPath = 'important.json.tmp'
await fs.writeFile(tmpPath, data)
await fs.rename(tmpPath, 'important.json')
```

### 最佳实践 3：限制文件大小

```typescript
// 在读取前检查文件大小
const stat = await fs.stat(filePath)
if (stat.size > MAX_FILE_SIZE) {
  return reply.code(413).send({ error: 'File too large' })
}
const content = await fs.readFile(filePath, 'utf-8')
```

### 最佳实践 4：清理临时文件

```typescript
// 使用 try-finally 确保临时文件被清理
const tmpPath = filePath + '.tmp'
try {
  await fs.writeFile(tmpPath, content)
  await fs.rename(tmpPath, filePath)
} catch (err) {
  // 清理可能残留的临时文件
  await fs.unlink(tmpPath).catch(() => {})
  throw err
}
```

### 最佳实践 5：使用流式处理大文件

```typescript
// ❌ 错误：一次性读取大文件
const content = await fs.readFile('huge.log', 'utf-8')  // 可能 OOM

// ✅ 正确：流式处理
const stream = createReadStream('huge.log')
let lineCount = 0
for await (const chunk of stream) {
  lineCount += chunk.toString().split('\n').length
}
```

---

## 附录：项目后端架构全景图

```mermaid
graph TB
    subgraph "客户端（浏览器）"
        WebApp["React SPA"]
        XtermJS["xterm.js 终端"]
        CodeMirror["CodeMirror 编辑器"]
    end
    
    subgraph "Fastify 服务"
        subgraph "安全层"
            CORS["@fastify/cors"]
            Helmet["@fastify/helmet"]
            RateLimit["@fastify/rate-limit"]
            AuthHook["Auth Plugin<br/>onRequest JWT 验证"]
        end
        
        subgraph "API 路由"
            AuthRoutes["/api/auth/*<br/>登录/用户管理"]
            FSRoutes["/api/fs/*<br/>文件读写"]
            TermRoute["/ws/terminal<br/>终端 WebSocket"]
            CtrlRoute["/ws/control<br/>控制 WebSocket"]
            HealthRoute["/health"]
            SwaggerRoute["/docs"]
        end
        
        subgraph "核心引擎"
            WSGateway["WSGateway<br/>WebSocket 网关"]
            SessionManager["SessionManager<br/>会话管理"]
            AuditLog["Audit Log<br/>审计日志"]
        end
        
        subgraph "外部依赖"
            PTY["node-pty<br/>终端进程"]
            Tmux["tmux<br/>会话保持"]
            JWT_Lib["jsonwebtoken"]
            Bcrypt["bcryptjs"]
            Pino["pino<br/>日志"]
        end
    end
    
    subgraph "存储"
        UsersFile[".users.json<br/>用户数据"]
        AuditFile[".audit.log<br/>审计日志"]
        SessionStore[".sessions.json<br/>会话持久化"]
    end
    
    WebApp --> AuthRoutes
    WebApp --> FSRoutes
    XtermJS --> TermRoute
    WebApp --> CtrlRoute
    
    AuthHook --> AuthRoutes
    AuthHook --> FSRoutes
    
    TermRoute --> WSGateway
    CtrlRoute --> WSGateway
    WSGateway --> SessionManager
    
    SessionManager --> PTY
    PTY --> Tmux
    AuthRoutes --> JWT_Lib
    AuthRoutes --> Bcrypt
    AuthRoutes --> UsersFile
    
    FSRoutes --> AuditLog
    AuthRoutes --> AuditLog
    AuditLog --> AuditFile
    SessionManager --> SessionStore
    
    style WebApp fill:#e3f2fd
    style WSGateway fill:#fff3e0
    style SessionManager fill:#e8f5e9
    style AuthHook fill:#fce4ec
```

---

## 小结

本篇覆盖了后端开发的核心知识：

| 章节 | 核心概念 | 关键技术 |
|------|---------|---------|
| RESTful API | URL 设计、HTTP 方法语义、状态码 | REST 架构风格 |
| Fastify 框架 | 实例创建、路由注册、插件系统 | Fastify、fastify-plugin |
| 中间件与钩子 | 生命周期钩子、onRequest、preHandler | 钩子链、封装作用域 |
| 请求验证 | JSON Schema、Zod | 类型安全验证 |
| 认证与授权 | JWT、bcrypt、双 Token | 安全最佳实践 |
| WebSocket | 双通道架构、状态机、心跳 | @fastify/websocket |
| 错误处理 | 全局策略、pino 日志、审计日志 | 结构化日志 |
| 文件系统 API | 路径校验、原子写入、限流 | 安全防护 |

> 📚 **推荐阅读顺序**：
> 1. 先理解 REST 和 HTTP 方法（第一章）
> 2. 再学 Fastify 基础（第二章）
> 3. 然后是中间件和验证（第三、四章）
> 4. 最后是认证、WebSocket 和文件系统（第五-八章）

---

> 📖 **下一篇**：[第11篇 — 待定](#)

---

## 附录 A：Node.js 后端开发常见问题

### Q1：为什么用 async/await 而不是 callback？

```typescript
// ❌ 回调地狱（Callback Hell）
fs.readFile('file1.txt', (err, data1) => {
  if (err) throw err
  fs.readFile('file2.txt', (err, data2) => {
    if (err) throw err
    fs.readFile('file3.txt', (err, data3) => {
      if (err) throw err
      console.log(data1, data2, data3)
    })
  })
})

// ✅ async/await（现代写法）
try {
  const data1 = await fs.readFile('file1.txt')
  const data2 = await fs.readFile('file2.txt')
  const data3 = await fs.readFile('file3.txt')
  console.log(data1, data2, data3)
} catch (err) {
  console.error(err)
}
```

### Q2：什么是事件循环（Event Loop）？

```mermaid
graph TD
    A["Node.js 启动"] --> B["执行同步代码"]
    B --> C["检查微任务队列
(Promise.then)"]
    C --> D["检查宏任务队列
(setTimeout, setInterval)"]
    D --> E["检查 I/O 回调
(文件操作, 网络请求)"]
    E --> F["空闲"]
    F --> C
    
    style B fill:#e3f2fd
    style C fill:#e8f5e9
    style D fill:#fff3e0
    style E fill:#f3e5f5
```

> 💡 **关键理解**：Node.js 是单线程的，但通过事件循环实现了异步 I/O。
> 所有同步操作都会阻塞事件循环，所以要避免在主线程执行 CPU 密集型任务。

### Q3：什么是背压（Backpressure）？

```mermaid
graph LR
    A["生产者
(PTY 输出)"] -->|"数据流"| B["缓冲区"]
    B -->|"数据流"| C["消费者
(WebSocket)"]
    
    A -->|"速度太快"| D["缓冲区满"]
    D --> E["背压
(丢弃数据)"]
    
    style D fill:#ffcdd2
    style E fill:#ffcdd2
```

```typescript
// 项目中的背压处理
for (const client of session.termClients) {
  if (client.readyState !== 1) continue
  if (client.bufferedAmount > BACKPRESSURE_THRESHOLD) {
    // 背压：客户端接收太慢，跳过本次发送
    this.sendBackpressureWarning(session)
    continue
  }
  client.send(merged)
}
```

## 附录 B：TypeScript 在后端开发中的应用

### 类型守卫（Type Guard）

```typescript
// 使用类型守卫缩小类型范围
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

// 使用示例
const body = request.body as Record<string, unknown>
if (isString(body.username)) {
  // 这里 body.username 的类型是 string
  console.log(body.username.toUpperCase())
}
```

### 泛型约束

```typescript
// 使用泛型约束创建类型安全的路由处理函数
interface TypedRequest<T> {
  body: T
  query: Record<string, string>
  params: Record<string, string>
}

function createHandler<T>(
  validator: (body: unknown) => body is T,
  handler: (request: TypedRequest<T>, reply: FastifyReply) => Promise<unknown>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!validator(request.body)) {
      return reply.code(400).send({ error: 'Invalid request body' })
    }
    return handler(request as TypedRequest<T>, reply)
  }
}
```

### 联合类型与类型收窄

```typescript
// 联合类型
interface SuccessResponse {
  status: 'success'
  data: unknown
}

interface ErrorResponse {
  status: 'error'
  error: string
}

type ApiResponse = SuccessResponse | ErrorResponse

// 类型收窄
function handleResponse(response: ApiResponse) {
  if (response.status === 'success') {
    // 这里 response 的类型是 SuccessResponse
    console.log(response.data)
  } else {
    // 这里 response 的类型是 ErrorResponse
    console.error(response.error)
  }
}
```

## 附录 C：后端开发术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 中间件 | Middleware | 请求处理管道中的函数 |
| 钩子 | Hook | 生命周期中的回调函数 |
| 路由 | Route | URL 到处理函数的映射 |
| 插件 | Plugin | 可复用的功能模块 |
| 认证 | Authentication | 验证用户身份 |
| 授权 | Authorization | 检查用户权限 |
| JWT | JSON Web Token | 自包含的身份令牌 |
| bcrypt | bcrypt | 密码哈希算法 |
| CORS | Cross-Origin Resource Sharing | 跨域资源共享 |
| CSP | Content Security Policy | 内容安全策略 |
| XSS | Cross-Site Scripting | 跨站脚本攻击 |
| CSRF | Cross-Site Request Forgery | 跨站请求伪造 |
| SQL 注入 | SQL Injection | SQL 查询注入攻击 |
| 路径穿越 | Path Traversal | 文件路径穿越攻击 |
| 背压 | Backpressure | 数据流速度不匹配 |
| 原子操作 | Atomic Operation | 不可中断的操作 |
| 幂等性 | Idempotency | 多次执行结果相同 |
| 无状态 | Stateless | 服务端不保存客户端状态 |
| 全双工 | Full Duplex | 双向同时通信 |
| 心跳 | Heartbeat | 连接保活探测 |
| 限流 | Rate Limiting | 限制请求频率 |
| 审计日志 | Audit Log | 安全合规日志 |
| 结构化日志 | Structured Logging | JSON 格式的日志 |
| 事件循环 | Event Loop | Node.js 的异步执行机制 |
| PTY | Pseudo Terminal | 伪终端 |
| tmux | Terminal Multiplexer | 终端复用器 |
| WebSocket | WebSocket | 全双工通信协议 |
| HTTP/2 | HTTP/2 | HTTP 协议第二版 |
| gRPC | Google Remote Procedure Call | 高性能 RPC 框架 |
| GraphQL | GraphQL | 查询语言 |
| REST | Representational State Transfer | API 设计风格 |
| JSON Schema | JSON Schema | JSON 数据验证规范 |
| Zod | Zod | TypeScript 验证库 |
| pino | pino | 高性能日志库 |
| Swagger | Swagger | API 文档工具 |
| OpenAPI | OpenAPI | API 规范标准 |

## 附录 D：推荐阅读与资源

### 官方文档
- [Fastify 官方文档](https://www.fastify.io/docs/latest/)
- [Node.js 官方文档](https://nodejs.org/en/docs/)
- [TypeScript 官方文档](https://www.typescriptlang.org/docs/)
- [JWT 官方网站](https://jwt.io/)
- [bcrypt.js 文档](https://github.com/kelektiv/node.bcrypt.js)
- [pino 文档](https://getpino.io/)

### 推荐书籍
- 《Node.js 设计模式》— Mario Casciaro
- 《深入浅出 Node.js》— 朴灵
- 《TypeScript 编程》— Boris Cherny
- 《Web 安全攻防》— 徐焱
- 《RESTful Web APIs》— Leonard Richardson

### 在线资源
- [MDN Web 文档](https://developer.mozilla.org/zh-CN/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Fastify GitHub](https://github.com/fastify/fastify)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## 附录 E：项目文件索引

| 文件路径 | 说明 | 对应章节 |
|---------|------|----------|
| `apps/server/src/index.ts` | 服务器入口 | 第二章 |
| `apps/server/src/lib/config.ts` | 配置验证 | 第四章 |
| `apps/server/src/lib/logger.ts` | 日志配置 | 第七章 |
| `apps/server/src/lib/wsAuth.ts` | WebSocket 认证 | 第六章 |
| `apps/server/src/plugins/auth.ts` | 认证插件 | 第三、五章 |
| `apps/server/src/routes/auth.ts` | 认证路由 | 第五章 |
| `apps/server/src/routes/fs.ts` | 文件系统路由 | 第八章 |
| `apps/server/src/routes/terminal.ts` | 终端 WebSocket 路由 | 第六章 |
| `apps/server/src/routes/control.ts` | 控制 WebSocket 路由 | 第六章 |
| `apps/server/src/core/WSGateway.ts` | WebSocket 网关 | 第六章 |
| `apps/server/src/core/SessionManager.ts` | 会话管理 | 第六、七章 |
| `apps/server/src/core/audit.ts` | 审计日志 | 第七章 |
| `apps/server/src/core/recorder.ts` | 会话录制 | 第六章 |
| `apps/server/src/core/sessionStore.ts` | 会话持久化 | 第六章 |
| `apps/server/src/types/fastify.d.ts` | 类型扩展 | 第二章 |
| `packages/shared/src/protocol.ts` | 协议定义 | 第六章 |

---

> 📖 完成！本篇共覆盖了 8 个核心主题，从 RESTful API 设计到文件系统安全，
> 所有示例均来自 AI-CLI-Mobile 项目的真实代码。
> 建议结合项目源码一起阅读，加深理解。

---

## 附录 F：Node.js 后端开发实战指南

### F.1 项目初始化与依赖管理

#### package.json 配置详解

```json
{
  "name": "@ai-cli/server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/helmet": "^13.0.0",
    "@fastify/websocket": "^11.0.0",
    "@fastify/swagger": "^9.0.0",
    "@fastify/swagger-ui": "^5.0.0",
    "@fastify/static": "^8.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "fastify-plugin": "^5.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "pino": "^9.0.0",
    "pino-pretty": "^13.0.0",
    "zod": "^3.23.0",
    "node-pty": "^1.0.0",
    "strip-ansi": "^7.1.0",
    "@ai-cli/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "tsx": "^4.19.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.6",
    "eslint": "^9.0.0"
  }
}
```

#### 依赖分类说明

| 类别 | 包名 | 用途 | 为什么选它 |
|------|------|------|-----------|
| HTTP 框架 | fastify | Web 服务器 | 高性能、TypeScript 支持 |
| 安全 | @fastify/cors | 跨域支持 | Fastify 官方插件 |
| 安全 | @fastify/helmet | 安全头 | 自动设置安全相关的 HTTP 头 |
| WebSocket | @fastify/websocket | WebSocket 支持 | Fastify 官方插件 |
| 文档 | @fastify/swagger | API 文档 | 自动生成 OpenAPI 规范 |
| 认证 | jsonwebtoken | JWT 处理 | 最流行的 JWT 库 |
| 认证 | bcryptjs | 密码哈希 | 纯 JS 实现，无需编译 |
| 日志 | pino | 日志库 | 最快的 Node.js 日志库 |
| 验证 | zod | 数据验证 | TypeScript-first |
| 终端 | node-pty | 伪终端 | 创建和管理 PTY 进程 |
| 协议 | @ai-cli/shared | 共享类型 | monorepo 内部包 |

### F.2 TypeScript 配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/__tests__/**"]
}
```

#### 关键配置说明

| 配置项 | 值 | 说明 |
|--------|------|------|
| `target` | ES2022 | 编译目标版本 |
| `module` | NodeNext | 使用 Node.js 的 ESM 模块系统 |
| `strict` | true | 启用所有严格类型检查 |
| `esModuleInterop` | true | 允许 CommonJS 和 ESM 互操作 |
| `sourceMap` | true | 生成 source map，方便调试 |

### F.3 开发工具配置

#### ESLint 配置

```javascript
// eslint.config.js
import js from '@eslint/js'
import ts from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
]
```

#### Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
})
```

### F.4 环境变量管理

#### .env 文件模板

```bash
# .env.example

# ─── 必需 ───
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-at-least-32-chars
ADMIN_PASSWORD=your-admin-password-at-least-8-chars

# ─── 可选 ───
NODE_ENV=development
PORT=3000
PROJECT_ROOT=/workspace
ADMIN_USERNAME=admin
CORS_ORIGINS=http://localhost:5173
LOG_LEVEL=info
SHELL_CMD=bash
```

#### 环境变量验证流程

```mermaid
graph TD
    A[".env 文件"] --> B["process.env"]
    B --> C["validateConfig()"]
    C --> D{"验证通过？"}
    D -->|"是"| E["返回 AppConfig"]
    D -->|"否"| F["打印错误详情"]
    F --> G["process.exit(1)"]
    
    E --> H["应用启动"]
    
    style D fill:#fff3e0
    style G fill:#ffcdd2
    style H fill:#c8e6c9
```

### F.5 启动流程详解

```mermaid
sequenceDiagram
    participant Main as index.ts
    participant Config as config.ts
    participant FW as Fastify
    participant Auth as auth.ts
    participant WS as WSGateway
    participant SM as SessionManager
    
    Main->>Config: validateConfig()
    Config->>Config: Zod 验证环境变量
    Config-->>Main: AppConfig
    
    Main->>FW: Fastify({ loggerInstance })
    Main->>FW: register(cors)
    Main->>FW: register(helmet)
    Main->>FW: register(websocket)
    Main->>FW: register(swagger)
    Main->>FW: register(swaggerUi)
    
    Main->>Auth: register(authPlugin)
    Auth->>FW: addHook('onRequest')
    
    Main->>FW: register(authRoutes, { prefix: '/api/auth' })
    Main->>FW: register(fsRoutes, { prefix: '/api/fs' })
    Main->>FW: register(terminalRoutes)
    Main->>FW: register(controlRoutes)
    
    Main->>SM: new SessionManager(adapters)
    SM->>SM: checkTmuxAvailable()
    SM->>SM: reapOrphanSessions()
    SM->>SM: startErrorRecoveryLoop()
    
    Main->>WS: new WSGateway(sm, jwtSecret, refreshSecret)
    Main->>FW: decorate('wsGateway', wsGateway)
    
    Main->>Auth: ensureAdminUser()
    Auth->>Auth: 检查/创建管理员账户
    
    Main->>FW: listen({ port: 3000 })
    FW-->>Main: Server listening
    
    Note over Main: 服务器启动完成
```

### F.6 请求处理全流程

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant FW as Fastify
    participant CORS as CORS
    participant Helmet as Helmet
    participant Auth as Auth 钩子
    participant RateLimit as Rate Limit
    participant Handler as 路由处理
    participant Audit as Audit Log
    
    Client->>FW: HTTP 请求
    FW->>CORS: 处理 CORS
    FW->>Helmet: 添加安全头
    FW->>Auth: onRequest 钩子
    
    alt 白名单路径
        Auth->>RateLimit: 跳过认证
    else 需要认证
        Auth->>Auth: 验证 JWT
        alt Token 无效
            Auth-->>Client: 401 Unauthorized
        end
        Auth->>RateLimit: request.user = decoded
    end
    
    RateLimit->>RateLimit: 检查速率限制
    alt 超过限制
        RateLimit-->>Client: 429 Too Many Requests
    end
    
    RateLimit->>Handler: 调用路由处理函数
    Handler->>Handler: 执行业务逻辑
    Handler->>Audit: 记录审计日志
    Handler-->>Client: 返回响应
```

### F.7 错误处理最佳实践

#### 错误分类

```mermaid
graph TD
    A["错误分类"] --> B["可预期错误"]
    A --> C["不可预期错误"]
    A --> D["致命错误"]
    
    B --> B1["参数错误 400"]
    B --> B2["认证失败 401"]
    B --> B3["权限不足 403"]
    B --> B4["资源不存在 404"]
    B --> B5["资源冲突 409"]
    B --> B6["请求太大 413"]
    B --> B7["频率超限 429"]
    
    C --> C1["数据库连接失败"]
    C --> C2["外部服务超时"]
    C --> C3["未知异常"]
    
    D --> D1["配置验证失败"]
    D --> D2["tmux 未安装"]
    D --> D3["端口被占用"]
    
    style B fill:#fff3e0
    style C fill:#ffcdd2
    style D fill:#ff8a80
```

#### 错误处理代码示例

```typescript
// 可预期错误：直接返回
if (!user) {
  return reply.code(404).send({ error: 'User not found' })
}

// 不可预期错误：try-catch + 日志
try {
  await riskyOperation()
} catch (err) {
  pinoLogger.error({ err }, 'Operation failed')
  return reply.code(500).send({ error: 'Internal server error' })
}

// 致命错误：日志 + 退出
try {
  config = validateConfig()
} catch (err) {
  pinoLogger.fatal(err, 'Config validation failed')
  process.exit(1)
}
```

### F.8 性能优化技巧

#### 技巧 1：避免阻塞事件循环

```typescript
// ❌ 错误：同步文件操作
const data = fs.readFileSync('file.txt')
const hash = crypto.createHash('sha256').update(data).digest('hex')

// ✅ 正确：异步文件操作
const data = await fs.readFile('file.txt')
const hash = crypto.createHash('sha256').update(data).digest('hex')

// ✅ 更好：流式处理
const hash = crypto.createHash('sha256')
const stream = fs.createReadStream('file.txt')
for await (const chunk of stream) {
  hash.update(chunk)
}
const result = hash.digest('hex')
```

#### 技巧 2：使用连接池

```typescript
// 数据库连接池示例（如果使用数据库）
import { Pool } from 'pg'

const pool = new Pool({
  max: 20,           // 最大连接数
  idleTimeoutMillis: 30000,  // 空闲超时
  connectionTimeoutMillis: 2000,  // 连接超时
})

// 使用连接
const client = await pool.connect()
try {
  const result = await client.query('SELECT * FROM users')
  return result.rows
} finally {
  client.release()  // 归还连接到池
}
```

#### 技巧 3：缓存策略

```typescript
// 简单的内存缓存
const cache = new Map<string, { data: unknown; expiry: number }>()

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiry: Date.now() + ttlMs })
}

// 使用示例
async function getUser(id: string) {
  const cached = getCached<User>(`user:${id}`)
  if (cached) return cached
  
  const user = await db.findUser(id)
  setCache(`user:${id}`, user, 60000)  // 缓存 1 分钟
  return user
}
```

#### 技巧 4：批量操作

```typescript
// ❌ 错误：逐个查询
for (const id of userIds) {
  const user = await db.findUser(id)  // N 次数据库查询
  users.push(user)
}

// ✅ 正确：批量查询
const users = await db.findUsers(userIds)  // 1 次数据库查询
```

### F.9 测试策略

#### 测试金字塔

```mermaid
graph TD
    A["测试金字塔"] --> B["单元测试\n（大量）"]
    A --> C["集成测试\n（适量）"]
    A --> D["端到端测试\n（少量）"]
    
    B --> B1["测试单个函数\n测试单个模块"]
    C --> C1["测试 API 端点\n测试数据库交互"]
    D --> D1["测试完整用户流程\n测试跨服务交互"]
    
    style B fill:#c8e6c9
    style C fill:#fff3e0
    style D fill:#e3f2fd
```

#### 单元测试示例

```typescript
// src/__tests__/config.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { validateConfig, resetConfig } from '../lib/config.js'

describe('validateConfig', () => {
  beforeEach(() => {
    resetConfig()
  })

  it('应该验证必需的环境变量', () => {
    const env = {
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    }
    const config = validateConfig(env)
    expect(config.JWT_SECRET).toBe(env.JWT_SECRET)
  })

  it('应该拒绝太短的 JWT_SECRET', () => {
    const env = {
      JWT_SECRET: 'short',
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    }
    expect(() => validateConfig(env)).toThrow()
  })

  it('应该使用默认值', () => {
    const env = {
      JWT_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
    }
    const config = validateConfig(env)
    expect(config.PORT).toBe(3000)
    expect(config.NODE_ENV).toBe('development')
    expect(config.LOG_LEVEL).toBe('info')
  })
})
```

#### 集成测试示例

```typescript
// src/__tests__/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify from 'fastify'
import authPlugin from '../plugins/auth.js'
import { authRoutes } from '../routes/auth.js'

describe('Auth API', () => {
  let fastify: Fastify.FastifyInstance

  beforeAll(async () => {
    fastify = Fastify()
    await fastify.register(authPlugin)
    await fastify.register(authRoutes, { prefix: '/api/auth' })
    await fastify.ready()
  })

  afterAll(async () => {
    await fastify.close()
  })

  it('POST /api/auth/login 应该返回 token', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('accessToken')
    expect(body).toHaveProperty('refreshToken')
  })

  it('POST /api/auth/login 应该拒绝错误的密码', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrong' },
    })

    expect(response.statusCode).toBe(401)
  })
})
```

### F.10 部署与运维

#### Docker 部署

```dockerfile
# Dockerfile
FROM node:22-slim

# 安装 tmux（项目依赖）
RUN apt-get update && apt-get install -y tmux && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY apps/server/ ./apps/server/
COPY packages/shared/ ./packages/shared/

# 构建
RUN pnpm --filter @ai-cli/server build
RUN pnpm --filter @ai-cli/shared build

# 运行
WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]
```

#### Docker Compose 配置

```yaml
# docker-compose.yml
version: '3.8'

services:
  server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
      - NODE_ENV=production
      - PORT=3000
      - PROJECT_ROOT=/workspace
    volumes:
      - workspace:/workspace
    restart: unless-stopped

volumes:
  workspace:
```

#### 健康检查

```typescript
// 健康检查端点
fastify.get('/health', async () => ({
  status: 'ok',
  // 不返回时间戳，避免信息泄露
}))

// Docker 健康检查
// HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
//   CMD curl -f http://localhost:3000/health || exit 1
```

### F.11 监控与告警

#### 监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| 请求延迟 | API 响应时间 | p99 > 5s |
| 错误率 | 5xx 错误占比 | > 1% |
| 内存使用 | 进程内存 | > 80% |
| CPU 使用 | 进程 CPU | > 80% |
| 活跃连接 | WebSocket 连接数 | > 1000 |
| 登录失败 | 失败次数/分钟 | > 10 |

#### Prometheus 指标示例

```typescript
import { Counter, Histogram, Gauge } from 'prom-client'

// 请求计数器
const httpRequests = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
})

// 请求延迟直方图
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
})

// 活跃 WebSocket 连接
const wsConnections = new Gauge({
  name: 'ws_connections_active',
  help: 'Active WebSocket connections',
  labelNames: ['channel'],
})

// 在路由中使用
fastify.addHook('onResponse', async (request, reply) => {
  httpRequests.inc({
    method: request.method,
    path: request.url,
    status: reply.statusCode,
  })
})
```


---

## 附录 G：WebSocket 协议深入解析

### G.1 WebSocket 协议帧格式

WebSocket 协议使用帧（Frame）来传输数据：

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
|N|V|V|V|       |S|             |   (if payload len==126/127)   |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
|     Extended payload length continued, if payload len == 127  |
+ - - - - - - - - - - - - - - - +-------------------------------+
|                               |Masking-key, if MASK set to 1  |
+-------------------------------+-------------------------------+
| Masking-key (continued)       |          Payload Data         |
+-------------------------------- - - - - - - - - - - - - - - - +
:                     Payload Data continued ...                :
+ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
|                     Payload Data continued ...                |
+---------------------------------------------------------------+
```

#### 帧字段说明

| 字段 | 位数 | 说明 |
|------|------|------|
| FIN | 1 | 是否是消息的最后一帧 |
| RSV1-3 | 3 | 保留位，用于扩展 |
| opcode | 4 | 帧类型（文本、二进制、关闭、Ping、Pong） |
| MASK | 1 | 是否使用掩码（客户端→服务端必须掩码） |
| Payload len | 7 | 载荷长度（0-125 直接使用，126 用 16 位扩展，127 用 64 位扩展） |
| Masking key | 32 | 掩码密钥（如果 MASK=1） |
| Payload data | 变长 | 实际数据 |

#### opcode 类型

| opcode | 类型 | 说明 |
|--------|------|------|
| 0x0 | Continuation | 帧的后续部分 |
| 0x1 | Text | 文本帧（UTF-8 编码） |
| 0x2 | Binary | 二进制帧 |
| 0x8 | Close | 关闭连接 |
| 0x9 | Ping | 心跳探测 |
| 0xA | Pong | 心跳响应 |

### G.2 WebSocket 握手详解

```http
// 客户端发送升级请求
GET /ws/terminal HTTP/1.1
Host: server.com:3000
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Sec-WebSocket-Protocol: terminal
Origin: http://localhost:5173

// 服务端回复
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
Sec-WebSocket-Protocol: terminal
```

#### 握手过程

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Server as 服务端
    
    Client->>Server: HTTP GET /ws/terminal
    Note over Client: Upgrade: websocket<br/>Sec-WebSocket-Key: xxx
    
    Server->>Server: 验证请求
    Server->>Server: 计算 Sec-WebSocket-Accept
    
    Server->>Client: HTTP 101 Switching Protocols
    Note over Server: Sec-WebSocket-Accept: yyy
    
    Note over Client,Server: 握手完成，切换到 WebSocket 协议
    
    Client->>Server: WebSocket 帧（二进制/文本）
    Server->>Client: WebSocket 帧（二进制/文本）
```

### G.3 WebSocket 与 HTTP/2 Server-Sent Events 对比

| 特性 | WebSocket | SSE | HTTP/2 Push |
|------|-----------|-----|-------------|
| 通信方向 | 双向 | 服务端→客户端 | 服务端→客户端 |
| 协议 | ws://, wss:// | HTTP | HTTP/2 |
| 数据格式 | 文本/二进制 | 文本 | 二进制 |
| 自动重连 | 需手动实现 | ✅ 内置 | N/A |
| 浏览器支持 | 所有现代浏览器 | 所有现代浏览器 | 大部分浏览器 |
| 适用场景 | 实时双向通信 | 服务端推送 | 资源预加载 |

### G.4 项目中的双通道设计详解

```mermaid
graph TD
    subgraph "客户端"
        TC["Terminal Client<br/>xterm.js"]
        CC["Control Client<br/>React"]
    end
    
    subgraph "服务端"
        TR["/ws/terminal<br/>Terminal Route"]
        CR["/ws/control<br/>Control Route"]
        
        WSG["WSGateway"]
        
        TM["handleTerminalConnection<br/>二进制模式"]
        CM["handleControlConnection<br/>JSON 模式"]
        
        SM["SessionManager"]
        PTY["node-pty"]
    end
    
    TC <-->|"二进制数据\n键盘输入/屏幕输出"| TR
    CC <-->|"JSON 消息\n控制指令"| CR
    
    TR --> WSG
    CR --> WSG
    WSG --> TM
    WSG --> CM
    
    TM --> SM
    CM --> SM
    SM --> PTY
    
    style TC fill:#e3f2fd
    style CC fill:#fff3e0
    style TM fill:#e3f2fd
    style CM fill:#fff3e0
```

#### 为什么终端通道用二进制？

```typescript
// 终端数据是高频的字符流
// 如果用 JSON，每个字符都需要序列化/反序列化
// 开销太大！

// ❌ JSON 模式（低效）
ws.send(JSON.stringify({ type: 'KEY', data: 'a' }))
// 每个字符 ~50 字节 JSON 开销

// ✅ 二进制模式（高效）
ws.send(Buffer.from([0x61]))  // 'a' 的 ASCII 码
// 每个字符 1 字节

// 项目中的实现
// Terminal 通道：直接发送原始字节
ws.on('message', (data: Buffer) => {
  // 直接转发给 PTY，无需解析
  this.sessionManager.sendInput(sessionId, data)
})
```

#### 为什么控制通道用 JSON？

```typescript
// 控制消息是低频的结构化数据
// 需要可读性和类型安全

// ✅ JSON 模式（可读、类型安全）
ws.send(JSON.stringify({
  type: 'INIT_SESSION',
  sessionId: 'my-session',
  cols: 80,
  rows: 24,
  adapter: 'claude',
}))

// 接收方可以使用 TypeScript 类型收窄
switch (msg.type) {
  case 'INIT_SESSION':
    // msg 的类型自动收窄为 { type: 'INIT_SESSION', sessionId: string, ... }
    console.log(msg.sessionId)
    break
  case 'RESIZE':
    // msg 的类型自动收窄为 { type: 'RESIZE', cols: number, rows: number }
    console.log(msg.cols, msg.rows)
    break
}
```

### G.5 WebSocket 连接生命周期

```mermaid
stateDiagram-v2
    [*] --> CONNECTING: new WebSocket()
    
    CONNECTING --> OPEN: 连接成功
    CONNECTING --> CLOSED: 连接失败
    
    OPEN --> CLOSING: close() 调用
    OPEN --> CLOSED: 连接断开
    
    CLOSING --> CLOSED: 关闭完成
    
    state OPEN {
        [*] --> AUTHENTICATING: 发送 AUTH
        AUTHENTICATED --> SESSION_ATTACHING: 发送 ATTACH
        SESSION_ATTACHED --> MESSAGE_HANDLING: 正常通信
        AUTHENTICATING --> AUTHENTICATED: 收到 AUTH_OK
        SESSION_ATTACHING --> SESSION_ATTACHED: 收到 SESSION_READY
    }
    
    state CLOSING {
        [*] --> SENDING_CLOSE: 发送关闭帧
        SENDING_CLOSE --> WAITING_RESPONSE: 等待响应
        WAITING_RESPONSE --> CLOSED: 收到响应或超时
    }
```

### G.6 WebSocket 调试技巧

#### 使用浏览器开发者工具

1. 打开 Chrome DevTools
2. 切换到 Network 标签
3. 筛选 WS 协议
4. 点击 WebSocket 连接
5. 查看 Messages 标签

#### 使用 wscat 命令行工具

```bash
# 安装 wscat
npm install -g wscat

# 连接到 WebSocket 服务器
wscat -c "ws://localhost:3000/ws/control?token=eyJhbG..."

# 发送认证消息
> {"type":"AUTH","accessToken":"eyJhbG...","protocolVersion":"0.1.0"}

# 收到认证成功
< {"type":"AUTH_OK"}

# 初始化会话
> {"type":"INIT_SESSION","sessionId":"test","cols":80,"rows":24,"adapter":"claude"}

# 收到会话就绪
< {"type":"SESSION_READY","sessionId":"test"}
```

#### 使用 websocat 工具

```bash
# 安装 websocat
# macOS: brew install websocat
# Linux: cargo install websocat

# 连接到终端通道
websocat "ws://localhost:3000/ws/terminal?token=eyJhbG..."

# 发送认证消息
{"type":"AUTH","accessToken":"eyJhbG..."}

# 发送键盘输入
[二进制数据]
```

---

## 附录 H：Fastify 插件开发指南

### H.1 插件的基本结构

```typescript
// 一个最小的 Fastify 插件
import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'

async function myPlugin(fastify: FastifyInstance, options: object) {
  // 插件逻辑
}

export default fp(myPlugin, {
  name: 'my-plugin',  // 插件名称（用于调试）
  fastify: '5.x',     // 兼容的 Fastify 版本
})
```

### H.2 插件类型

| 类型 | 说明 | 示例 |
|------|------|------|
| 功能插件 | 添加新功能 | @fastify/cors, @fastify/helmet |
| 路由插件 | 注册路由 | authRoutes, fsRoutes |
| 装饰器插件 | 扩展实例 | fastify.decorate('wsGateway', ...) |
| 钩子插件 | 添加生命周期钩子 | authPlugin |

### H.3 插件封装示例

```typescript
// 不使用 fp() 的插件（有封装作用域）
async function scopedPlugin(fastify: FastifyInstance) {
  // 这里添加的 decorate、hook 只在本插件内可见
  fastify.decorate('helper', () => 'hello')
  
  fastify.addHook('onRequest', async (request) => {
    // 这个钩子只对本插件注册的路由生效
    console.log('Scoped hook')
  })
  
  fastify.get('/scoped', async () => {
    // 可以使用 fastify.helper()
    return { message: fastify.helper() }
  })
}

// 使用 fp() 的插件（无封装作用域）
async function globalPlugin(fastify: FastifyInstance) {
  // 这里添加的 decorate、hook 对整个 Fastify 实例可见
  fastify.decorate('globalHelper', () => 'world')
  
  fastify.addHook('onRequest', async (request) => {
    // 这个钩子对所有路由生效
    console.log('Global hook')
  })
}

export default fp(globalPlugin)
```

### H.4 项目中的插件示例

```typescript
// apps/server/src/plugins/auth.ts

import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'

const WHITELIST_PATHS = ['/health', '/api/auth/login', '/api/auth/refresh']

async function authPlugin(fastify: FastifyInstance) {
  // 添加全局 onRequest 钩子
  fastify.addHook('onRequest', async (request, reply) => {
    const urlPath = request.url.split('?')[0]
    
    // 白名单路径直接放行
    if (WHITELIST_PATHS.some(p => urlPath === p)) {
      return
    }

    // 验证 JWT
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid authorization header' })
    }

    const token = authHeader.slice(7)
    try {
      const decoded = jwt.verify(token, getConfig().JWT_SECRET)
      request.user = decoded
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }
  })
}

// 使用 fp() 包装，让钩子对所有路由生效
export default fp(authPlugin)
```

---

## 附录 I：常见面试题与解答

### I.1 RESTful API 相关

**Q1：什么是 REST？REST 的约束有哪些？**

> REST（Representational State Transfer）是一种 API 设计风格。它的约束包括：
> - 客户端-服务器分离
> - 无状态
> - 可缓存
> - 统一接口
> - 分层系统
> - 按需代码（可选）

**Q2：GET 和 POST 的区别？**

> - GET 是安全的（不修改数据），POST 不是
> - GET 是幂等的（多次调用结果相同），POST 不是
> - GET 参数在 URL 中，POST 参数在请求体中
> - GET 可以被缓存，POST 不可以

**Q3：什么是幂等性？哪些 HTTP 方法是幂等的？**

> 幂等意味着同一个请求执行一次和执行多次，效果完全一样。
> 幂等方法：GET、PUT、DELETE、HEAD、OPTIONS
> 非幂等方法：POST、PATCH

### I.2 Node.js 相关

**Q4：什么是事件循环？**

> 事件循环是 Node.js 的核心机制，它允许 Node.js 执行非阻塞 I/O 操作。
> 事件循环的阶段：timers → pending callbacks → idle/prepare → poll → check → close callbacks

**Q5：什么是背压？如何处理？**

> 背压是当数据生产速度超过消费速度时产生的压力。
> 处理方式：检查 bufferedAmount，超过阈值时跳过发送。

**Q6：如何避免阻塞事件循环？**

> - 使用异步 API（fs.readFile 而不是 fs.readFileSync）
> - 使用 Worker Threads 处理 CPU 密集型任务
> - 使用流式处理大文件
> - 避免在主线程执行复杂计算

### I.3 安全相关

**Q7：什么是 JWT？JWT 的结构是什么？**

> JWT（JSON Web Token）是一种自包含的身份令牌。
> 结构：Header.Payload.Signature
> - Header：算法和类型
> - Payload：用户信息
> - Signature：签名

**Q8：为什么用 bcrypt 而不是 SHA-256 存储密码？**

> - bcrypt 故意设计得很慢，防止暴力破解
> - bcrypt 内置加盐，防止彩虹表攻击
> - bcrypt 可以配置迭代次数，平衡安全性和性能
> - SHA-256 太快，不适合密码哈希

**Q9：什么是路径穿越攻击？如何防御？**

> 路径穿越是攻击者通过 `../../` 等路径访问服务器上的敏感文件。
> 防御方式：
> - 使用 path.resolve() 解析路径
> - 检查路径是否在允许的目录内
> - 检查空字节
> - 解析符号链接

### I.4 WebSocket 相关

**Q10：WebSocket 和 HTTP 的区别？**

> - HTTP 是请求-响应模式，WebSocket 是全双工通信
> - HTTP 是无状态的，WebSocket 是有状态的长连接
> - HTTP 每次请求都带完整头部，WebSocket 握手后几乎无开销
> - WebSocket 适合实时通信，HTTP 适合 REST API

**Q11：如何处理 WebSocket 断线重连？**

> - 使用指数退避算法（1s, 2s, 4s, 8s...）
> - 添加随机抖动，避免惊群效应
> - 设置最大重连次数
> - 区分正常关闭和异常关闭

**Q12：什么是心跳检测？为什么需要？**

> 心跳检测是定期发送探测消息，检查连接是否存活。
> 需要原因：TCP 连接可能因为网络问题静默断开，不发心跳无法检测。


---

## 附录 J：项目代码逐行解析

### J.1 index.ts 入口文件解析

```typescript
// apps/server/src/index.ts

// 1. 导入依赖
import Fastify from 'fastify'           // HTTP 框架
import cors from '@fastify/cors'         // CORS 插件
import helmet from '@fastify/helmet'     // 安全头插件
import websocket from '@fastify/websocket' // WebSocket 插件
import fastifyStatic from '@fastify/static' // 静态文件服务
import swagger from '@fastify/swagger'   // API 文档
import swaggerUi from '@fastify/swagger-ui' // API 文档 UI
import path from 'path'                  // 路径处理
import fs from 'fs/promises'             // 文件系统
import authPlugin from './plugins/auth.js' // 认证插件
import { authRoutes, ensureAdminUser } from './routes/auth.js' // 认证路由
import { ClaudeCodeAdapter } from './adapters/claude.js' // Claude 适配器
import { AiderAdapter } from './adapters/aider.js' // Aider 适配器
import { ShellAdapter } from './adapters/shell.js' // Shell 适配器
import { SessionManager } from './core/SessionManager.js' // 会话管理器
import { terminalRoutes } from './routes/terminal.js' // 终端路由
import { controlRoutes } from './routes/control.js' // 控制路由
import { fsRoutes } from './routes/fs.js' // 文件系统路由
import { pinoLogger } from './lib/logger.js' // 日志
import { validateConfig } from './lib/config.js' // 配置验证
import { WSGateway } from './core/WSGateway.js' // WebSocket 网关
import { closeAuditLog } from './core/audit.js' // 审计日志

// 2. 创建 Fastify 实例
// 传入自定义的 pino logger，而不是使用 Fastify 内置的 logger
const fastify = Fastify({ loggerInstance: pinoLogger })

// 3. 全局状态
let serverStarted = false
let sessionManager: SessionManager | null = null

// 4. 启动函数
async function start() {
  // 4.1 验证配置
  // 使用 Zod 验证所有环境变量，失败则打印详细错误并退出
  let config
  try {
    config = validateConfig()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    pinoLogger.fatal(message)  // 致命错误日志
    process.exit(1)            // 退出进程
  }

  // 4.2 注册 CORS 插件
  // 从环境变量读取允许的源，多个用逗号分隔
  const corsOrigins = config.CORS_ORIGINS
  if (corsOrigins) {
    await fastify.register(cors, {
      origin: corsOrigins.split(',').map(s => s.trim()),
    })
  } else {
    await fastify.register(cors, { origin: true })  // 开发模式允许所有
  }

  // 4.3 注册 Helmet 插件（安全头）
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })

  // 4.4 注册 WebSocket 插件
  await fastify.register(websocket)

  // 4.5 注册认证插件（全局 JWT 验证）
  await fastify.register(authPlugin)

  // 4.6 注册 Swagger/OpenAPI 文档
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'AI-CLI Mobile API',
        description: 'Mobile AI Programming CLI Gateway 后端 API 文档',
        version: '0.1.0',
      },
      servers: [
        { url: 'http://localhost:3000', description: '开发环境' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })

  // 4.7 注册 Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: true,
  })

  // 4.8 注册 API 路由
  await fastify.register(authRoutes, { prefix: '/api/auth' })

  // 4.9 创建适配器
  const adapters = new Map<string, import('./adapters/base.js').CLIAdapter>()
  adapters.set('claude', new ClaudeCodeAdapter())
  adapters.set('aider', new AiderAdapter())
  adapters.set('shell', new ShellAdapter())

  // 4.10 创建会话管理器
  sessionManager = new SessionManager(adapters)

  // 4.11 创建 WebSocket 网关
  const wsGateway = new WSGateway(
    sessionManager,
    config.JWT_SECRET,
    config.JWT_REFRESH_SECRET,
  )
  fastify.decorate('wsGateway', wsGateway)

  // 4.12 注册 WebSocket 路由
  await fastify.register(terminalRoutes)
  await fastify.register(controlRoutes)
  await fastify.register(fsRoutes, { prefix: '/api/fs' })

  // 4.13 服务前端静态文件（生产环境）
  const webDistPath = path.resolve(import.meta.dirname, '../../web/dist')
  try {
    await fs.access(webDistPath)  // 检查目录是否存在
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    })
    // SPA fallback：所有非 API、非 WS 路由返回 index.html
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api') || request.url.startsWith('/ws')) {
        reply.code(404).send({ error: 'Not found' })
        return
      }
      try {
        reply.type('text/html').sendFile('index.html')
      } catch {
        reply.code(404).send({ error: 'Not found' })
      }
    })
  } catch {
    // web/dist 不存在（开发模式），跳过静态文件服务
  }

  // 4.14 健康检查端点
  fastify.get('/health', async () => ({ status: 'ok' }))

  // 4.15 确保管理员用户存在
  await ensureAdminUser()

  // 4.16 启动服务器
  const port = config.PORT
  try {
    await fastify.listen({ port, host: '0.0.0.0' })
    serverStarted = true
    pinoLogger.info({ port }, 'Server listening')
  } catch (err) {
    pinoLogger.error(err, 'Failed to start server')
    process.exit(1)
  }
}

// 5. 关闭函数
async function shutdown() {
  // 销毁 WebSocket 网关（清理定时器）
  const gateway = fastify.wsGateway
  if (gateway) {
    gateway.destroy()
  }
  // 销毁会话管理器（清理所有会话）
  if (sessionManager) {
    sessionManager.destroy()
  }
  // 关闭审计日志流
  await closeAuditLog()
  // 关闭 HTTP 服务器
  if (serverStarted) {
    await fastify.close()
  }
  process.exit(0)
}

// 6. 注册信号处理
process.on('SIGINT', shutdown)   // Ctrl+C
process.on('SIGTERM', shutdown)  // Docker stop

// 7. 启动
start()
```

### J.2 config.ts 配置验证解析

```typescript
// apps/server/src/lib/config.ts

// 1. 导入 Zod
import { z } from 'zod/v4'

// 2. 定义配置 Schema
const configSchema = z.object({
  // 必需字段
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),

  // 可选字段（带默认值）
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  PROJECT_ROOT: z.string().default('/workspace'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_PASSWORD: z.union([
    z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
    z.literal('')
  ]).optional(),
  CORS_ORIGINS: z.string().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SHELL_CMD: z.string().default('bash'),
})

// 3. 导出类型
export type AppConfig = z.infer<typeof configSchema>

// 4. 验证函数
export function validateConfig(
  env: Record<string, string | undefined> = process.env
): AppConfig {
  const result = configSchema.safeParse(env)
  if (!result.success) {
    const errors = result.error.issues
      .map(i => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Environment variable validation failed:\n${errors}`)
  }
  return result.data
}

// 5. 全局配置单例
let _config: AppConfig | null = null

export function getConfig(): AppConfig {
  if (!_config || process.env.NODE_ENV === 'test') {
    _config = validateConfig()
  }
  return _config
}

export function resetConfig(): void {
  _config = null
}
```

### J.3 auth.ts 认证路由解析

```typescript
// apps/server/src/routes/auth.ts

// 1. 确保管理员用户存在
export async function ensureAdminUser() {
  const config = getConfig()
  const adminUsername = config.ADMIN_USERNAME
  const adminPassword = config.ADMIN_PASSWORD

  if (!adminPassword) {
    pinoLogger.fatal('ADMIN_PASSWORD not set, cannot create admin user')
    process.exit(1)
  }

  if (!hasUser(adminUsername)) {
    const passwordHash = await bcrypt.hash(adminPassword, 10)
    createUser(adminUsername, {
      userId: crypto.randomUUID(),
      username: adminUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    })
    pinoLogger.info({ username: adminUsername }, 'Admin user created')
  }
}

// 2. 生成 Token 对
function generateTokenPair(userId: string, username: string): TokenPair {
  const config = getConfig()
  
  // Access Token：短期（15 分钟）
  const accessToken = jwt.sign(
    { userId, username },
    config.JWT_SECRET,
    { expiresIn: '15m' }
  )
  
  // Refresh Token：长期（7 天）
  const refreshToken = jwt.sign(
    { userId, username },
    config.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  )
  
  return { accessToken, refreshToken }
}

// 3. 注册路由
export async function authRoutes(fastify: FastifyInstance) {
  // 3.1 注册限流插件
  await fastify.register(rateLimit, {
    max: 5,           // 5 次/分钟
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,  // 按 IP 限流
  })

  // 3.2 管理员权限检查中间件
  async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
    const adminUsername = getConfig().ADMIN_USERNAME
    if (!request.user || (request.user as JwtPayload).username !== adminUsername) {
      return reply.code(403).send({ error: 'Admin access required' })
    }
  }

  // 3.3 登录端点
  fastify.post('/login', {
    schema: {
      security: [],  // 不需要 JWT 认证
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const username = typeof body.username === 'string' ? body.username : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password required' })
    }

    const user = getUser(username)
    if (!user) {
      auditLog('LOGIN_FAILED', undefined, { username, reason: 'user not found', ip: request.ip })
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      auditLog('LOGIN_FAILED', user.userId, { username, reason: 'invalid password', ip: request.ip })
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const tokens = generateTokenPair(user.userId, user.username)
    auditLog('LOGIN', user.userId, { username, ip: request.ip })
    return tokens
  })

  // 3.4 刷新 Token 端点
  fastify.post('/refresh', {
    schema: {
      security: [],  // 不需要 JWT 认证
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : ''

    if (!refreshToken) {
      return reply.code(400).send({ error: 'Refresh token required' })
    }

    try {
      const config = getConfig()
      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as JwtPayload
      const accessToken = jwt.sign(
        { userId: decoded.userId, username: decoded.username },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      )
      return { accessToken }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' })
    }
  })
}
```

---

> 📖 完成！本篇共覆盖了 8 个核心主题，从 RESTful API 设计到文件系统安全，
> 所有示例均来自 AI-CLI-Mobile 项目的真实代码。
> 建议结合项目源码一起阅读，加深理解。


---

## 附录 K：性能基准测试与优化

### K.1 HTTP 框架性能对比

```mermaid
graph LR
    subgraph "基准测试结果"
        A["Fastify\n30,000 req/s"] --> B["Koa\n18,000 req/s"]
        B --> C["Express\n12,000 req/s"]
        C --> D["Hapi\n8,000 req/s"]
    end
    
    style A fill:#c8e6c9
    style B fill:#fff9c4
    style C fill:#ffcdd2
    style D fill:#ffcdd2
```

| 框架 | 请求/秒 | 延迟 (p99) | 内存占用 | 启动时间 |
|------|---------|-----------|----------|----------|
| Fastify | 30,000 | 3ms | 50MB | 200ms |
| Koa | 18,000 | 6ms | 60MB | 150ms |
| Express | 12,000 | 10ms | 70MB | 100ms |
| Hapi | 8,000 | 15ms | 80MB | 300ms |

> ⚠️ **注意**：基准测试结果仅供参考，实际性能取决于业务逻辑、数据库查询等因素。

### K.2 性能优化检查清单

```mermaid
graph TD
    A["性能优化检查清单"] --> B["代码层面"]
    A --> C["架构层面"]
    A --> D["部署层面"]
    
    B --> B1["使用异步 API"]
    B --> B2["避免阻塞事件循环"]
    B --> B3["使用流式处理"]
    B --> B4["减少内存分配"]
    
    C --> C1["使用缓存"]
    C --> C2["使用连接池"]
    C --> C3["批量操作"]
    C --> C4["异步队列"]
    
    D --> D1["使用 PM2 集群"]
    D --> D2["使用 Nginx 反向代理"]
    D --> D3["启用 Gzip 压缩"]
    D --> D4["使用 CDN"]
    
    style A fill:#e1f5fe
    style B fill:#e8f5e9
    style C fill:#fff3e0
    style D fill:#f3e5f5
```

### K.3 内存优化技巧

#### 技巧 1：避免内存泄漏

```typescript
// ❌ 错误：闭包持有大对象
function processData() {
  const bigData = new Array(1000000).fill('x')
  
  return function process() {
    // bigData 被闭包持有，无法被 GC 回收
    return bigData.length
  }
}

// ✅ 正确：只保留需要的数据
function processData() {
  const bigData = new Array(1000000).fill('x')
  const length = bigData.length
  
  return function process() {
    return length  // 只保留 length，bigData 可以被 GC 回收
  }
}
```

#### 技巧 2：使用 WeakMap/WeakSet

```typescript
// ❌ 错误：Map 阻止对象被 GC 回收
const cache = new Map<object, unknown>()

function process(obj: object) {
  if (cache.has(obj)) return cache.get(obj)
  const result = heavyComputation(obj)
  cache.set(obj, result)  // obj 被 Map 引用，无法被 GC 回收
  return result
}

// ✅ 正确：WeakMap 允许对象被 GC 回收
const cache = new WeakMap<object, unknown>()

function process(obj: object) {
  if (cache.has(obj)) return cache.get(obj)
  const result = heavyComputation(obj)
  cache.set(obj, result)  // obj 可以被 GC 回收
  return result
}
```

#### 技巧 3：及时释放资源

```typescript
// ❌ 错误：忘记关闭流
const stream = fs.createReadStream('file.txt')
// stream 永远不会被关闭

// ✅ 正确：使用 try-finally
const stream = fs.createReadStream('file.txt')
try {
  for await (const chunk of stream) {
    processChunk(chunk)
  }
} finally {
  stream.destroy()
}

// ✅ 更好：使用 pipeline
import { pipeline } from 'stream/promises'
await pipeline(
  fs.createReadStream('input.txt'),
  transformStream,
  fs.createWriteStream('output.txt')
)
```

### K.4 网络优化技巧

#### 技巧 1：启用 Gzip 压缩

```typescript
import compress from '@fastify/compress'

await fastify.register(compress, {
  global: true,
  threshold: 1024,  // 只压缩大于 1KB 的响应
})
```

#### 技巧 2：设置缓存头

```typescript
// 静态文件缓存
fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/',
  setHeaders: (res) => {
    // 静态文件缓存 1 天
    res.setHeader('Cache-Control', 'public, max-age=86400')
  },
})

// API 响应不缓存
fastify.addHook('onSend', async (request, reply) => {
  reply.header('Cache-Control', 'no-store')
})
```

#### 技巧 3：连接复用

```typescript
// HTTP Keep-Alive
const agent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 100,
})

// 使用
const response = await fetch(url, { agent })
```

### K.5 数据库优化技巧

#### 技巧 1：使用索引

```sql
-- 为常用查询字段创建索引
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_sessions_owner ON sessions(owner_id);
```

#### 技巧 2：批量插入

```typescript
// ❌ 错误：逐个插入
for (const item of items) {
  await db.insert('items', item)  // N 次数据库操作
}

// ✅ 正确：批量插入
await db.batchInsert('items', items)  // 1 次数据库操作
```

#### 技巧 3：使用连接池

```typescript
const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})
```

---

## 附录 L：安全加固清单

### L.1 安全检查清单

```mermaid
graph TD
    A["安全加固清单"] --> B["认证安全"]
    A --> C["传输安全"]
    A --> D["应用安全"]
    A --> E["部署安全"]
    
    B --> B1["密码哈希（bcrypt）"]
    B --> B2["双 Token 机制"]
    B --> B3["登录限流"]
    B --> B4["统一错误信息"]
    
    C --> C1["HTTPS"]
    C --> C2["WSS（WebSocket Secure）"]
    C --> C3["HSTS 头"]
    
    D --> D1["输入验证"]
    D --> D2["路径校验"]
    D --> D3["CORS 配置"]
    D --> D4["CSP 头"]
    D --> D5["Helmet 安全头"]
    
    E --> E1["最小权限原则"]
    E --> E2["Docker 隔离"]
    E --> E3["环境变量管理"]
    E --> E4["日志审计"]
    
    style A fill:#e1f5fe
    style B fill:#e8f5e9
    style C fill:#fff3e0
    style D fill:#f3e5f5
    style E fill:#fce4ec
```

### L.2 OWASP Top 10 防御措施

| OWASP Top 10 | 防御措施 | 项目中的实现 |
|--------------|----------|-------------|
| A01: Broken Access Control | 权限检查 | requireAdmin, validateSessionAccess |
| A02: Cryptographic Failures | 密码哈希、JWT | bcrypt, jsonwebtoken |
| A03: Injection | 输入验证、参数化查询 | sanitizePath, execFile |
| A04: Insecure Design | 安全设计 | 双 Token、限流、审计日志 |
| A05: Security Misconfiguration | 安全配置 | Helmet、CORS、CSP |
| A06: Vulnerable Components | 依赖更新 | pnpm audit |
| A07: Auth Failures | 认证加固 | bcrypt、限流、统一错误 |
| A08: Data Integrity Failures | 原子写入 | write-then-rename |
| A09: Logging Failures | 审计日志 | audit.ts |
| A09: SSRF | 路径校验 | sanitizePath |

### L.3 安全头配置

```typescript
// @fastify/helmet 配置
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],           // 只允许同源
      scriptSrc: ["'self'"],            // 只允许同源脚本
      styleSrc: ["'self'", "'unsafe-inline'"],  // 允许内联样式
      imgSrc: ["'self'", 'data:'],      // 允许 data: URL 图片
      connectSrc: ["'self'", 'ws:', 'wss:'],  // 允许 WebSocket
      fontSrc: ["'self'"],              // 只允许同源字体
      objectSrc: ["'none'"],            // 禁止插件
      frameAncestors: ["'none'"],       // 禁止 iframe
      baseUri: ["'self'"],              // 限制 base 标签
      formAction: ["'self'"],           // 限制表单提交
    },
  },
})
```

---

> 📖 本篇文档到此结束。感谢阅读！
> 
> 如果你有任何问题或建议，欢迎在项目 GitHub 上提 Issue。


---

## 附录 M：学习路径与进阶指南

### M.1 学习路径

```mermaid
graph TD
    A["初学者学习路径"] --> B["第 1 阶段：基础"]
    A --> C["第 2 阶段：进阶"]
    A --> D["第 3 阶段：实战"]
    A --> E["第 4 阶段：深入"]
    
    B --> B1["HTTP 协议基础"]
    B --> B2["RESTful API 设计"]
    B --> B3["Node.js 基础"]
    B --> B4["TypeScript 基础"]
    
    C --> C1["Fastify 框架"]
    C --> C2["JWT 认证"]
    C --> C3["WebSocket"]
    C --> C4["数据库操作"]
    
    D --> D1["项目实战"]
    D --> D2["测试编写"]
    D --> D3["部署上线"]
    D --> D4["性能优化"]
    
    E --> E1["微服务架构"]
    E --> E2["分布式系统"]
    E --> E3["高并发处理"]
    E --> E4["安全加固"]
    
    style A fill:#e1f5fe
    style B fill:#c8e6c9
    style C fill:#fff3e0
    style D fill:#e3f2fd
    style E fill:#f3e5f5
```

### M.2 推荐学习资源

#### 书籍推荐

| 书籍 | 作者 | 适合人群 | 推荐理由 |
|------|------|---------|---------|
| 《Node.js 设计模式》 | Mario Casciaro | 中级 | 深入理解 Node.js 设计模式 |
| 《深入浅出 Node.js》 | 朴灵 | 中级 | Node.js 底层原理 |
| 《TypeScript 编程》 | Boris Cherny | 初级-中级 | TypeScript 全面教程 |
| 《Web 安全攻防》 | 徐焱 | 中级 | Web 安全实战 |
| 《RESTful Web APIs》 | Leonard Richardson | 中级 | REST API 设计权威指南 |

#### 在线课程

| 课程 | 平台 | 适合人群 | 推荐理由 |
|------|------|---------|---------|
| Node.js 全栈开发 | Udemy | 初级 | 项目驱动学习 |
| TypeScript 深入 | Frontend Masters | 中级 | TypeScript 高级特性 |
| Web 安全基础 | Coursera | 初级 | 安全基础知识 |
| 系统设计面试 | Educative | 高级 | 系统设计思维 |

#### 开源项目

| 项目 | 说明 | 学习价值 |
|------|------|---------|
| Fastify | HTTP 框架 | 学习框架设计 |
| Express | HTTP 框架 | 学习中间件模式 |
| NestJS | 企业级框架 | 学习依赖注入 |
| tRPC | 类型安全 RPC | 学习类型安全 API |

### M.3 进阶主题

#### 微服务架构

```mermaid
graph TD
    A["微服务架构"] --> B["服务拆分"]
    A --> C["服务通信"]
    A --> D["服务治理"]
    A --> E["数据管理"]
    
    B --> B1["按业务领域拆分"]
    B --> B2["单一职责原则"]
    
    C --> C1["同步通信（HTTP/gRPC）"]
    C --> C2["异步通信（消息队列）"]
    
    D --> D1["服务发现"]
    D --> D2["负载均衡"]
    D --> D3["熔断器"]
    D --> D4["限流"]
    
    E --> E1["数据库拆分"]
    E --> E2["数据一致性"]
    E --> E3["事件溯源"]
    
    style A fill:#e1f5fe
```

#### 分布式系统

```mermaid
graph TD
    A["分布式系统"] --> B["一致性"]
    A --> C["可用性"]
    A --> D["分区容错"]
    
    B --> B1["强一致性"]
    B --> B2["最终一致性"]
    
    C --> C1["高可用设计"]
    C --> C2["故障转移"]
    
    D --> D1["网络分区处理"]
    D --> D2["数据复制"]
    
    style A fill:#e1f5fe
```

### M.4 职业发展路径

```mermaid
graph LR
    A["初级开发"] --> B["中级开发"]
    B --> C["高级开发"]
    C --> D["架构师"]
    C --> E["技术经理"]
    
    A --> A1["掌握基础\n完成任务"]
    B --> B1["独立开发\n解决问题"]
    C --> C1["技术决策\n团队指导"]
    D --> D1["系统设计\n技术规划"]
    E --> E1["团队管理\n项目管理"]
    
    style A fill:#c8e6c9
    style B fill:#fff3e0
    style C fill:#e3f2fd
    style D fill:#f3e5f5
    style E fill:#fce4ec
```

### M.5 技能树

```mermaid
graph TD
    A["后端开发技能树"] --> B["编程语言"]
    A --> C["框架"]
    A --> D["数据库"]
    A --> E["中间件"]
    A --> F["DevOps"]
    A --> G["软技能"]
    
    B --> B1["JavaScript/TypeScript"]
    B --> B2["Python"]
    B --> B3["Go"]
    
    C --> C1["Fastify/Express"]
    C --> C2["NestJS"]
    C --> C3["Spring Boot"]
    
    D --> D1["PostgreSQL"]
    D --> D2["MongoDB"]
    D --> D3["Redis"]
    
    E --> E1["Nginx"]
    E --> E2["RabbitMQ"]
    E --> E3["Kafka"]
    
    F --> F1["Docker"]
    F --> F2["Kubernetes"]
    F --> F3["CI/CD"]
    
    G --> G1["沟通能力"]
    G --> G2["团队协作"]
    G --> G3["问题解决"]
    
    style A fill:#e1f5fe
```

---

## 总结

本篇文档从零开始，系统地讲解了后端框架与 API 设计的核心知识：

### 核心概念回顾

| 主题 | 核心概念 | 关键技术 |
|------|---------|---------|
| RESTful API | URL 设计、HTTP 方法语义、状态码 | REST 架构风格 |
| Fastify 框架 | 实例创建、路由注册、插件系统 | Fastify、fastify-plugin |
| 中间件与钩子 | 生命周期钩子、onRequest、preHandler | 钩子链、封装作用域 |
| 请求验证 | JSON Schema、Zod | 类型安全验证 |
| 认证与授权 | JWT、bcrypt、双 Token | 安全最佳实践 |
| WebSocket | 双通道架构、状态机、心跳 | @fastify/websocket |
| 错误处理 | 全局策略、pino 日志、审计日志 | 结构化日志 |
| 文件系统 API | 路径校验、原子写入、限流 | 安全防护 |

### 关键收获

1. **RESTful API 设计**：URL 是名词，HTTP 方法是动词，状态码要语义化
2. **Fastify 框架**：高性能、类型安全、插件驱动
3. **中间件与钩子**：生命周期钩子比中间件链更清晰
4. **请求验证**：永远不要信任客户端数据
5. **认证与授权**：JWT 双 Token 机制、bcrypt 密码哈希
6. **WebSocket**：双通道架构、二进制 vs JSON、心跳检测
7. **错误处理**：分层处理、结构化日志、审计日志
8. **文件系统安全**：路径校验、原子写入、限流

### 下一步行动

1. **动手实践**：克隆项目，运行代码，修改参数
2. **阅读源码**：结合本文档，逐行阅读项目源码
3. **编写测试**：为项目添加更多测试用例
4. **扩展功能**：尝试添加新功能，如用户角色管理
5. **深入学习**：阅读推荐书籍和在线资源

---

> 📖 感谢阅读！祝你学习愉快！🔥


---

## 12. GraphQL 实战

GraphQL 是 Facebook 开发的 API 查询语言，允许客户端精确指定需要的数据，避免过度获取或不足获取。

### 12.1 REST vs GraphQL 对比

| 特性 | REST | GraphQL |
|------|------|---------|
| 端点 | 多个 URL（/users, /posts） | 单个端点（/graphql） |
| 数据获取 | 服务端决定返回字段 | 客户端指定需要的字段 |
| 过度获取 | 常见（返回多余字段） | 不存在（精确查询） |
| 不足获取 | 需要多次请求 | 一次请求获取关联数据 |
| 版本管理 | 需要 /v1, /v2 | 通过 Schema 演进 |
| 缓存 | HTTP 缓存简单 | 需要额外方案 |

### 12.2 Schema 定义

```graphql
# 类型定义
type User {
  id: ID!
  name: String!
  email: String!
  age: Int
  posts: [Post!]!
  createdAt: DateTime!
}

type Post {
  id: ID!
  title: String!
  content: String!
  author: User!
  tags: [String!]!
  status: PostStatus!
}

enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

# 查询类型（读取数据）
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
  post(id: ID!): Post
  posts(authorId: ID, status: PostStatus): [Post!]!
}

# 变更类型（写入数据）
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  createPost(input: CreatePostInput!): Post!
  publishPost(id: ID!): Post!
}

# 输入类型
input CreateUserInput {
  name: String!
  email: String!
  age: Int
}

input UpdateUserInput {
  name: String
  email: String
  age: Int
}

input CreatePostInput {
  title: String!
  content: String!
  tags: [String!]
}
```

### 12.3 Resolver 实现（Node.js + Apollo Server）

```javascript
const { ApolloServer, gql } = require('apollo-server');

// 模拟数据
const users = [
  { id: '1', name: '张三', email: 'zhangsan@example.com', age: 28 },
  { id: '2', name: '李四', email: 'lisi@example.com', age: 32 },
];

const posts = [
  { id: '1', title: 'GraphQL 入门', content: '...', authorId: '1', tags: ['GraphQL', 'API'], status: 'PUBLISHED' },
  { id: '2', title: 'Node.js 进阶', content: '...', authorId: '1', tags: ['Node.js'], status: 'DRAFT' },
];

const resolvers = {
  Query: {
    // 获取单个用户
    user: (_, { id }) => users.find(u => u.id === id),
    // 获取用户列表（支持分页）
    users: (_, { limit = 10, offset = 0 }) => users.slice(offset, offset + limit),
    // 获取文章
    post: (_, { id }) => posts.find(p => p.id === id),
    // 获取文章列表（支持过滤）
    posts: (_, { authorId, status }) => {
      let result = posts;
      if (authorId) result = result.filter(p => p.authorId === authorId);
      if (status) result = result.filter(p => p.status === status);
      return result;
    },
  },

  // 关联解析：User.posts
  User: {
    posts: (parent) => posts.filter(p => p.authorId === parent.id),
  },

  // 关联解析：Post.author
  Post: {
    author: (parent) => users.find(u => u.id === parent.authorId),
  },

  Mutation: {
    createUser: (_, { input }) => {
      const newUser = { id: String(users.length + 1), ...input };
      users.push(newUser);
      return newUser;
    },
    createPost: (_, { input }) => {
      const newPost = {
        id: String(posts.length + 1),
        ...input,
        status: 'DRAFT',
        authorId: '1', // 实际应从认证信息获取
      };
      posts.push(newPost);
      return newPost;
    },
    publishPost: (_, { id }) => {
      const post = posts.find(p => p.id === id);
      if (!post) throw new Error('文章不存在');
      post.status = 'PUBLISHED';
      return post;
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers });
server.listen({ port: 4000 }).then(({ url }) => {
  console.log(`GraphQL 服务运行在 ${url}`);
});
```

### 12.4 查询示例

```graphql
# 查询用户及其文章
query {
  user(id: "1") {
    name
    email
    posts {
      title
      status
      tags
    }
  }
}

# 响应结果
{
  "data": {
    "user": {
      "name": "张三",
      "email": "zhangsan@example.com",
      "posts": [
        { "title": "GraphQL 入门", "status": "PUBLISHED", "tags": ["GraphQL", "API"] },
        { "title": "Node.js 进阶", "status": "DRAFT", "tags": ["Node.js"] }
      ]
    }
  }
}

# 创建文章
mutation {
  createPost(input: {
    title: "Docker 容器化实践"
    content: "本文介绍 Docker 的基本使用..."
    tags: ["Docker", "DevOps"]
  }) {
    id
    title
    status
  }
}
```

---

## 13. API 限流算法

限流（Rate Limiting）是保护 API 不被滥用的关键机制，防止恶意请求或突发流量压垮服务器。

### 13.1 三种限流算法对比

```mermaid
graph LR
    subgraph 令牌桶
    TB1[令牌以固定速率添加] --> TB2[桶满则丢弃令牌]
    TB2 --> TB3[请求需要消耗令牌]
    TB3 --> TB4[桶空则拒绝请求]
    end

    subgraph 漏桶
    LB1[请求进入桶] --> LB2[桶满则溢出丢弃]
    LB2 --> LB3[以固定速率流出处理]
    end

    subgraph 滑动窗口
    SW1[记录每个请求时间戳] --> SW2[统计窗口内请求数]
    SW2 --> SW3[超过阈值则拒绝]
    end
```

| 特性 | 令牌桶 | 漏桶 | 滑动窗口 |
|------|--------|------|---------|
| 核心思想 | 固定速率生成令牌 | 固定速率处理请求 | 统计时间窗口内请求数 |
| 突发流量 | ✅ 允许（桶内有令牌即可） | ❌ 不允许（固定流出速率） | ❌ 不允许 |
| 平滑度 | 中等 | 最平滑 | 中等 |
| 实现复杂度 | 低 | 低 | 中等 |
| 适用场景 | API 通用限流 | 流量整形 | 精确计数限流 |

### 13.2 令牌桶实现

```javascript
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;       // 桶容量（最大令牌数）
    this.tokens = capacity;         // 当前令牌数
    this.refillRate = refillRate;   // 每秒补充的令牌数
    this.lastRefill = Date.now();
  }

  // 补充令牌
  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // 秒
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  // 尝试消费令牌，返回 true 表示允许
  consume(tokens = 1) {
    this.refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
}

// Express 中间件示例
function rateLimiter({ capacity = 100, refillRate = 10 }) {
  const buckets = new Map(); // IP → TokenBucket

  return (req, res, next) => {
    const ip = req.ip;

    if (!buckets.has(ip)) {
      buckets.set(ip, new TokenBucket(capacity, refillRate));
    }

    const bucket = buckets.get(ip);

    if (bucket.consume()) {
      res.set('X-RateLimit-Remaining', Math.floor(bucket.tokens));
      next();
    } else {
      res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((1 - bucket.tokens) / refillRate),
      });
    }
  };
}

// 使用
app.use(rateLimiter({ capacity: 100, refillRate: 10 })); // 每秒 10 个请求，最多突发 100
```

### 13.3 滑动窗口实现（基于 Redis）

```javascript
const Redis = require('ioredis');
const redis = new Redis();

async function slidingWindowRateLimit(key, limit, windowSeconds) {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  const pipeline = redis.pipeline();
  // 移除窗口外的旧记录
  pipeline.zremrangebyscore(key, 0, windowStart);
  // 添加当前请求
  pipeline.zadd(key, now, `${now}:${Math.random()}`);
  // 统计窗口内的请求数
  pipeline.zcard(key);
  // 设置过期时间（自动清理）
  pipeline.expire(key, windowSeconds);

  const results = await pipeline.exec();
  const requestCount = results[2][1];

  return {
    allowed: requestCount <= limit,
    remaining: Math.max(0, limit - requestCount),
    total: limit,
  };
}

// Express 中间件
function redisRateLimiter({ limit = 100, windowSeconds = 60 }) {
  return async (req, res, next) => {
    const key = `ratelimit:${req.ip}`;
    const result = await slidingWindowRateLimit(key, limit, windowSeconds);

    res.set('X-RateLimit-Limit', limit);
    res.set('X-RateLimit-Remaining', result.remaining);

    if (result.allowed) {
      next();
    } else {
      res.status(429).json({ error: '请求过于频繁' });
    }
  };
}
```

---

## 14. API 文档自动生成（Swagger/OpenAPI 3.0）

### 14.1 OpenAPI 3.0 YAML 示例

```yaml
openapi: 3.0.3
info:
  title: AI-CLI-Mobile API
  description: AI CLI 移动端后端 API 文档
  version: 1.0.0
  contact:
    name: wait4x
    email: wait4x@example.com

servers:
  - url: http://localhost:3000/api/v1
    description: 开发环境
  - url: https://api.example.com/v1
    description: 生产环境

paths:
  /users:
    get:
      summary: 获取用户列表
      description: 分页获取所有用户信息
      tags:
        - Users
      parameters:
        - name: page
          in: query
          description: 页码
          schema:
            type: integer
            default: 1
            minimum: 1
        - name: limit
          in: query
          description: 每页数量
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/User'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
        '401':
          description: 未授权
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    post:
      summary: 创建用户
      tags:
        - Users
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserInput'
      responses:
        '201':
          description: 创建成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: 参数错误
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '409':
          description: 邮箱已存在

  /users/{id}:
    get:
      summary: 获取单个用户
      tags:
        - Users
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: 用户不存在

components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          example: "60d5ecb54b24a1234567890a"
        name:
          type: string
          example: "张三"
        email:
          type: string
          format: email
          example: "zhangsan@example.com"
        age:
          type: integer
          example: 28
        createdAt:
          type: string
          format: date-time

    CreateUserInput:
      type: object
      required:
        - name
        - email
      properties:
        name:
          type: string
          minLength: 2
          maxLength: 50
        email:
          type: string
          format: email
        age:
          type: integer
          minimum: 0
          maximum: 150

    Pagination:
      type: object
      properties:
        page:
          type: integer
        limit:
          type: integer
        total:
          type: integer
        totalPages:
          type: integer

    Error:
      type: object
      properties:
        error:
          type: string
        message:
          type: string
        statusCode:
          type: integer

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### 14.2 Express 集成 Swagger UI

```bash
npm install swagger-ui-express swagger-jsdoc
```

```javascript
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'My API',
      version: '1.0.0',
    },
  },
  // 从注释自动生成文档
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// JSON 格式的 spec
app.get('/api-docs.json', (req, res) => {
  res.json(swaggerSpec);
});
```

**路由文件中的注释：**

```javascript
/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: 获取用户列表
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: 页码
 *     responses:
 *       200:
 *         description: 成功
 */
router.get('/users', async (req, res) => {
  // ...
});
```

---

## 15. 中间件模式详解

### 15.1 洋葱模型 vs 线性模型

```mermaid
graph TB
    subgraph 洋葱模型 - Koa
    O1[请求进入] --> O2[中间件 1 - before]
    O2 --> O3[中间件 2 - before]
    O3 --> O4[核心处理]
    O4 --> O5[中间件 2 - after]
    O5 --> O6[中间件 1 - after]
    O6 --> O7[响应返回]
    end

    subgraph 线性模型 - Express
    L1[请求进入] --> L2[中间件 1]
    L2 --> L3[中间件 2]
    L3 --> L4[中间件 3]
    L4 --> L5[路由处理]
    L5 --> L6[响应返回]
    end
```

| 特性 | 洋葱模型（Koa） | 线性模型（Express） |
|------|----------------|-------------------|
| 执行顺序 | 先进→核心→后出（双向） | 按顺序依次执行（单向） |
| 中间件控制 | `await next()` 后还能执行代码 | `next()` 后由下一个中间件接管 |
| 错误处理 | 天然支持 try/catch 包裹 | 需要错误处理中间件（4 参数） |
| 代码风格 | async/await 风格 | 回调风格（也支持 async） |

### 15.2 洋葱模型示例（Koa）

```javascript
const Koa = require('koa');
const app = new Koa();

// 中间件 1：请求计时
app.use(async (ctx, next) => {
  const start = Date.now();
  console.log('[中间件1] 请求开始');

  await next(); // 进入下一个中间件

  const duration = Date.now() - start;
  console.log(`[中间件1] 请求结束，耗时: ${duration}ms`);
  ctx.set('X-Response-Time', `${duration}ms`);
});

// 中间件 2：认证检查
app.use(async (ctx, next) => {
  console.log('[中间件2] 检查认证');

  const token = ctx.get('Authorization');
  if (!token && ctx.path !== '/login') {
    ctx.status = 401;
    ctx.body = { error: '未授权' };
    return; // 不调用 next()，请求到此为止
  }

  await next(); // 认证通过，继续

  console.log('[中间件2] 认证处理完成');
});

// 中间件 3：日志记录
app.use(async (ctx, next) => {
  console.log('[中间件3] 记录请求日志');

  await next();

  console.log(`[中间件3] 响应状态: ${ctx.status}`);
});

// 路由处理
app.use(async (ctx) => {
  console.log('[核心] 处理业务逻辑');
  ctx.body = { message: 'Hello World' };
});

app.listen(3000);
```

**输出顺序：**
```
[中间件1] 请求开始
[中间件2] 检查认证
[中间件3] 记录请求日志
[核心] 处理业务逻辑
[中间件3] 响应状态: 200
[中间件2] 认证处理完成
[中间件1] 请求结束，耗时: 5ms
```

### 15.3 Express 错误处理中间件

```javascript
// Express 错误处理中间件必须有 4 个参数
app.use((err, req, res, next) => {
  console.error('错误:', err.message);

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: '接口不存在' });
});
```

---

## 16. 服务端渲染（SSR）与静态生成（SSG）

### 16.1 渲染方式对比

```mermaid
graph LR
    subgraph CSR 客户端渲染
    CSR1[HTML 空壳] --> CSR2[下载 JS]
    CSR2 --> CSR3[JS 渲染页面]
    end

    subgraph SSR 服务端渲染
    SSR1[请求到达] --> SSR2[服务端渲染 HTML]
    SSR2 --> SSR3[返回完整 HTML]
    SSR3 --> SSR4[客户端 Hydration]
    end

    subgraph SSG 静态生成
    SSG1[构建时生成] --> SSG2[静态 HTML 文件]
    SSG2 --> SSG3[CDN 分发]
    end
```

| 特性 | CSR | SSR | SSG |
|------|-----|-----|-----|
| 首屏加载 | 慢（等待 JS 下载执行） | 快（直接返回 HTML） | 最快（CDN 缓存） |
| SEO | 差 | 好 | 最好 |
| 服务器负载 | 低 | 高（每次请求都渲染） | 最低（静态文件） |
| 数据实时性 | 实时 | 实时 | 构建时快照 |
| 适用场景 | 后台管理系统 | 电商/新闻/社交 | 博客/文档/营销页 |
| 典型框架 | React/Vue SPA | Next.js/Nuxt.js | Next.js/Astro/Hugo |

### 16.2 Next.js SSR 示例

```javascript
// pages/products/[id].js
// SSR：每次请求都在服务端渲染
export async function getServerSideProps(context) {
  const { id } = context.params;

  // 服务端获取数据
  const res = await fetch(`https://api.example.com/products/${id}`);
  const product = await res.json();

  if (!product) {
    return { notFound: true }; // 返回 404
  }

  return {
    props: {
      product, // 传递给页面组件
    },
  };
}

export default function ProductPage({ product }) {
  return (
    <div>
      <h1>{product.name}</h1>
      <p>价格: ¥{product.price}</p>
      <p>{product.description}</p>
    </div>
  );
}
```

### 16.3 Next.js SSG 示例

```javascript
// pages/blog/[slug].js
// SSG：构建时生成静态页面
export async function getStaticPaths() {
  // 获取所有文章的 slug
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());

  return {
    paths: posts.map(post => ({
      params: { slug: post.slug },
    })),
    fallback: 'blocking', // 未预渲染的页面会服务端渲染后缓存
  };
}

export async function getStaticProps({ params }) {
  const post = await fetch(`https://api.example.com/posts/${params.slug}`)
    .then(r => r.json());

  return {
    props: { post },
    revalidate: 3600, // ISR：每小时重新生成一次
  };
}

export default function BlogPost({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}
```

---

## 17. Serverless 函数

### 17.1 什么是 Serverless？

Serverless 不是没有服务器，而是不需要管理服务器。云平台自动处理扩缩容、运维、补丁更新。

```mermaid
graph LR
    A[开发者] -->|编写函数| B[云平台]
    B -->|自动部署| C[运行环境]
    D[请求] --> C
    C -->|自动扩缩| E[1 个实例]
    C -->|自动扩缩| F[100 个实例]
    C -->|空闲| G[0 个实例]

    style B fill:#FF9900,color:#fff
```

| 特性 | Serverless | 传统服务器 | 容器 |
|------|-----------|-----------|------|
| 计费 | 按调用次数和时长 | 按服务器时长 | 按容器时长 |
| 扩缩容 | 自动扩缩至零 | 手动 | 自动（但不缩至零） |
| 冷启动 | 有延迟（首次调用） | 无 | 无 |
| 运维 | 无需管理 | 全部自己管理 | 部分管理 |
| 执行时长限制 | 有（如 15 分钟） | 无 | 无 |
| 适用场景 | API、Webhook、定时任务 | 长期运行的服务 | 微服务 |

### 17.2 AWS Lambda 函数示例

```javascript
// handler.js
exports.handler = async (event) => {
  // 解析 API Gateway 事件
  const { httpMethod, path, body, queryStringParameters } = event;

  try {
    if (httpMethod === 'GET' && path === '/users') {
      // 获取用户列表
      const users = await getUsersFromDB(queryStringParameters);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ data: users }),
      };
    }

    if (httpMethod === 'POST' && path === '/users') {
      // 创建用户
      const userData = JSON.parse(body);
      const newUser = await createUser(userData);
      return {
        statusCode: 201,
        body: JSON.stringify(newUser),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: '接口不存在' }),
    };

  } catch (error) {
    console.error('错误:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: '服务器内部错误' }),
    };
  }
};
```

### 17.3 Vercel Functions 示例

```javascript
// api/hello.js（Next.js 项目中）
export default function handler(req, res) {
  const { name = 'World' } = req.query;

  res.status(200).json({
    message: `Hello, ${name}!`,
    timestamp: new Date().toISOString(),
    method: req.method,
  });
}

// api/users/[id].js（动态路由）
export default async function handler(req, res) {
  const { id } = req.query;

  switch (req.method) {
    case 'GET':
      const user = await getUserById(id);
      if (!user) return res.status(404).json({ error: '用户不存在' });
      return res.status(200).json(user);

    case 'PUT':
      const updated = await updateUser(id, req.body);
      return res.status(200).json(updated);

    case 'DELETE':
      await deleteUser(id);
      return res.status(204).end();

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      return res.status(405).json({ error: `方法 ${req.method} 不允许` });
  }
}
```

---

## 18. 后端测试策略

### 18.1 测试金字塔

```mermaid
graph TB
    subgraph 测试金字塔
    E2E[E2E 端到端测试 - 少量]
    INT[集成测试 - 适量]
    UNIT[单元测试 - 大量]
    end

    E2E --- INT
    INT --- UNIT

    style E2E fill:#f44336,color:#fff
    style INT fill:#FF9800,color:#fff
    style UNIT fill:#4CAF50,color:#fff
```

| 测试类型 | 比例 | 速度 | 成本 | 覆盖范围 |
|---------|------|------|------|---------|
| 单元测试 | 70% | 极快（毫秒） | 低 | 单个函数/模块 |
| 集成测试 | 20% | 中等（秒级） | 中 | 多模块协作 |
| E2E 测试 | 10% | 慢（分钟级） | 高 | 完整用户流程 |

### 18.2 单元测试示例（Jest）

```javascript
// utils/validator.js
function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function validateAge(age) {
  return typeof age === 'number' && age >= 0 && age <= 150 && Number.isInteger(age);
}

// utils/validator.test.js
const { validateEmail, validateAge } = require('./validator');

describe('validateEmail', () => {
  test('有效邮箱', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('test.name@domain.co.uk')).toBe(true);
  });

  test('无效邮箱', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
  });
});

describe('validateAge', () => {
  test('有效年龄', () => {
    expect(validateAge(0)).toBe(true);
    expect(validateAge(25)).toBe(true);
    expect(validateAge(150)).toBe(true);
  });

  test('无效年龄', () => {
    expect(validateAge(-1)).toBe(false);
    expect(validateAge(151)).toBe(false);
    expect(validateAge(25.5)).toBe(false);
    expect(validateAge('25')).toBe(false);
  });
});
```

### 18.3 集成测试示例（Supertest）

```javascript
// tests/api/users.test.js
const request = require('supertest');
const app = require('../../app');

describe('Users API', () => {
  let authToken;

  beforeAll(async () => {
    // 获取认证 token
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    authToken = res.body.token;
  });

  describe('GET /api/v1/users', () => {
    test('未认证应返回 401', async () => {
      const res = await request(app).get('/api/v1/users');
      expect(res.status).toBe(401);
    });

    test('认证后应返回用户列表', async () => {
      const res = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toBeDefined();
    });

    test('分页参数应生效', async () => {
      const res = await request(app)
        .get('/api/v1/users?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
      expect(res.body.pagination.page).toBe(1);
    });
  });

  describe('POST /api/v1/users', () => {
    test('有效数据应创建用户', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '测试用户', email: 'new@example.com', age: 25 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('测试用户');
      expect(res.body.id).toBeDefined();
    });

    test('缺少必填字段应返回 400', async () => {
      const res = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: '测试用户' }); // 缺少 email

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
```

### 18.4 E2E 测试示例（Playwright）

```javascript
// tests/e2e/login.spec.js
const { test, expect } = require('@playwright/test');

test.describe('登录流程', () => {
  test('成功登录后跳转到首页', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    // 填写表单
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 验证跳转
    await expect(page).toHaveURL('http://localhost:3000/dashboard');
    await expect(page.locator('h1')).toHaveText('欢迎回来');
  });

  test('错误密码应显示提示', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toHaveText('邮箱或密码错误');
  });
});
```

### 18.5 测试覆盖率配置

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  },
  "jest": {
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    },
    "testMatch": [
      "**/__tests__/**/*.test.js",
      "**/*.spec.js"
    ]
  }
}
```

| 覆盖率指标 | 含义 | 推荐阈值 |
|-----------|------|---------|
| Lines | 代码行覆盖率 | ≥ 80% |
| Functions | 函数覆盖率 | ≥ 80% |
| Branches | 分支覆盖率 | ≥ 75% |
| Statements | 语句覆盖率 | ≥ 80% |

---

## 19. 总结与最佳实践

### 19.1 API 设计决策清单

| 决策点 | 推荐方案 | 适用场景 |
|--------|---------|---------|
| API 风格 | REST | 简单 CRUD，资源导向 |
| API 风格 | GraphQL | 复杂关联查询，前端驱动 |
| 限流策略 | 令牌桶 | 通用 API 保护 |
| 文档工具 | Swagger/OpenAPI | 自动生成，保持同步 |
| 渲染方式 | CSR | 后台管理，SPA |
| 渲染方式 | SSR/SSG | 面向用户的页面 |
| 测试策略 | 金字塔模型 | 单元为主，集成补充 |

### 19.2 常见反模式

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| 没有版本管理 | API 变更破坏客户端 | 使用 URL 路径版本 |
| 没有限流 | 恶意请求压垮服务 | 令牌桶 + Redis 限流 |
| 没有文档 | 前后端沟通成本高 | Swagger 自动生成 |
| 测试覆盖不足 | 上线后频繁出 Bug | 测试金字塔 + CI 卡关 |
| 过度使用 SSR | 服务器负载过高 | 按页面选择渲染方式 |

### 19.3 API 安全最佳实践

| 安全措施 | 说明 | 实现方式 |
|---------|------|---------|
| HTTPS | 加密传输 | TLS 证书（Let's Encrypt） |
| 认证 | 验证用户身份 | JWT / OAuth 2.0 |
| 授权 | 验证用户权限 | RBAC / ABAC |
| 输入验证 | 防止恶意输入 | Joi / Zod / express-validator |
| 限流 | 防止暴力攻击 | 令牌桶 / 滑动窗口 |
| CORS | 控制跨域访问 | cors 中间件 |
| Helmet | 设置安全 HTTP 头 | helmet 中间件 |
| SQL 注入防护 | 参数化查询 | ORM / 预编译语句 |
| XSS 防护 | 输出编码 | DOMPurify / 模板引擎自动编码 |

```javascript
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();

// 1. 安全 HTTP 头
app.use(helmet());

// 2. CORS 配置
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400, // 预检请求缓存 24 小时
}));

// 3. 全局限流
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 100,                  // 每个 IP 最多 100 次请求
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请 15 分钟后再试' },
}));

// 4. 输入验证示例
app.post('/api/v1/users',
  body('name').trim().isLength({ min: 2, max: 50 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('age').optional().isInt({ min: 0, max: 150 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // 处理业务逻辑...
  }
);
```

### 19.4 错误处理统一规范

```javascript
// 自定义错误类
class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// 常用错误工厂
class NotFoundError extends AppError {
  constructor(resource = '资源') {
    super(`${resource}不存在`, 404, 'NOT_FOUND');
  }
}

class ValidationError extends AppError {
  constructor(message = '参数验证失败', details) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '未授权') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = '无权限') {
    super(message, 403, 'FORBIDDEN');
  }
}

// 全局错误处理中间件
app.use((err, req, res, next) => {
  // 记录错误日志
  if (!err.isOperational) {
    console.error('非预期错误:', err);
  }

  const statusCode = err.statusCode || 500;
  const response = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.isOperational ? err.message : '服务器内部错误',
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  };

  res.status(statusCode).json(response);
});

// 使用示例
app.get('/api/v1/users/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new NotFoundError('用户');
    res.json(user);
  } catch (err) {
    next(err); // 传递给全局错误处理
  }
});
```

### 19.5 请求参数验证（Zod）

```javascript
const { z } = require('zod');

// 定义验证 Schema
const createUserSchema = z.object({
  name: z.string()
    .min(2, '名字至少 2 个字符')
    .max(50, '名字最多 50 个字符'),
  email: z.string().email('邮箱格式不正确'),
  age: z.number()
    .int('年龄必须是整数')
    .min(0, '年龄不能为负')
    .max(150, '年龄不合法')
    .optional(),
  role: z.enum(['user', 'admin']).default('user'),
});

const updateUserSchema = createUserSchema.partial(); // 所有字段可选

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', '-createdAt', 'name', '-name']).default('-createdAt'),
});

// 验证中间件工厂
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: '参数验证失败',
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
      });
    }
    req[source] = result.data; // 使用验证后的数据（含默认值）
    next();
  };
}

// 使用
app.post('/api/v1/users', validate(createUserSchema), handler);
app.put('/api/v1/users/:id', validate(updateUserSchema), handler);
app.get('/api/v1/users', validate(paginationSchema, 'query'), handler);
```

### 19.6 API 响应格式规范

```javascript
// 统一响应格式
class ApiResponse {
  // 成功响应
  static success(data, meta = {}) {
    return {
      success: true,
      data,
      ...(Object.keys(meta).length > 0 && { meta }),
    };
  }

  // 列表响应（带分页）
  static list(data, pagination) {
    return {
      success: true,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
        hasNext: pagination.page * pagination.limit < pagination.total,
        hasPrev: pagination.page > 1,
      },
    };
  }

  // 错误响应
  static error(message, code = 'ERROR', details = null) {
    return {
      success: false,
      error: {
        code,
        message,
        ...(details && { details }),
      },
    };
  }
}

// 使用示例
app.get('/api/v1/users', async (req, res) => {
  const { page, limit } = req.query;
  const [users, total] = await Promise.all([
    User.find().skip((page - 1) * limit).limit(limit),
    User.countDocuments(),
  ]);

  res.json(ApiResponse.list(users, { page, limit, total }));
});
```

**标准响应结构：**

| 场景 | HTTP 状态码 | 响应格式 |
|------|-----------|---------|
| 获取成功 | 200 | `{ success: true, data: {...} }` |
| 列表成功 | 200 | `{ success: true, data: [...], pagination: {...} }` |
| 创建成功 | 201 | `{ success: true, data: {...} }` |
| 删除成功 | 204 | 无响应体 |
| 参数错误 | 400 | `{ success: false, error: { code, message, details } }` |
| 未认证 | 401 | `{ success: false, error: { code: "UNAUTHORIZED", message } }` |
| 无权限 | 403 | `{ success: false, error: { code: "FORBIDDEN", message } }` |
| 资源不存在 | 404 | `{ success: false, error: { code: "NOT_FOUND", message } }` |
| 限流 | 429 | `{ success: false, error: { code: "RATE_LIMITED", message } }` |
| 服务器错误 | 500 | `{ success: false, error: { code: "INTERNAL_ERROR", message } }` |

### 19.7 JWT 认证实战

```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';
const REFRESH_EXPIRES_IN = '7d';

// 生成 Token 对
function generateTokens(user) {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

// 认证中间件
function authenticate(req, res, next) {
  const authHeader = req.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('缺少认证令牌');
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new UnauthorizedError('令牌已过期，请刷新');
    }
    throw new UnauthorizedError('无效的令牌');
  }
}

// 权限检查中间件
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('无权限执行此操作');
    }
    next();
  };
}

// 使用
app.get('/api/v1/admin/users', authenticate, authorize('admin'), handler);
```

### 19.8 API 性能优化清单

| 优化措施 | 说明 | 预期效果 |
|---------|------|---------|
| 响应压缩 | Gzip/Brotli 压缩 | 减少 60-80% 传输量 |
| 数据库索引 | 为常用查询字段创建索引 | 查询速度提升 10-100 倍 |
| 缓存策略 | Redis 缓存热点数据 | 减少数据库查询 80%+ |
| 分页查询 | 避免一次返回所有数据 | 内存和带宽优化 |
| 字段选择 | 只查询需要的字段 | 减少数据传输 |
| 连接池 | 复用数据库连接 | 减少连接开销 |
| 异步处理 | 耗时操作放入队列 | 提高响应速度 |
| CDN | 静态资源使用 CDN | 减少服务器负载 |

```javascript
// 响应压缩
const compression = require('compression');
app.use(compression({
  level: 6,
  threshold: 1024, // 超过 1KB 才压缩
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// Redis 缓存中间件
function cacheMiddleware(keyGenerator, ttl = 300) {
  return async (req, res, next) => {
    const key = keyGenerator(req);
    const cached = await redis.get(key);

    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // 重写 res.json 以缓存响应
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      redis.setex(key, ttl, JSON.stringify(data));
      return originalJson(data);
    };

    next();
  };
}

// 使用缓存
app.get('/api/v1/products',
  cacheMiddleware((req) => `products:${req.query.category}:${req.query.page}`, 600),
  handler
);
```

### 19.9 API 国际化（i18n）

当 API 面向多语言用户时，需要支持国际化错误消息和内容。

```javascript
const i18next = require('i18next');

i18next.init({
  lng: 'zh', // 默认语言
  fallbackLng: 'en',
  resources: {
    zh: {
      translation: {
        'user.not_found': '用户不存在',
        'user.email_exists': '该邮箱已被注册',
        'auth.invalid_token': '无效的认证令牌',
        'auth.token_expired': '令牌已过期，请重新登录',
        'validation.required': '{{field}}为必填项',
        'validation.email_invalid': '邮箱格式不正确',
      }
    },
    en: {
      translation: {
        'user.not_found': 'User not found',
        'user.email_exists': 'Email already registered',
        'auth.invalid_token': 'Invalid authentication token',
        'auth.token_expired': 'Token expired, please login again',
        'validation.required': '{{field}} is required',
        'validation.email_invalid': 'Invalid email format',
      }
    }
  }
});

// 错误类支持国际化
class I18nError extends AppError {
  constructor(key, statusCode, code, params = {}) {
    const lang = getCurrentLanguage(); // 从请求头或 query 获取
    const message = i18next.t(key, { lng: lang, ...params });
    super(message, statusCode, code);
    this.i18nKey = key;
  }
}

// 中间件：从请求中提取语言偏好
function languageMiddleware(req, res, next) {
  // 优先级：Query 参数 > Accept-Language 头 > Cookie > 默认
  req.lang = req.query.lang
    || req.get('Accept-Language')?.split(',')[0]?.split('-')[0]
    || req.cookies?.lang
    || 'zh';
  next();
}

// 使用
app.get('/api/v1/users/:id', languageMiddleware, async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new I18nError('user.not_found', 404, 'NOT_FOUND');
  }
  res.json(user);
});
```

### 19.10 API 监控与可观测性

```javascript
const prometheus = require('prom-client');

// 收集默认指标（CPU、内存、事件循环等）
prometheus.collectDefaultMetrics({ prefix: 'my_api_' });

// 自定义指标
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP 请求持续时间',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'HTTP 请求总数',
  labelNames: ['method', 'route', 'status_code'],
});

const activeConnections = new prometheus.Gauge({
  name: 'active_connections',
  help: '当前活跃连接数',
});

// Express 监控中间件
function metricsMiddleware(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);

    httpRequestTotal
      .labels(req.method, route, res.statusCode)
      .inc();
  });

  next();
}

// 指标端点
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION,
  });
});

// 就绪检查（检查依赖服务）
app.get('/ready', async (req, res) => {
  try {
    await db.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: err.message });
  }
});
```

**可观测性三大支柱：**

| 支柱 | 说明 | 工具 |
|------|------|------|
| 指标（Metrics） | 可量化的数值数据 | Prometheus + Grafana |
| 日志（Logs） | 事件的详细记录 | ELK Stack / Loki |
| 追踪（Traces） | 请求的完整链路 | Jaeger / Zipkin |

```mermaid
graph TB
    subgraph 可观测性
    M[指标 Metrics] --> G[Grafana 仪表盘]
    L[日志 Logs] --> K[Kibana/Loki]
    T[追踪 Traces] --> J[Jaeger UI]
    end

    App[应用服务] --> M
    App --> L
    App --> T

    style M fill:#4CAF50,color:#fff
    style L fill:#2196F3,color:#fff
    style T fill:#FF9800,color:#fff
```

### 19.11 API 设计反模式与纠正

| 反模式 | 示例 | 正确做法 |
|--------|------|---------|
| 动词 URL | `GET /getUsers` | `GET /users` |
| 过深嵌套 | `GET /users/1/posts/5/comments/3` | `GET /comments/3` |
| 返回数组根 | `[{ id: 1 }, { id: 2 }]` | `{ data: [...] }` |
| 不一致命名 | `/api/get_user_list` | `/api/v1/users` |
| 忽略 HTTP 方法 | `POST /api/deleteUser` | `DELETE /api/users/:id` |
| 无分页 | 返回全部数据 | `?page=1&limit=20` |
| 敏感信息泄露 | 返回密码哈希 | 选择性返回字段 |
| 无错误码 | `{ "error": "失败" }` | `{ "error": { "code": "NOT_FOUND", "message": "..." } }` |

> 💡 **核心原则：** 好的 API 设计是开发者体验（DX）的核心。一致性、可预测性、清晰的错误信息——这些比花哨的功能更重要。API 是你和使用者之间的"契约"，一旦发布就很难修改，所以设计时要三思而后行。

---

## 19. API 安全最佳实践

API 是系统暴露给外部的接口，也是攻击者最常瞄准的目标。一个安全的 API 需要在认证、授权、限流、输入验证等多个层面建立防御。

### 19.1 认证（Authentication）

认证回答的是"你是谁"的问题。常见方案对比：

```mermaid
flowchart TD
    A[API 认证方案] --> B[API Key]
    A --> C[JWT Token]
    A --> D[OAuth 2.0]
    A --> E[Session Cookie]

    B --> B1[简单易用]
    B --> B2[适合服务间调用]
    C --> C1[无状态]
    C --> C2[适合分布式系统]
    D --> D1[第三方授权]
    D --> D2[细粒度权限]
    E --> E1[有状态]
    E --> E2[适合传统 Web]
```

```python
# JWT 认证完整实现
from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# 配置
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

security = HTTPBearer()

class TokenService:
    """Token 服务"""

    def __init__(self, secret_key: str, algorithm: str = "HS256"):
        self.secret_key = secret_key
        self.algorithm = algorithm

    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """创建访问 Token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        })
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def create_refresh_token(self, data: dict) -> str:
        """创建刷新 Token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh"
        })
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)

    def verify_token(self, token: str, expected_type: str = "access") -> dict:
        """验证 Token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])

            if payload.get("type") != expected_type:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="无效的 Token 类型"
                )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token 已过期"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的 Token"
            )

token_service = TokenService(SECRET_KEY)

# 依赖注入：获取当前用户
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> User:
    """从 Token 中解析当前用户"""
    payload = token_service.verify_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="无效的 Token")

    user = await db.get_user(int(user_id))
    if user is None:
        raise HTTPException(status_code=401, detail="用户不存在")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="用户已被禁用")

    return user

# 登录端点
@app.post("/api/auth/login")
async def login(request: LoginRequest):
    user = await authenticate_user(request.email, request.password)
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    access_token = token_service.create_access_token({"sub": str(user.id), "role": user.role})
    refresh_token = token_service.create_refresh_token({"sub": str(user.id)})

    # 存储 refresh token（用于吊销）
    await redis.setex(f"refresh_token:{user.id}", 86400 * 7, refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }

# 刷新 Token
@app.post("/api/auth/refresh")
async def refresh_token(refresh_request: RefreshRequest):
    payload = token_service.verify_token(refresh_request.refresh_token, expected_type="refresh")
    user_id = payload.get("sub")

    # 检查 refresh token 是否被吊销
    stored_token = await redis.get(f"refresh_token:{user_id}")
    if not stored_token or stored_token.decode() != refresh_request.refresh_token:
        raise HTTPException(status_code=401, detail="Refresh Token 已失效")

    # 生成新的 access token
    user = await db.get_user(int(user_id))
    new_access_token = token_service.create_access_token({"sub": str(user.id), "role": user.role})

    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
```

### 19.2 授权（Authorization）

```python
# 基于属性的访问控制（ABAC）
from dataclasses import dataclass
from typing import Any

@dataclass
class AccessRequest:
    """访问请求"""
    subject: dict    # 请求者信息
    action: str      # 操作类型
    resource: dict   # 资源信息
    context: dict    # 上下文信息（时间、IP等）

class PolicyEngine:
    """策略引擎"""

    def __init__(self):
        self.policies = []

    def add_policy(self, name: str, condition, effect: str = "allow"):
        """添加策略"""
        self.policies.append({
            "name": name,
            "condition": condition,
            "effect": effect,
        })

    def evaluate(self, request: AccessRequest) -> bool:
        """评估访问请求"""
        for policy in self.policies:
            if policy["condition"](request):
                return policy["effect"] == "allow"
        return False  # 默认拒绝

# 初始化策略引擎
policies = PolicyEngine()

# 策略1：管理员可以做任何事
policies.add_policy(
    "admin_full_access",
    lambda req: req.subject.get("role") == "admin"
)

# 策略2：用户只能操作自己的资源
policies.add_policy(
    "owner_access",
    lambda req: (
        req.subject.get("id") == req.resource.get("owner_id") and
        req.action in ("read", "update")
    )
)

# 策略3：工作时间内允许删除操作
policies.add_policy(
    "work_hours_delete",
    lambda req: (
        req.action == "delete" and
        9 <= req.context.get("hour", 0) <= 18
    )
)

# 中间件
@app.middleware("http")
async def authorization_middleware(request: Request, call_next):
    user = getattr(request.state, "user", None)
    if user:
        access_request = AccessRequest(
            subject={"id": user.id, "role": user.role},
            action=request.method.lower(),
            resource={"path": request.url.path},
            context={"hour": datetime.now().hour, "ip": request.client.host}
        )

        if not policies.evaluate(access_request):
            return JSONResponse(
                status_code=403,
                content={"detail": "权限不足"}
            )

    return await call_next(request)
```

### 19.3 限流（Rate Limiting）

```python
# 滑动窗口限流算法
import time
from collections import defaultdict

class SlidingWindowRateLimiter:
    """滑动窗口限流器"""

    def __init__(self, redis_client):
        self.redis = redis_client

    async def is_allowed(
        self,
        key: str,
        limit: int,
        window_seconds: int
    ) -> tuple[bool, dict]:
        """检查是否允许请求"""
        now = time.time()
        window_start = now - window_seconds

        pipe = self.redis.pipeline()

        # 清除窗口外的记录
        pipe.zremrangebyscore(key, 0, window_start)
        # 添加当前请求
        pipe.zadd(key, {str(now): now})
        # 统计窗口内的请求数
        pipe.zcard(key)
        # 设置 key 过期
        pipe.expire(key, window_seconds)

        results = await pipe.execute()
        request_count = results[2]

        remaining = max(0, limit - request_count)
        allowed = request_count <= limit

        return allowed, {
            "X-RateLimit-Limit": limit,
            "X-RateLimit-Remaining": remaining,
            "X-RateLimit-Reset": int(now + window_seconds),
        }

rate_limiter = SlidingWindowRateLimiter(redis_client)

# FastAPI 限流中间件
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # 获取客户端标识
    client_id = request.client.host
    user = getattr(request.state, "user", None)
    if user:
        client_id = f"user:{user.id}"

    # 不同端点不同限流规则
    path = request.url.path
    if path.startswith("/api/auth"):
        limit, window = 5, 60        # 认证接口：5次/分钟
    elif path.startswith("/api/search"):
        limit, window = 30, 60       # 搜索接口：30次/分钟
    elif request.method == "POST":
        limit, window = 20, 60       # 写操作：20次/分钟
    else:
        limit, window = 100, 60      # 默认：100次/分钟

    key = f"rate_limit:{client_id}:{path}"
    allowed, headers = await rate_limiter.is_allowed(key, limit, window)

    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "请求过于频繁，请稍后再试"},
            headers=headers
        )

    response = await call_next(request)

    # 添加限流响应头
    for name, value in headers.items():
        response.headers[name] = str(value)

    return response
```

```mermaid
flowchart TD
    A[请求到达] --> B{提取客户端标识}
    B --> C{查找限流规则}
    C --> D{滑动窗口检查}
    D -->|在限制内| E[放行请求]
    D -->|超出限制| F[返回 429]
    E --> G[添加限流响应头]
```

### 19.4 输入验证与输出编码

```python
# 深度输入验证
from pydantic import BaseModel, Field, validator, root_validator
from typing import List, Optional
import bleach

class OrderItemInput(BaseModel):
    product_id: int = Field(..., gt=0)
    quantity: int = Field(..., ge=1, le=99)
    unit_price: Optional[float] = Field(None, gt=0)  # 服务端计算，不信任客户端

class CreateOrderInput(BaseModel):
    items: List[OrderItemInput] = Field(..., min_items=1, max_items=50)
    shipping_address: str = Field(..., min_length=5, max_length=500)
    note: Optional[str] = Field(None, max_length=1000)
    coupon_code: Optional[str] = Field(None, max_length=50)

    @validator("shipping_address")
    def sanitize_address(cls, v):
        # 移除 HTML 标签
        cleaned = bleach.clean(v, tags=[], strip=True)
        if not cleaned.strip():
            raise ValueError("收货地址不能为空")
        return cleaned

    @validator("note")
    def sanitize_note(cls, v):
        if v is None:
            return v
        return bleach.clean(v, tags=[], strip=True)

    @root_validator
    def validate_order(cls, values):
        items = values.get("items", [])
        if not items:
            raise ValueError("订单至少包含一个商品")

        # 检查是否有重复商品
        product_ids = [item.product_id for item in items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("订单中包含重复商品")

        return values

# 输出编码
def sanitize_response(data: Any) -> Any:
    """递归清理响应数据"""
    if isinstance(data, str):
        # HTML 实体编码
        return (
            data.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#x27;")
        )
    elif isinstance(data, dict):
        return {k: sanitize_response(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_response(item) for item in data]
    return data
```

### 19.5 错误处理

```python
# 统一错误处理
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import traceback

class APIError(Exception):
    """API 基础异常"""
    def __init__(self, status_code: int, message: str, error_code: str = None):
        self.status_code = status_code
        self.message = message
        self.error_code = error_code

class NotFoundError(APIError):
    def __init__(self, resource: str, resource_id: Any):
        super().__init__(404, f"{resource} 不存在: {resource_id}", "RESOURCE_NOT_FOUND")

class ValidationError(APIError):
    def __init__(self, message: str):
        super().__init__(400, message, "VALIDATION_ERROR")

class ConflictError(APIError):
    def __init__(self, message: str):
        super().__init__(409, message, "CONFLICT")

class ForbiddenError(APIError):
    def __init__(self):
        super().__init__(403, "权限不足", "FORBIDDEN")

# 全局异常处理器
@app.exception_handler(APIError)
async def api_error_handler(request: Request, exc: APIError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.message,
                "request_id": getattr(request.state, "request_id", None),
            }
        }
    )

@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    # 记录完整错误信息到日志（不暴露给客户端）
    logger.error(
        f"未处理的异常: {exc}",
        extra={
            "request_id": getattr(request.state, "request_id", None),
            "path": request.url.path,
            "method": request.method,
            "traceback": traceback.format_exc(),
        }
    )

    # 返回通用错误信息（不泄露内部细节）
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "服务器内部错误，请稍后再试",
                "request_id": getattr(request.state, "request_id", None),
            }
        }
    )
```

---

## 20. API 版本管理策略

随着 API 的演进，版本管理变得至关重要。好的版本策略能让 API 平滑演进，不破坏现有客户端。

### 20.1 版本管理方式对比

```mermaid
flowchart LR
    A[API 版本管理] --> B[URL 路径版本]
    A --> C[请求头版本]
    A --> D[查询参数版本]

    B --> B1["/v1/users"]
    C --> C1["Accept: application/vnd.api.v1+json"]
    D --> D1["/users?version=1"]
```

| 方式 | 示例 | 优点 | 缺点 |
|------|------|------|------|
| URL 路径 | `/api/v1/users` | 直观、易缓存、易路由 | URL 变长、需维护多套路由 |
| 请求头 | `Accept: application/vnd.api.v2+json` | URL 干净、符合 REST | 不直观、缓存复杂 |
| 查询参数 | `/api/users?version=2` | 简单 | 不规范、缓存问题 |

### 20.2 URL 路径版本实现

```python
# FastAPI 多版本 API 实现
from fastapi import APIRouter, FastAPI

app = FastAPI()

# 创建版本路由器
v1_router = APIRouter(prefix="/api/v1", tags=["v1"])
v2_router = APIRouter(prefix="/api/v2", tags=["v2"])

# V1 版本
@v1_router.get("/users")
async def list_users_v1(page: int = 1, size: int = 20):
    """V1: 简单分页"""
    users = await db.fetch_all(
        "SELECT id, name, email FROM users LIMIT $1 OFFSET $2",
        size, (page - 1) * size
    )
    return {"users": users}

@v1_router.get("/users/{user_id}")
async def get_user_v1(user_id: int):
    """V1: 返回基础用户信息"""
    user = await db.fetchrow("SELECT id, name, email FROM users WHERE id=$1", user_id)
    if not user:
        raise NotFoundError("用户", user_id)
    return dict(user)

# V2 版本（增强版）
@v2_router.get("/users")
async def list_users_v2(
    page: int = 1,
    size: int = 20,
    sort_by: str = "created_at",
    order: str = "desc",
    search: str = None
):
    """V2: 支持搜索、排序、游标分页"""
    # 构建查询
    conditions = []
    params = []
    if search:
        conditions.append(f"(name ILIKE ${len(params)+1} OR email ILIKE ${len(params)+1})")
        params.append(f"%{search}%")

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    # 允许的排序字段白名单
    allowed_sort_fields = {"created_at", "name", "email"}
    if sort_by not in allowed_sort_fields:
        sort_by = "created_at"
    order_dir = "DESC" if order.lower() == "desc" else "ASC"

    total = await db.fetchval(f"SELECT COUNT(*) FROM users WHERE {where_clause}", *params)
    users = await db.fetch_all(
        f"SELECT id, name, email, avatar, created_at FROM users "
        f"WHERE {where_clause} ORDER BY {sort_by} {order_dir} "
        f"LIMIT ${len(params)+1} OFFSET ${len(params)+2}",
        *params, size, (page - 1) * size
    )

    return {
        "data": users,
        "pagination": {
            "page": page,
            "size": size,
            "total": total,
            "total_pages": (total + size - 1) // size,
        },
        "links": {
            "self": f"/api/v2/users?page={page}&size={size}",
            "next": f"/api/v2/users?page={page+1}&size={size}" if page * size < total else None,
            "prev": f"/api/v2/users?page={page-1}&size={size}" if page > 1 else None,
        }
    }

@v2_router.get("/users/{user_id}")
async def get_user_v2(user_id: int):
    """V2: 返回扩展用户信息"""
    user = await db.fetchrow(
        "SELECT id, name, email, avatar, bio, created_at, updated_at FROM users WHERE id=$1",
        user_id
    )
    if not user:
        raise NotFoundError("用户", user_id)

    # V2 新增：关联数据
    order_count = await db.fetchval(
        "SELECT COUNT(*) FROM orders WHERE user_id=$1", user_id
    )

    return {
        "data": dict(user),
        "meta": {
            "order_count": order_count,
        }
    }

# 注册路由
app.include_router(v1_router)
app.include_router(v2_router)
```

### 20.3 版本废弃策略

```python
# 版本废弃中间件
from datetime import datetime, timedelta

VERSION_SCHEDULE = {
    "v1": {
        "status": "deprecated",
        "deprecated_date": "2024-01-01",
        "sunset_date": "2025-01-01",  # 下线日期
        "message": "API v1 已废弃，请迁移到 v2。详见迁移指南: https://docs.example.com/migration/v1-to-v2"
    },
    "v2": {
        "status": "current",
        "deprecated_date": None,
        "sunset_date": None,
    }
}

@app.middleware("http")
async def version_deprecation_middleware(request: Request, call_next):
    response = await call_next(request)

    # 检测 API 版本
    path = request.url.path
    version = None
    if "/api/v1/" in path:
        version = "v1"
    elif "/api/v2/" in path:
        version = "v2"

    if version and version in VERSION_SCHEDULE:
        schedule = VERSION_SCHEDULE[version]

        if schedule["status"] == "deprecated":
            response.headers["Deprecation"] = "true"
            response.headers["Sunset"] = schedule["sunset_date"]
            response.headers["Link"] = '</api/v2/>; rel="successor-version"'
            response.headers["X-Deprecation-Message"] = schedule["message"]

            # 距离下线不到 90 天，添加更强烈的警告
            sunset = datetime.strptime(schedule["sunset_date"], "%Y-%m-%d")
            days_left = (sunset - datetime.now()).days
            if days_left < 90:
                logger.warning(
                    f"即将下线的 API 版本 {version}，"
                    f"剩余 {days_left} 天，请求路径: {path}"
                )

    return response
```

```mermaid
timeline
    title API 版本生命周期
    section V1 生命周期
        2023-01 : V1 发布
        2024-01 : V1 标记废弃
        2024-06 : V1 废弃通知加强
        2025-01 : V1 下线
    section V2 生命周期
        2024-01 : V2 发布
        2024-06 : V2 成为默认版本
        2025-01 : V2 唯一活跃版本
```

---

## 21. API 监控与可观测性

### 21.1 三大支柱

```mermaid
flowchart TD
    A[可观测性] --> B[指标 Metrics]
    A --> C[日志 Logs]
    A --> D[链路追踪 Traces]

    B --> B1[请求计数]
    B --> B2[延迟分布]
    B --> B3[错误率]
    B --> B4[饱和度]

    C --> C1[结构化日志]
    C --> C2[错误堆栈]
    C --> C3[业务事件]

    D --> D1[请求链路]
    D --> D2[服务依赖]
    D --> D3[瓶颈定位]
```

```python
# API 指标中间件
from prometheus_client import Counter, Histogram, Gauge, Summary

# 请求计数
API_REQUESTS = Counter(
    "api_requests_total",
    "API 请求总数",
    ["method", "endpoint", "version", "status_code"]
)

# 请求延迟
API_LATENCY = Histogram(
    "api_request_duration_seconds",
    "API 请求延迟",
    ["method", "endpoint", "version"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

# 请求大小
API_REQUEST_SIZE = Summary(
    "api_request_size_bytes",
    "API 请求体大小",
    ["method", "endpoint"]
)

# 响应大小
API_RESPONSE_SIZE = Summary(
    "api_response_size_bytes",
    "API 响应体大小",
    ["method", "endpoint"]
)

# 当前活跃请求
API_IN_PROGRESS = Gauge(
    "api_in_progress_requests",
    "当前正在处理的请求数",
    ["method", "endpoint"]
)

# 业务指标
ORDER_TOTAL = Counter(
    "orders_created_total",
    "订单创建总数",
    ["payment_method", "status"]
)

PAYMENT_AMOUNT = Histogram(
    "payment_amount_dollars",
    "支付金额分布",
    buckets=[10, 50, 100, 500, 1000, 5000]
)

@app.middleware("http")
async def api_metrics_middleware(request: Request, call_next):
    # 提取版本号
    version = "unknown"
    if "/api/v1/" in request.url.path:
        version = "v1"
    elif "/api/v2/" in request.url.path:
        version = "v2"

    endpoint = request.url.path
    method = request.method

    API_IN_PROGRESS.labels(method=method, endpoint=endpoint).inc()

    # 记录请求大小
    content_length = request.headers.get("content-length")
    if content_length:
        API_REQUEST_SIZE.labels(method=method, endpoint=endpoint).observe(int(content_length))

    start_time = time.perf_counter()

    try:
        response = await call_next(request)
        duration = time.perf_counter() - start_time

        API_REQUESTS.labels(
            method=method,
            endpoint=endpoint,
            version=version,
            status_code=response.status_code
        ).inc()

        API_LATENCY.labels(
            method=method, endpoint=endpoint, version=version
        ).observe(duration)

        # 记录响应大小
        resp_length = response.headers.get("content-length")
        if resp_length:
            API_RESPONSE_SIZE.labels(method=method, endpoint=endpoint).observe(int(resp_length))

        return response

    except Exception:
        API_REQUESTS.labels(
            method=method, endpoint=endpoint, version=version, status_code=500
        ).inc()
        raise

    finally:
        API_IN_PROGRESS.labels(method=method, endpoint=endpoint).dec()
```

### 21.2 链路追踪

```python
# OpenTelemetry 集成
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor

# 初始化 Tracer
def setup_tracing(service_name: str):
    provider = TracerProvider()

    # 导出到 Jaeger
    jaeger_exporter = JaegerExporter(
        agent_host_name="jaeger",
        agent_port=6831,
    )
    provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))

    trace.set_tracer_provider(provider)

    # 自动埋点
    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()
    AsyncPGInstrumentor().instrument()

    return trace.get_tracer(service_name)

tracer = setup_tracing("api-service")

# 手动添加 Span
@app.post("/api/orders")
async def create_order(order_input: CreateOrderInput, request: Request):
    with tracer.start_as_current_span("create_order") as span:
        span.set_attribute("order.items_count", len(order_input.items))

        with tracer.start_as_current_span("validate_inventory"):
            # 验证库存
            for item in order_input.items:
                stock = await check_stock(item.product_id, item.quantity)
                if not stock:
                    raise ValidationError(f"商品 {item.product_id} 库存不足")

        with tracer.start_as_current_span("calculate_total"):
            total = await calculate_order_total(order_input.items)

        with tracer.start_as_current_span("save_order"):
            order = await save_order_to_db(order_input, total)

        span.set_attribute("order.total", total)
        span.set_attribute("order.id", order["id"])

        return {"order_id": order["id"], "total": total}
```

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant Cache
    participant Payment

    Client->>API: POST /api/orders
    Note over API: Span: create_order
    API->>Cache: 检查商品缓存
    Note over API: Span: check_cache
    Cache-->>API: 缓存命中
    API->>DB: 验证库存
    Note over API: Span: validate_inventory
    DB-->>API: 库存充足
    API->>API: 计算总价
    Note over API: Span: calculate_total
    API->>DB: 保存订单
    Note over API: Span: save_order
    DB-->>API: 订单创建成功
    API->>Payment: 发起支付
    Note over API: Span: create_payment
    Payment-->>API: 支付链接
    API-->>Client: 201 Created
```

---

## 22. API 测试策略

### 22.1 契约测试

契约测试确保 API 提供者和消费者之间的接口约定不被破坏。

```python
# 使用 Pact 进行契约测试
import pytest
from pact import Consumer, Provider

# 消费者端测试
pact = Consumer("mobile-app").has_pact_with(Provider("api-service"))

@pytest.fixture
def api_client():
    return pact

class TestUserAPIContract:
    def test_get_user(self, api_client):
        """契约：获取用户"""
        expected = {
            "id": 1,
            "name": "张三",
            "email": "zhangsan@example.com"
        }

        (api_client
            .given("用户 ID 1 存在")
            .upon_receiving("获取用户详情的请求")
            .with_request("get", "/api/v2/users/1")
            .will_respond_with(200, body=expected))

        with pact:
            result = requests.get(f"{pact.uri}/api/v2/users/1")
            assert result.json() == expected

    def test_user_not_found(self, api_client):
        """契约：用户不存在"""
        (api_client
            .given("用户 ID 999 不存在")
            .upon_receiving("获取不存在用户的请求")
            .with_request("get", "/api/v2/users/999")
            .will_respond_with(404, body={
                "error": {"code": "RESOURCE_NOT_FOUND", "message": "用户不存在: 999"}
            }))

        with pact:
            result = requests.get(f"{pact.uri}/api/v2/users/999")
            assert result.status_code == 404
```

### 22.2 API 测试矩阵

```mermaid
flowchart TD
    A[API 测试] --> B[单元测试]
    A --> C[集成测试]
    A --> D[契约测试]
    A --> E[负载测试]
    A --> F[安全测试]

    B --> B1[请求验证]
    B --> B2[响应格式]
    B --> B3[业务逻辑]
    C --> C1[端到端流程]
    C --> C2[数据库交互]
    C --> C3[外部服务]
    D --> D1[消费者契约]
    D --> D2[提供者验证]
    E --> E1[并发测试]
    E --> E2[压力测试]
    F --> F1[注入测试]
    F --> F2[认证绕过]
```

| 测试类型 | 工具 | 关注点 | 执行频率 |
|---------|------|--------|---------|
| 单元测试 | pytest | 函数逻辑、数据验证 | 每次提交 |
| 集成测试 | httpx + testcontainers | 端到端流程 | 每次 PR |
| 契约测试 | Pact / Dredd | 接口一致性 | 每次 PR |
| 负载测试 | Locust / k6 / wrk | 性能、吞吐量 | 每周 |
| 安全测试 | OWASP ZAP / Burp Suite | 漏洞扫描 | 每月 |

---

## 23. API 文档最佳实践

### 23.1 OpenAPI 规范

```python
# FastAPI 自动生成 OpenAPI 文档
from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import List, Optional

app = FastAPI(
    title="AI-CLI-Mobile API",
    description="""
    ## AI-CLI-Mobile 后端 API

    提供用户管理、订单处理、支付集成等核心功能。

    ### 认证方式
    所有 API（除登录外）需要在请求头中携带 JWT Token：
    ```
    Authorization: Bearer <token>
    ```

    ### 通用响应格式
    ```json
    {
        "data": { ... },
        "meta": { ... },
        "links": { ... }
    }
    ```

    ### 错误响应格式
    ```json
    {
        "error": {
            "code": "ERROR_CODE",
            "message": "错误描述",
            "request_id": "uuid"
        }
    }
    ```
    """,
    version="2.0.0",
    contact={
        "name": "API 支持",
        "email": "api@example.com",
    },
    license_info={
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)

# 带文档的 API 端点
@app.get(
    "/api/v2/users/{user_id}",
    summary="获取用户详情",
    description="根据用户 ID 获取用户的详细信息，包括基本信息和统计数据。",
    response_model=UserResponse,
    responses={
        200: {"description": "成功返回用户信息"},
        404: {"description": "用户不存在", "model": ErrorResponse},
        401: {"description": "未认证", "model": ErrorResponse},
    },
    tags=["用户管理"]
)
async def get_user(
    user_id: int = Field(..., description="用户 ID", gt=0, example=1)
):
    """
    获取指定用户的详细信息。

    - **user_id**: 用户的唯一标识符

    返回用户的个人信息、订单统计等数据。
    """
    pass
```

### 23.2 API 文档版本管理

```yaml
# openapi.yaml 片段
openapi: 3.0.3
info:
  title: AI-CLI-Mobile API
  version: 2.0.0
  description: |
    完整的后端 API 文档。

    ## 变更日志

    ### v2.0.0 (2024-01-15)
    - 新增用户搜索功能
    - 支持游标分页
    - 新增批量操作端点

    ### v1.5.0 (2023-10-01)
    - 新增订单导出功能
    - 优化分页响应格式

    ### v1.0.0 (2023-01-01)
    - 初始版本

servers:
  - url: https://api.example.com
    description: 生产环境
  - url: https://staging-api.example.com
    description: 预发布环境
  - url: http://localhost:8000
    description: 本地开发环境

paths:
  /api/v2/users:
    get:
      summary: 获取用户列表
      operationId: listUsers
      tags:
        - 用户管理
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
            minimum: 1
          description: 页码
        - name: size
          in: query
          schema:
            type: integer
            default: 20
            minimum: 1
            maximum: 100
          description: 每页数量
        - name: search
          in: query
          schema:
            type: string
          description: 搜索关键词（支持名称和邮箱）
      responses:
        '200':
          description: 成功返回用户列表
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
        '401':
          $ref: '#/components/responses/Unauthorized'
```

### 23.3 Redoc 文档美化

```html
<!-- docs/index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>AI-CLI-Mobile API 文档</title>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { margin: 0; padding: 0; }
    </style>
</head>
<body>
    <redoc
        spec-url="/openapi.json"
        theme='{
            "colors": {
                "primary": {"main": "#1976d2"}
            },
            "typography": {
                "fontSize": "15px",
                "fontFamily": "Inter, -apple-system, sans-serif"
            },
            "sidebar": {
                "width": "280px"
            }
        }'
        expand-responses="200,201"
        path-in-middle-panel="true"
        hide-download-button="false"
        required-props-first="true"
        sort-props-alphabetically="true"
    ></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
```

---

## 24. API 设计模式

### 24.1 分页模式

```python
# 三种分页方式的实现

# 方式1：偏移量分页（最常见）
@app.get("/api/v2/users")
async def list_users_offset(page: int = 1, size: int = 20):
    offset = (page - 1) * size
    total = await db.fetchval("SELECT COUNT(*) FROM users")
    users = await db.fetch_all(
        "SELECT * FROM users ORDER BY id LIMIT $1 OFFSET $2",
        size, offset
    )
    return {
        "data": users,
        "pagination": {
            "page": page,
            "size": size,
            "total": total,
            "total_pages": (total + size - 1) // size,
        }
    }

# 方式2：游标分页（大数据量推荐）
@app.get("/api/v2/users")
async def list_users_cursor(cursor: str = None, size: int = 20):
    if cursor:
        # 解码游标
        cursor_id = decode_cursor(cursor)  # Base64 解码
        users = await db.fetch_all(
            "SELECT * FROM users WHERE id > $1 ORDER BY id LIMIT $2",
            cursor_id, size
        )
    else:
        users = await db.fetch_all(
            "SELECT * FROM users ORDER BY id LIMIT $1", size
        )

    next_cursor = encode_cursor(users[-1]["id"]) if len(users) == size else None

    return {
        "data": users,
        "pagination": {
            "next_cursor": next_cursor,
            "has_more": len(users) == size,
        }
    }

# 方式3：键集分页（性能最优）
@app.get("/api/v2/users")
async def list_users_keyset(last_id: int = 0, last_created_at: str = None, size: int = 20):
    if last_created_at:
        users = await db.fetch_all("""
            SELECT * FROM users
            WHERE (created_at, id) > ($1, $2)
            ORDER BY created_at, id
            LIMIT $3
        """, last_created_at, last_id, size)
    else:
        users = await db.fetch_all(
            "SELECT * FROM users ORDER BY created_at, id LIMIT $1", size
        )

    return {
        "data": users,
        "next": {
            "last_id": users[-1]["id"],
            "last_created_at": users[-1]["created_at"],
        } if len(users) == size else None
    }
```

```mermaid
flowchart LR
    A[分页方式选择] --> B{数据量}
    B -->|< 10K| C[偏移量分页]
    B -->|10K-1M| D[游标分页]
    B -->|> 1M| E[键集分页]

    C --> C1[简单直观, 支持跳页]
    D --> D1[性能稳定, 不支持跳页]
    E --> E1[性能最优, 需要复合排序]
```

### 24.2 过滤与排序

```python
# 通用过滤器
from typing import List, Optional
from enum import Enum

class SortOrder(str, Enum):
    ASC = "asc"
    DESC = "desc"

@app.get("/api/v2/products")
async def list_products(
    # 过滤参数
    category: Optional[str] = None,
    min_price: Optional[float] = Field(None, ge=0),
    max_price: Optional[float] = Field(None, ge=0),
    in_stock: Optional[bool] = None,
    created_after: Optional[datetime] = None,

    # 排序参数
    sort_by: str = "created_at",
    sort_order: SortOrder = SortOrder.DESC,

    # 分页参数
    page: int = 1,
    size: int = 20,
):
    """商品列表（支持过滤、排序、分页）"""

    # 构建动态查询
    conditions = []
    params = []
    param_idx = 1

    if category:
        conditions.append(f"category = ${param_idx}")
        params.append(category)
        param_idx += 1

    if min_price is not None:
        conditions.append(f"price >= ${param_idx}")
        params.append(min_price)
        param_idx += 1

    if max_price is not None:
        conditions.append(f"price <= ${param_idx}")
        params.append(max_price)
        param_idx += 1

    if in_stock is not None:
        if in_stock:
            conditions.append("stock > 0")
        else:
            conditions.append("stock = 0")

    if created_after:
        conditions.append(f"created_at >= ${param_idx}")
        params.append(created_after)
        param_idx += 1

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    # 排序字段白名单
    allowed_sort_fields = {"created_at", "price", "name", "rating", "sales_count"}
    if sort_by not in allowed_sort_fields:
        sort_by = "created_at"

    order_clause = f"ORDER BY {sort_by} {sort_order.value}"

    # 分页
    offset = (page - 1) * size

    # 执行查询
    total = await db.fetchval(
        f"SELECT COUNT(*) FROM products WHERE {where_clause}", *params
    )
    products = await db.fetch_all(
        f"SELECT * FROM products WHERE {where_clause} {order_clause} "
        f"LIMIT ${param_idx} OFFSET ${param_idx + 1}",
        *params, size, offset
    )

    return {
        "data": products,
        "pagination": {"page": page, "size": size, "total": total},
        "filters_applied": {
            k: v for k, v in {
                "category": category, "min_price": min_price,
                "max_price": max_price, "in_stock": in_stock,
            }.items() if v is not None
        }
    }
```

### 24.3 批量操作

```python
# 批量操作端点
from typing import List

class BatchCreateUsersRequest(BaseModel):
    users: List[CreateUserRequest] = Field(..., min_items=1, max_items=100)

class BatchResult(BaseModel):
    success_count: int
    failure_count: int
    results: List[dict]

@app.post("/api/v2/users/batch", response_model=BatchResult)
async def batch_create_users(batch: BatchCreateUsersRequest):
    """批量创建用户（最多 100 个）"""
    success_count = 0
    failure_count = 0
    results = []

    async with db.transaction():
        for i, user_data in enumerate(batch.users):
            try:
                user = await create_user_in_db(user_data)
                success_count += 1
                results.append({"index": i, "status": "success", "id": user["id"]})
            except DuplicateEmailError:
                failure_count += 1
                results.append({"index": i, "status": "failure", "error": "邮箱已存在"})
            except Exception as e:
                failure_count += 1
                results.append({"index": i, "status": "failure", "error": str(e)})

    return BatchResult(
        success_count=success_count,
        failure_count=failure_count,
        results=results
    )

# 批量删除
class BatchDeleteRequest(BaseModel):
    ids: List[int] = Field(..., min_items=1, max_items=100)

@app.delete("/api/v2/users/batch")
async def batch_delete_users(batch: BatchDeleteRequest):
    """批量删除用户"""
    result = await db.execute(
        "DELETE FROM users WHERE id = ANY($1)",
        batch.ids
    )
    deleted_count = int(result.split()[-1])
    return {"deleted": deleted_count, "requested": len(batch.ids)}
```

### 24.4 异步操作

```python
# 长时间运行的任务使用异步操作模式
import uuid
from datetime import datetime

# 任务存储
task_store = {}

@app.post("/api/v2/reports/export", status_code=202)
async def create_export_task(
    export_request: ExportRequest,
    background_tasks: BackgroundTasks,
    request: Request
):
    """创建导出任务（异步）"""
    task_id = str(uuid.uuid4())

    task_store[task_id] = {
        "id": task_id,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "progress": 0,
        "result_url": None,
    }

    # 后台执行
    background_tasks.add_task(export_report, task_id, export_request)

    return JSONResponse(
        status_code=202,
        content={
            "task_id": task_id,
            "status": "pending",
            "links": {
                "self": f"/api/v2/tasks/{task_id}",
                "cancel": f"/api/v2/tasks/{task_id}/cancel",
            }
        },
        headers={
            "Location": f"/api/v2/tasks/{task_id}",
            "Retry-After": "5",
        }
    )

@app.get("/api/v2/tasks/{task_id}")
async def get_task_status(task_id: str):
    """查询任务状态"""
    if task_id not in task_store:
        raise NotFoundError("任务", task_id)

    task = task_store[task_id]

    response = {
        "id": task["id"],
        "status": task["status"],
        "progress": task["progress"],
        "created_at": task["created_at"],
    }

    if task["status"] == "completed":
        response["result_url"] = task["result_url"]
        response["expires_at"] = task.get("expires_at")

    return response

async def export_report(task_id: str, request: ExportRequest):
    """后台导出任务"""
    try:
        task_store[task_id]["status"] = "processing"

        # 模拟长时间处理
        for i in range(10):
            await asyncio.sleep(1)
            task_store[task_id]["progress"] = (i + 1) * 10

        # 生成文件
        file_url = await generate_report_file(request)

        task_store[task_id]["status"] = "completed"
        task_store[task_id]["result_url"] = file_url
        task_store[task_id]["expires_at"] = (
            datetime.utcnow() + timedelta(hours=24)
        ).isoformat()

    except Exception as e:
        task_store[task_id]["status"] = "failed"
        task_store[task_id]["error"] = str(e)
```

### 24.5 Webhook 设计

```python
# Webhook 系统
import hashlib
import hmac

class WebhookEvent(BaseModel):
    event_type: str      # 事件类型
    payload: dict        # 事件数据
    timestamp: datetime  # 事件时间
    webhook_id: str      # Webhook 配置 ID

class WebhookConfig(BaseModel):
    id: str
    url: str             # 回调 URL
    events: List[str]    # 订阅的事件类型
    secret: str          # 签名密钥
    active: bool = True

class WebhookService:
    """Webhook 服务"""

    def __init__(self, db, http_client):
        self.db = db
        self.http = http_client

    async def dispatch(self, event_type: str, payload: dict):
        """派发事件到所有订阅的 Webhook"""
        webhooks = await self.db.fetch_all(
            "SELECT * FROM webhook_configs WHERE active = true AND $1 = ANY(events)",
            event_type
        )

        for webhook in webhooks:
            await self._send_webhook(webhook, event_type, payload)

    async def _send_webhook(self, webhook: dict, event_type: str, payload: dict):
        """发送 Webhook 请求"""
        event = WebhookEvent(
            event_type=event_type,
            payload=payload,
            timestamp=datetime.utcnow(),
            webhook_id=webhook["id"]
        )

        # 计算签名
        body = event.json()
        signature = hmac.new(
            webhook["secret"].encode(),
            body.encode(),
            hashlib.sha256
        ).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Signature": f"sha256={signature}",
            "X-Webhook-Event": event_type,
            "X-Webhook-Delivery": str(uuid.uuid4()),
        }

        # 重试逻辑
        for attempt in range(3):
            try:
                response = await self.http.post(
                    webhook["url"],
                    content=body,
                    headers=headers,
                    timeout=10.0
                )
                if response.status_code < 300:
                    await self._log_delivery(webhook["id"], "success", response.status_code)
                    return
            except Exception as e:
                if attempt == 2:
                    await self._log_delivery(webhook["id"], "failed", error=str(e))

            await asyncio.sleep(2 ** attempt)  # 指数退避

# 使用示例：订单状态变更时派发 Webhook
@app.put("/api/v2/orders/{order_id}/status")
async def update_order_status(order_id: int, new_status: str):
    order = await update_order(order_id, new_status)

    # 派发 Webhook 事件
    await webhook_service.dispatch(
        f"order.{new_status}",
        {
            "order_id": order_id,
            "status": new_status,
            "updated_at": datetime.utcnow().isoformat(),
        }
    )

    return order
```

```mermaid
sequenceDiagram
    participant App as 你的服务
    participant Webhook as Webhook 服务
    participant Client as 客户端

    App->>Webhook: 订单状态变更
    Webhook->>Webhook: 查找订阅该事件的 Webhook
    Webhook->>Client: POST 回调 URL<br/>X-Webhook-Signature: sha256=xxx
    Client-->>Webhook: 200 OK
    Webhook->>Webhook: 记录成功

    Note over Webhook,Client: 失败时自动重试
    Webhook->>Client: POST (重试 #1)
    Client-->>Webhook: 500 Error
    Webhook->>Webhook: 等待 2s
    Webhook->>Client: POST (重试 #2)
    Client-->>Webhook: 200 OK
```

| 模式 | 适用场景 | 关键点 |
|------|---------|--------|
| 偏移量分页 | 小数据量、需要跳页 | `?page=2&size=20` |
| 游标分页 | 大数据量、无限滚动 | `?cursor=abc123` |
| 键集分页 | 超大数据量、高性能 | `?last_id=100&last_time=...` |
| 批量操作 | 减少请求数 | 限制批量大小、部分成功处理 |
| 异步操作 | 长时间任务 | 202 Accepted + 轮询/回调 |
| Webhook | 事件通知 | 签名验证、重试机制、幂等处理 |

---

> **本章小结**：API 安全需要从认证、授权、限流、输入验证、错误处理多个层面建立防御；版本管理推荐 URL 路径方式，配合清晰的废弃策略；可观测性三大支柱（指标、日志、链路追踪）缺一不可；测试应覆盖单元、集成、契约、负载、安全五个维度；好的 API 文档是开发者的生产力工具；分页、过滤、批量、异步、Webhook 等设计模式解决常见的 API 设计难题。
