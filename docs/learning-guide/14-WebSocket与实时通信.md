# WebSocket 与实时通信

> 📖 本篇是学习指南的第十四篇，面向完全不懂的初学者，从零开始讲解 WebSocket 实时通信技术。
> 阅读本篇后，你将理解：浏览器与服务器之间如何建立实时双向通信、WebSocket 协议的工作原理、
> 以及 AI-CLI-Mobile 项目如何利用 WebSocket 双通道架构实现手机端终端的实时交互。

---

## 目录

- [第一章：实时通信技术概览](#第一章实时通信技术概览)
  - [1.1 为什么需要实时通信？](#11-为什么需要实时通信)
  - [1.2 HTTP 的局限性](#12-http-的局限性)
  - [1.3 四种实时通信方案](#13-四种实时通信方案)
  - [1.4 轮询详解](#14-轮询详解)
  - [1.5 长轮询详解](#15-长轮询详解)
  - [1.6 SSE 详解](#16-sse-详解)
  - [1.7 WebSocket 详解](#17-websocket-详解)
  - [1.8 四种方案对比表](#18-四种方案对比表)
  - [1.9 WebSocket 的优势与适用场景](#19-websocket-的优势与适用场景)
- [第二章：WebSocket 协议详解](#第二章websocket-协议详解)
  - [2.1 握手过程（HTTP Upgrade）](#21-握手过程http-upgrade)
  - [2.2 帧格式（Frame Format）](#22-帧格式frame-format)
  - [2.3 文本帧 vs 二进制帧](#23-文本帧-vs-二进制帧)
  - [2.4 关闭帧与状态码](#24-关闭帧与状态码)
  - [2.5 Ping/Pong 心跳](#25-pingpong-心跳)
  - [2.6 消息分片（Fragmentation）](#26-消息分片fragmentation)
  - [2.7 掩码（Masking）](#27-掩码masking)
- [第三章：浏览器端 WebSocket API](#第三章浏览器端-websocket-api)
  - [3.1 WebSocket 对象创建](#31-websocket-对象创建)
  - [3.2 事件详解](#32-事件详解)
  - [3.3 发送文本与二进制数据](#33-发送文本与二进制数据)
  - [3.4 重连策略](#34-重连策略)
  - [3.5 useDualChannelWS 完整分析](#35-usedualchannelws-完整分析)
  - [3.6 离线缓存机制](#36-离线缓存机制)
  - [3.7 连接状态管理](#37-连接状态管理)
- [第四章：服务端 WebSocket（ws 库）](#第四章服务端websocketws-库)
  - [4.1 ws 库基础使用](#41-ws-库基础使用)
  - [4.2 @fastify/websocket 集成](#42-fastifywebsocket-集成)
  - [4.3 消息路由](#43-消息路由)
  - [4.4 连接管理](#44-连接管理)
  - [4.5 WSGateway 逐行分析](#45-wsgateway-逐行分析)
  - [4.6 SessionManager 集成](#46-sessionmanager-集成)
- [第五章：WebSocket 双通道架构](#第五章websocket-双通道架构)
  - [5.1 什么是双通道？](#51-什么是双通道)
  - [5.2 Terminal Channel](#52-terminal-channel)
  - [5.3 Control Channel](#53-control-channel)
  - [5.4 双通道的设计理由](#54-双通道的设计理由)
  - [5.5 独立重连机制](#55-独立重连机制)
  - [5.6 协议版本管理](#56-协议版本管理)
- [第六章：WebSocket 安全](#第六章websocket-安全)
  - [6.1 WSS（WebSocket Secure）](#61-wsswebsocket-secure)
  - [6.2 认证机制](#62-认证机制)
  - [6.3 消息验证](#63-消息验证)
  - [6.4 防止滥用](#64-防止滥用)
  - [6.5 会话隔离](#65-会话隔离)
  - [6.6 安全措施总结](#66-安全措施总结)
- [第七章：性能优化](#第七章性能优化)
  - [7.1 二进制 vs JSON](#71-二进制-vs-json)
  - [7.2 消息压缩](#72-消息压缩)
  - [7.3 背压控制](#73-背压控制)
  - [7.4 连接池管理](#74-连接池管理)
  - [7.5 Resize 防抖节流](#75-resize-防抖节流)
  - [7.6 内存优化](#76-内存优化)
- [第八章：WebSocket 测试与调试](#第八章websocket-测试与调试)
  - [8.1 Chrome DevTools](#81-chrome-devtools)
  - [8.2 wscat 命令行测试](#82-wscat-命令行测试)
  - [8.3 单元测试策略](#83-单元测试策略)
  - [8.4 端到端测试](#84-端到端测试)
  - [8.5 问题排查指南](#85-问题排查指南)

---

# 第一章：实时通信技术概览

## 1.1 为什么需要实时通信？

在传统的 Web 应用中，浏览器和服务器之间的通信模式是**请求-响应**（Request-Response）：浏览器发请求，服务器返回数据，然后连接就断了。这就像写信——你寄出一封信，然后等待回信。

但很多场景需要**实时**通信：

- **聊天应用**：你发一条消息，对方要立刻看到
- **在线游戏**：你的操作需要立刻同步到其他玩家的屏幕上
- **股票行情**：价格每秒都在变化，用户需要实时看到
- **终端模拟器**：你在手机上敲一个键，服务器上的终端要立刻响应
- **协同编辑**：多个人同时编辑一个文档，每个人的修改要立刻同步给其他人
- **实时监控**：服务器的 CPU、内存、网络流量每秒都在变化
- **在线教育**：老师的白板内容要实时同步给所有学生
- **物联网**：传感器的数据持续不断地发送到服务器

这些场景要求数据能**即时**在客户端和服务器之间流动，而不是等用户手动刷新页面。

### 实时性的量化标准

| 延迟等级 | 延迟范围 | 体感 | 典型场景 |
|----------|---------|------|----------|
| **即时** | < 100ms | 感觉不到延迟 | 打字、游戏操作 |
| **近实时** | 100ms ~ 1s | 能感觉到轻微延迟 | 聊天消息、通知推送 |
| **准实时** | 1s ~ 5s | 明显有延迟但可接受 | 股票行情、新闻推送 |
| **非实时** | > 5s | 延迟明显 | 邮件、报表 |

AI-CLI-Mobile 的终端交互属于**即时**级别——用户敲一个键，终端要在 100ms 内响应，否则打字体验会很差。

## 1.2 HTTP 的局限性

要理解为什么需要 WebSocket，首先要理解 HTTP 协议的局限性。

### HTTP 的请求-响应模型

```mermaid
sequenceDiagram
    participant Client as 🌐 浏览器
    participant Server as 🖥️ 服务器

    Client->>Server: 请求 1 (GET /data)
    Server-->>Client: 响应 1

    Note over Client: 连接断开

    Client->>Server: 请求 2 (GET /data)
    Server-->>Client: 响应 2

    Note over Client: 连接断开

    Client->>Server: 请求 3 (GET /data)
    Server-->>Client: 响应 3
```

HTTP 有几个关键特点：

1. **无状态**：每次请求都是独立的，服务器不记住之前的请求
2. **单向**：只能客户端发起请求，服务器不能主动给客户端推送数据
3. **短连接**：请求完成后连接就断了（HTTP/1.1 有 Keep-Alive 但也是有限的）
4. **头部开销大**：每次请求都要发送完整的 HTTP 头（Cookie、User-Agent 等），可能几百字节到几 KB

### HTTP 头部开销示例

```http
GET /api/messages HTTP/1.1
Host: example.com
Connection: keep-alive
Cache-Control: no-cache
User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)
Accept: application/json
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9,en;q=0.8
Cookie: session_id=abc123; user_id=456
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

这些头部加起来可能有 500-1000 字节。如果每 3 秒轮询一次，1000 个用户每秒就要传输 166-333 KB 的**纯头部数据**，而实际有用的数据可能只有几十字节。

### HTTP/2 和 HTTP/3 的改进

| 特性 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|------|----------|--------|--------|
| **多路复用** | ❌ | ✅ | ✅ |
| **头部压缩** | ❌ | ✅ (HPACK) | ✅ (QPACK) |
| **服务器推送** | ❌ | ✅ | ✅ |
| **全双工** | ❌ | ❌ | ❌ |
| **协议** | TCP | TCP | QUIC (UDP) |

> ⚠️ 注意：即使是 HTTP/2 和 HTTP/3，也**不支持真正的全双工通信**。它们的"服务器推送"只是让服务器可以在一个请求的响应中附带额外的资源，不能在任意时间主动给客户端推送数据。

## 1.3 四种实时通信方案

让我们来看看 Web 开发中出现过的四种实时通信方案，从最古老到最现代：

```mermaid
graph LR
    subgraph "演进路线（2000 年 ~ 2010 年）"
        A["🔄 轮询<br/>Polling<br/>~2000"] --> B["⏳ 长轮询<br/>Long Polling<br/>~2006"]
        B --> C["📡 SSE<br/>Server-Sent Events<br/>~2009"]
        C --> D["🔌 WebSocket<br/>全双工通信<br/>~2011"]
    end

    style A fill:#ff6b6b,stroke:#333,color:#fff
    style B fill:#ffa94d,stroke:#333,color:#fff
    style C fill:#69db7c,stroke:#333,color:#fff
    style D fill:#4dabf7,stroke:#333,color:#fff
```

每种方案都是对前一种的改进，解决了一些问题，但也引入了新的限制。

## 1.4 轮询详解

### 工作原理

轮询（Polling）是最简单、最原始的方案。浏览器每隔一段时间就向服务器发一次请求，问"有新数据吗？"

```mermaid
sequenceDiagram
    participant Browser as 🌐 浏览器
    participant Server as 🖥️ 服务器

    Browser->>Server: GET /api/messages?since=0
    Server-->>Browser: []

    Note over Browser: 等待 3 秒...

    Browser->>Server: GET /api/messages?since=0
    Server-->>Browser: []

    Note over Browser: 等待 3 秒...

    Browser->>Server: GET /api/messages?since=0
    Server-->>Browser: [{id:1, text:"你好"}]

    Note over Browser: 等待 3 秒...

    Browser->>Server: GET /api/messages?since=1
    Server-->>Browser: []
```

### 完整代码示例

**客户端：**

```javascript
class PollingClient {
  constructor(url, interval = 3000) {
    this.url = url
    this.interval = interval
    this.lastTimestamp = 0
    this.timer = null
    this.onMessage = null
  }

  start() {
    this.poll() // 立即执行一次
    this.timer = setInterval(() => this.poll(), this.interval)
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  async poll() {
    try {
      const response = await fetch(
        `${this.url}?since=${this.lastTimestamp}`
      )
      const messages = await response.json()

      if (messages.length > 0) {
        this.lastTimestamp = messages[messages.length - 1].timestamp
        if (this.onMessage) {
          messages.forEach(msg => this.onMessage(msg))
        }
      }
    } catch (error) {
      console.error('轮询失败：', error)
    }
  }
}

// 使用
const client = new PollingClient('/api/messages', 3000)
client.onMessage = (msg) => {
  console.log('收到消息：', msg.text)
}
client.start()
```

**服务端（Express）：**

```javascript
app.get('/api/messages', (req, res) => {
  const since = parseInt(req.query.since) || 0

  // 查询时间戳之后的消息
  const messages = db.messages.filter(m => m.timestamp > since)

  res.json(messages)
})
```

### 轮询的资源消耗分析

假设一个聊天应用有 1000 个在线用户，轮询间隔 3 秒：

```
每秒请求数 = 1000 / 3 ≈ 333 请求/秒
每个请求的 HTTP 头 ≈ 500 字节
每秒头部开销 = 333 × 500 = 166,500 字节 ≈ 163 KB/秒
每天头部开销 = 163 × 86400 ≈ 14 GB/天

假设每分钟只有 1 条新消息：
有效数据 = 1000 × 1 × 100 字节 = 100 KB/分钟 ≈ 1.7 KB/秒
带宽利用率 = 1.7 / 163,000 ≈ 0.001%
```

也就是说，**99.999% 的带宽都被浪费在了"没有新数据"的请求和响应上**。

### 轮询的优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 实现极其简单 | ❌ 大量无意义的请求 |
| ✅ 兼容所有浏览器 | ❌ 带宽浪费严重 |
| ✅ 不需要特殊服务端支持 | ❌ 延迟高（最坏情况 = 轮询间隔） |
| ✅ 容易调试 | ❌ 服务器压力大 |
| ✅ 自然穿透防火墙 | ❌ 不适合高频更新场景 |

## 1.5 长轮询详解

### 工作原理

长轮询（Long Polling）是轮询的改进版。浏览器发请求后，服务器**不立刻返回**，而是"挂住"这个请求，直到有新数据或超时才返回。

```mermaid
sequenceDiagram
    participant Browser as 🌐 浏览器
    participant Server as 🖥️ 服务器

    Browser->>Server: GET /api/messages/long-poll
    Note over Server: 没有新数据，挂住请求...
    Note over Server: 等待中...
    Note over Server: 有新消息了！
    Server-->>Browser: [{id:1, text:"你好"}]

    Browser->>Server: GET /api/messages/long-poll（立刻）
    Note over Server: 没有新数据，挂住请求...
    Note over Server: 超时（30 秒）
    Server-->>Browser: []

    Browser->>Server: GET /api/messages/long-poll（立刻）
    Note over Server: 有新消息！
    Server-->>Browser: [{id:2, text:"世界"}]
```

### 完整代码示例

**客户端：**

```javascript
class LongPollingClient {
  constructor(url, timeout = 30000) {
    this.url = url
    this.timeout = timeout
    this.lastTimestamp = 0
    this.isRunning = false
    this.onMessage = null
    this.retryDelay = 1000
  }

  async start() {
    this.isRunning = true
    this.poll()
  }

  stop() {
    this.isRunning = false
  }

  async poll() {
    if (!this.isRunning) return

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.timeout
      )

      const response = await fetch(
        `${this.url}?since=${this.lastTimestamp}`,
        { signal: controller.signal }
      )
      clearTimeout(timeoutId)

      const messages = await response.json()

      if (messages.length > 0) {
        this.lastTimestamp = messages[messages.length - 1].timestamp
        this.retryDelay = 1000 // 重置重试延迟
        if (this.onMessage) {
          messages.forEach(msg => this.onMessage(msg))
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // 超时，正常，继续下一次轮询
      } else {
        console.error('长轮询失败：', error)
        // 等待一段时间再重试
        await new Promise(r => setTimeout(r, this.retryDelay))
        this.retryDelay = Math.min(this.retryDelay * 2, 30000)
      }
    }

    // 继续下一次长轮询
    this.poll()
  }
}
```

**服务端（Express）：**

```javascript
app.get('/api/messages/long-poll', (req, res) => {
  const since = parseInt(req.query.since) || 0
  const timeout = 30000 // 30 秒超时

  // 检查是否已有新消息
  const messages = db.messages.filter(m => m.timestamp > since)
  if (messages.length > 0) {
    return res.json(messages)
  }

  // 没有新消息，挂住请求
  const listener = (newMessage) => {
    if (newMessage.timestamp > since) {
      clearTimeout(timer)
      eventBus.off('new-message', listener)
      res.json([newMessage])
    }
  }

  // 超时后返回空数组
  const timer = setTimeout(() => {
    eventBus.off('new-message', listener)
    res.json([])
  }, timeout)

  eventBus.on('new-message', listener)

  // 客户端断开时清理
  req.on('close', () => {
    clearTimeout(timer)
    eventBus.off('new-message', listener)
  })
})
```

### 长轮询的资源消耗

相比普通轮询，长轮询的效率大幅提升：

```
假设每分钟 1 条消息：
普通轮询：333 请求/秒，大部分返回空
长轮询：~1 请求/分钟（有消息时立即返回）+ 超时重连

实际请求数 ≈ (消息数 + 超时次数) / 分钟
           ≈ (1 + 2) / 分钟  // 30 秒超时，每分钟约 2 次超时
           = 3 请求/分钟
           = 0.05 请求/秒

对比轮询的 333 请求/秒，减少了 99.985%！
```

### 长轮询的优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 比普通轮询更实时 | ❌ 服务器需要维护挂起的连接 |
| ✅ 减少了无意义的请求 | ❌ 每次响应后要重新建立连接 |
| ✅ 兼容性好 | ❌ 仍然是单向的（客户端→服务器） |
| ✅ 实现相对简单 | ❌ 客户端发数据还是要用普通 HTTP |

## 1.6 SSE 详解

### 工作原理

Server-Sent Events（SSE）是 HTML5 引入的标准。它利用 HTTP 的 `Content-Type: text/event-stream`，让服务器可以**持续地**向客户端推送数据。

```mermaid
sequenceDiagram
    participant Browser as 🌐 浏览器
    participant Server as 🖥️ 服务器

    Browser->>Server: GET /api/events
    Note right of Browser: Accept: text/event-stream
    Server-->>Browser: Content-Type: text/event-stream

    Note over Browser,Server: 连接保持打开

    Server-->>Browser: data: {"msg":"你好"}\n\n
    Server-->>Browser: data: {"msg":"世界"}\n\n
    Server-->>Browser: event: status\ndata: {"online":true}\n\n
    Server-->>Browser: id: 123\ndata: {"msg":"带ID的消息"}\n\n

    Note over Browser,Server: 连接一直保持，服务器随时可以推送
```

### SSE 消息格式

```
data: Hello World\n\n                    ← 单行数据

data: Hello\n                            ← 多行数据
data: World\n\n

event: chat\n                            ← 自定义事件类型
data: {"msg":"你好"}\n\n

id: 123\n                                ← 消息 ID（用于断线重连）
event: update\n
data: {"count":42}\n\n

retry: 5000\n                            ← 告诉客户端重连间隔为 5 秒
data: Hello\n\n
```

### 完整代码示例

**客户端：**

```javascript
class SSEClient {
  constructor(url) {
    this.url = url
    this.eventSource = null
    this.onMessage = null
    this.onStatusChange = null
  }

  connect() {
    this.eventSource = new EventSource(this.url)

    // 默认消息（没有 event 字段的消息）
    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (this.onMessage) {
        this.onMessage('message', data)
      }
    }

    // 自定义事件
    this.eventSource.addEventListener('chat', (event) => {
      const data = JSON.parse(event.data)
      if (this.onMessage) {
        this.onMessage('chat', data)
      }
    })

    this.eventSource.addEventListener('status', (event) => {
      const data = JSON.parse(event.data)
      if (this.onStatusChange) {
        this.onStatusChange(data)
      }
    })

    // 连接状态
    this.eventSource.onopen = () => {
      console.log('SSE 连接已建立')
    }

    this.eventSource.onerror = () => {
      console.log('SSE 连接错误，浏览器会自动重连')
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }
}

// 使用
const client = new SSEClient('/api/events')
client.onMessage = (type, data) => {
  console.log(`[${type}]`, data)
}
client.connect()
```

**服务端（Express）：**

```javascript
app.get('/api/events', (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // 禁用 Nginx 缓冲

  // 发送初始数据
  res.write('data: {"connected":true}\n\n')

  // 监听新消息
  const listener = (data) => {
    // 可以指定事件类型
    res.write(`event: chat\ndata: ${JSON.stringify(data)}\n\n`)
  }

  eventBus.on('new-message', listener)

  // 客户端断开时清理
  req.on('close', () => {
    eventBus.off('new-message', listener)
  })
})
```

### SSE 的浏览器兼容性

| 浏览器 | 支持情况 |
|--------|----------|
| Chrome 6+ | ✅ |
| Firefox 6+ | ✅ |
| Safari 5+ | ✅ |
| Edge 79+ | ✅ |
| IE | ❌（需要 polyfill） |
| iOS Safari | ✅（但后台会断开） |

### SSE 的优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 基于 HTTP，不需要特殊协议 | ❌ 只支持服务器→客户端（单向） |
| ✅ 浏览器自动处理重连 | ❌ 只能传文本（不支持二进制） |
| ✅ 支持自定义事件类型 | ❌ 浏览器连接数限制（同域名 6 个） |
| ✅ 支持断线续传（Last-Event-ID） | ❌ 某些代理服务器可能缓冲数据 |
| ✅ 实现简单 | ❌ IE 不支持 |

## 1.7 WebSocket 详解

### 工作原理

WebSocket 是 HTML5 引入的真正**全双工**（Full-Duplex）通信协议。一旦连接建立，客户端和服务器可以**同时**互相发送数据，就像打电话一样。

```mermaid
sequenceDiagram
    participant Browser as 🌐 浏览器
    participant Server as 🖥️ 服务器

    Browser->>Server: HTTP Upgrade 请求
    Server-->>Browser: 101 Switching Protocols

    Note over Browser,Server: WebSocket 连接建立！（全双工）

    Browser->>Server: 消息 1
    Server-->>Browser: 消息 A
    Browser->>Server: 消息 2
    Server-->>Browser: 消息 B
    Server-->>Browser: 消息 C（服务器主动推送）
    Browser->>Server: 消息 3
    Server-->>Browser: 消息 D
    Server-->>Browser: 消息 E
```

注意：与 HTTP 不同，WebSocket 的消息可以在任意时刻、由任意一方发送，不需要等待对方的响应。

### WebSocket 的生命周期

```mermaid
stateDiagram-v2
    [*] --> CONNECTING: new WebSocket(url)
    CONNECTING --> OPEN: 101 Switching Protocols
    CONNECTING --> CLOSED: 连接失败
    OPEN --> CLOSING: close() 被调用
    OPEN --> CLOSED: 连接异常断开
    CLOSING --> CLOSED: 关闭握手完成

    state OPEN {
        [*] --> Idle
        Idle --> Sending: send()
        Sending --> Idle: 发送完成
        Idle --> Receiving: onmessage
        Receiving --> Idle: 处理完成
    }
```

### WebSocket vs HTTP 对比

| 特性 | HTTP | WebSocket |
|------|------|-----------|
| **通信模式** | 请求-响应 | 全双工 |
| **连接** | 短连接（每次请求） | 长连接（一直保持） |
| **方向** | 客户端→服务器 | 双向 |
| **头部开销** | 每次请求都有 | 只在握手时有 |
| **数据格式** | 文本（HTTP） | 文本 + 二进制 |
| **协议** | http:// / https:// | ws:// / wss:// |
| **状态** | 无状态 | 有状态（连接状态） |
| **代理/缓存** | 完全支持 | 部分支持 |
| **防火墙** | 通常允许 | 可能被阻止 |

## 1.8 四种方案对比表

| 特性 | 轮询 | 长轮询 | SSE | WebSocket |
|------|------|--------|-----|-----------|
| **通信方向** | 客户端→服务器 | 客户端→服务器 | 服务器→客户端 | **双向** |
| **实时性** | 差（取决于间隔） | 较好 | 好 | **极好** |
| **协议** | HTTP | HTTP | HTTP | **WS/WSS** |
| **连接复用** | 否（每次新建） | 否（每次新建） | 是（长连接） | **是（长连接）** |
| **二进制支持** | 否 | 否 | 否 | **是** |
| **服务器开销** | 高 | 中 | 低 | **最低** |
| **浏览器兼容** | 所有 | 所有 | 现代浏览器 | **现代浏览器** |
| **实现复杂度** | 简单 | 中等 | 简单 | **中等** |
| **头部开销** | 每次请求 | 每次请求 | 仅首次 | **仅握手** |
| **自动重连** | 手动实现 | 手动实现 | 浏览器内置 | **手动实现** |
| **断线续传** | 靠时间戳 | 靠时间戳 | Last-Event-ID | **需要手动实现** |
| **适用场景** | 低频更新 | 中频更新 | 服务器推送 | **实时交互** |
| **典型应用** | 邮件检查 | 通知系统 | 新闻推送 | **聊天/游戏/终端** |

```mermaid
graph TD
    subgraph "选择指南"
        A{"需要双向通信？"} -->|是| D["✅ WebSocket"]
        A -->|否| B{"更新频率？"}
        B -->|"每秒多次"| D
        B -->|"每分钟几次"| C["✅ SSE"]
        B -->|"每小时几次"| E["✅ 轮询"]
        B -->|"需要低延迟推送"| F["✅ 长轮询"]
    end

    subgraph "特殊考虑"
        G{"需要二进制数据？"} -->|是| D
        H{"需要 IE 支持？"} -->|是| E
        I{"只需服务器推送？"} -->|是| C
    end

    style D fill:#4dabf7,stroke:#333,color:#fff
    style C fill:#69db7c,stroke:#333,color:#fff
    style E fill:#ffa94d,stroke:#333,color:#fff
    style F fill:#ffa94d,stroke:#333,color:#fff
```

## 1.9 WebSocket 的优势与适用场景

### 为什么 AI-CLI-Mobile 选择 WebSocket？

AI-CLI-Mobile 是一个在手机浏览器里运行终端的应用。终端交互有以下特点：

1. **高频双向通信**：你敲一个键，要立刻发送到服务器；服务器的终端输出，要立刻显示在手机上
2. **二进制数据**：终端数据是二进制的（不是纯文本），SSE 不支持二进制
3. **低延迟要求**：打字时如果延迟超过 100ms，体验就会明显变差
4. **长连接**：一个终端会话可能持续几分钟到几小时
5. **双向控制**：不仅有终端数据流，还有控制命令（调整窗口大小、执行快捷操作等）

```mermaid
graph TD
    subgraph "AI-CLI-Mobile 通信需求"
        A["用户敲键"] -->|"需要 <50ms 延迟"| B["WebSocket ✅"]
        C["终端输出"] -->|"二进制数据流"| B
        D["控制命令"] -->|"双向实时"| B
        E["心跳保活"] -->|"长连接"| B
        F["代码注入"] -->|"大消息"| B
    end

    subgraph "被淘汰的方案"
        G["轮询 ❌ 延迟太高"]
        H["长轮询 ❌ 不支持二进制"]
        I["SSE ❌ 单向通信"]
    end

    style B fill:#4dabf7,stroke:#333,color:#fff
    style G fill:#ff6b6b,stroke:#333,color:#fff
    style H fill:#ff6b6b,stroke:#333,color:#fff
    style I fill:#ff6b6b,stroke:#333,color:#fff
```

### WebSocket 的典型应用场景

| 场景 | 为什么用 WebSocket | 例子 |
|------|-------------------|------|
| **即时通讯** | 消息需要毫秒级送达 | 微信网页版、Slack、Discord |
| **在线游戏** | 玩家操作需要实时同步 | 多人在线游戏、棋牌游戏 |
| **协同编辑** | 多人同时编辑一个文档 | Google Docs、飞书文档、Notion |
| **实时监控** | 数据每秒更新 | Grafana、Prometheus、服务器监控 |
| **金融行情** | 股票价格实时变化 | 股票交易软件、加密货币交易所 |
| **终端模拟** | 键盘输入和终端输出需要实时双向 | **AI-CLI-Mobile**、VS Code Terminal |
| **在线教育** | 实时互动 | 直播课堂、在线白板 |
| **物联网** | 设备数据持续上报 | 智能家居、工业监控 |

---

# 第二章：WebSocket 协议详解

## 2.1 握手过程（HTTP Upgrade）

WebSocket 连接不是凭空建立的，它**基于 HTTP**。连接建立的过程叫做"握手"（Handshake），使用 HTTP 的 `Upgrade` 机制。

这就像两个人先通过写信（HTTP）互相确认"我们要开始打电话了"，然后才切换到电话（WebSocket）。

```mermaid
sequenceDiagram
    participant Client as 🌐 客户端
    participant Server as 🖥️ 服务器

    Note over Client,Server: 第一阶段：HTTP 握手

    Client->>Server: HTTP GET /chat
    Note right of Client: GET /chat HTTP/1.1<br/>Host: example.com<br/>Upgrade: websocket<br/>Connection: Upgrade<br/>Sec-WebSocket-Key: dGhlIHNhbXBsZQ==<br/>Sec-WebSocket-Version: 13<br/>Origin: http://example.com

    Server-->>Client: HTTP/1.1 101 Switching Protocols
    Note left of Server: Upgrade: websocket<br/>Connection: Upgrade<br/>Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=

    Note over Client,Server: 第二阶段：WebSocket 通信（协议已切换）

    Client->>Server: WebSocket 帧
    Server-->>Client: WebSocket 帧
    Client->>Server: WebSocket 帧
    Server-->>Client: WebSocket 帧
```

### 握手请求详解

客户端发送的 HTTP 请求：

```http
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Origin: http://example.com
Sec-WebSocket-Protocol: chat, superchat
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits
```

关键字段解释：

| 字段 | 含义 | 必须？ | 说明 |
|------|------|--------|------|
| `Upgrade: websocket` | 请求协议升级 | ✅ | 告诉服务器"我想切换到 WebSocket" |
| `Connection: Upgrade` | 连接升级 | ✅ | 告诉服务器"这个连接需要升级" |
| `Sec-WebSocket-Key` | 客户端随机密钥 | ✅ | Base64 编码的 16 字节随机值 |
| `Sec-WebSocket-Version: 13` | 协议版本 | ✅ | 目前只有 13 这一个版本 |
| `Origin` | 请求来源 | 可选 | 用于安全检查（防 CSRF） |
| `Sec-WebSocket-Protocol` | 子协议 | 可选 | 客户端支持的子协议列表 |
| `Sec-WebSocket-Extensions` | 扩展 | 可选 | 客户端支持的扩展（如压缩） |

### 握手响应详解

服务器返回：

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
Sec-WebSocket-Protocol: chat
Sec-WebSocket-Extensions: permessage-deflate
```

| 字段 | 含义 | 说明 |
|------|------|------|
| `101 Switching Protocols` | 同意协议切换 | HTTP 状态码 |
| `Sec-WebSocket-Accept` | 确认密钥 | 根据客户端 Key 计算 |
| `Sec-WebSocket-Protocol` | 选定的子协议 | 从客户端列表中选择一个 |
| `Sec-WebSocket-Extensions` | 启用的扩展 | 如压缩 |

### Sec-WebSocket-Key 的计算

`Sec-WebSocket-Accept` 的计算方式：

```
1. 取客户端的 Sec-WebSocket-Key
2. 拼接固定的 GUID：258EAFA5-E914-47DA-95CA-5AB5DC11E5B5
3. 对拼接结果做 SHA-1 哈希
4. 对哈希结果做 Base64 编码
```

```javascript
// 完整的握手实现示例
const crypto = require('crypto')

const WS_GUID = '258EAFA5-E914-47DA-95CA-5AB5DC11E5B5'

function computeAcceptKey(clientKey) {
  return crypto
    .createHash('sha1')
    .update(clientKey + WS_GUID)
    .digest('base64')
}

// 示例
const clientKey = 'dGhlIHNhbXBsZSBub25jZQ=='
const acceptKey = computeAcceptKey(clientKey)
console.log(acceptKey) // s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

> 💡 **为什么需要这个计算？** 这不是真正的安全措施（不是加密），而是为了防止：
> - 普通 HTTP 代理服务器误把 WebSocket 握手当作普通 HTTP 请求
> - 缓存服务器缓存 WebSocket 连接
> - 确保服务器真的理解 WebSocket 协议

### 为什么用 HTTP 升级而不是全新协议？

WebSocket 选择基于 HTTP 升级而不是设计一个全新的协议，有以下原因：

1. **穿透性**：几乎所有网络基础设施（代理、防火墙、负载均衡器）都支持 HTTP
2. **兼容性**：可以复用 HTTP 的端口（80/443），不需要开放新端口
3. **简单性**：利用已有的 HTTP 连接，不需要额外的连接建立过程
4. **安全性**：可以复用 HTTPS 的 TLS 加密

### 在 AI-CLI-Mobile 中的握手

在 AI-CLI-Mobile 项目中，握手通过 `@fastify/websocket` 插件自动处理。但项目在握手阶段增加了一个**认证检查**：

```typescript
// apps/server/src/routes/terminal.ts
export async function terminalRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/terminal', {
    websocket: true,
  }, (socket, request) => {
    // 在握手阶段验证 JWT token
    if (!verifyWsUpgradeToken(request, socket, 'Terminal')) return
    // 认证通过，交给 WSGateway 处理
    fastify.wsGateway.handleTerminalConnection(socket)
  })
}
```

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
    ws.close(4001, 'Missing token')
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

```mermaid
sequenceDiagram
    participant Client as 🌐 手机浏览器
    participant Server as 🖥️ Fastify 服务器
    participant Auth as 🔐 认证模块

    Client->>Server: GET /ws/terminal?token=xxx
    Note right of Client: Upgrade: websocket

    Server->>Auth: 验证 JWT token
    alt Token 有效
        Auth-->>Server: ✅ 解码后的用户信息
        Server-->>Client: 101 Switching Protocols
        Note over Client,Server: WebSocket 连接建立
    else Token 无效
        Auth-->>Server: ❌ 验证失败
        Server-->>Client: 关闭连接 (4001)
    end
```

## 2.2 帧格式（Frame Format）

WebSocket 通信的基本单位是**帧**（Frame）。每个消息由一个或多个帧组成。

### 帧的结构图

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |            (16/64)            |
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
|                     Payload Data (continued)                  |
+---------------------------------------------------------------+
```

### 各字段详解

| 字段 | 位数 | 含义 | 详细说明 |
|------|------|------|----------|
| **FIN** | 1 bit | 是否是消息的最后一帧 | 1=最后一帧，0=还有后续帧（分片） |
| **RSV1-3** | 3 bits | 保留位 | 通常为 0。RSV1 用于压缩扩展 |
| **Opcode** | 4 bits | 帧类型 | 见下表 |
| **MASK** | 1 bit | 数据是否被掩码 | 客户端→服务器**必须**为 1 |
| **Payload length** | 7 bits | 负载长度 | 0-125 直接表示；126=后续 2 字节；127=后续 8 字节 |
| **Extended length** | 16/64 bits | 扩展长度 | 仅当 Payload length 为 126 或 127 时存在 |
| **Masking key** | 32 bits | 掩码密钥 | 仅当 MASK=1 时存在 |
| **Payload data** | 变长 | 实际数据 | 长度由 Payload length 字段决定 |

### Opcode 类型详解

| Opcode | 十六进制 | 含义 | 帧类型 | 说明 |
|--------|---------|------|--------|------|
| 0 | 0x0 | Continuation | 数据帧 | 分片消息的后续帧 |
| 1 | 0x1 | **Text** | 数据帧 | 文本帧（UTF-8 编码） |
| 2 | 0x2 | **Binary** | 数据帧 | 二进制帧 |
| 3 | 0x3 | Reserved | 数据帧 | 保留 |
| 4 | 0x4 | Reserved | 数据帧 | 保留 |
| 5 | 0x5 | Reserved | 数据帧 | 保留 |
| 6 | 0x6 | Reserved | 数据帧 | 保留 |
| 7 | 0x7 | Reserved | 数据帧 | 保留 |
| 8 | 0x8 | **Close** | 控制帧 | 关闭连接 |
| 9 | 0x9 | **Ping** | 控制帧 | Ping 请求 |
| 10 | 0xA | **Pong** | 控制帧 | Pong 响应 |
| 11 | 0xB | Reserved | 控制帧 | 保留 |
| 12 | 0xC | Reserved | 控制帧 | 保留 |
| 13 | 0xD | Reserved | 控制帧 | 保留 |
| 14 | 0xE | Reserved | 控制帧 | 保留 |
| 15 | 0xF | Reserved | 控制帧 | 保留 |

### 帧格式可视化

```mermaid
graph TD
    subgraph "WebSocket 帧结构"
        A["FIN (1 bit)<br/>是否最后一帧"] --> B["RSV1-3 (3 bits)<br/>保留位"]
        B --> C["Opcode (4 bits)<br/>帧类型"]
        C --> D["MASK (1 bit)<br/>是否掩码"]
        D --> E["Payload Length (7 bits)<br/>负载长度"]
        E --> F{"长度值？"}
        F -->|"0-125"| G["直接表示长度"]
        F -->|"126"| H["后续 2 字节表示长度<br/>（最大 65535）"]
        F -->|"127"| I["后续 8 字节表示长度<br/>（最大 2^63）"]
        G --> J{"MASK = 1?"}
        H --> J
        I --> J
        J -->|是| K["Masking Key (4 bytes)"]
        J -->|否| L["无 Masking Key"]
        K --> M["Payload Data"]
        L --> M
    end

    style A fill:#4dabf7,stroke:#333,color:#fff
    style C fill:#ff6b6b,stroke:#333,color:#fff
    style D fill:#ffa94d,stroke:#333,color:#fff
    style M fill:#69db7c,stroke:#333,color:#fff
```

### 帧的实际编码示例

让我们看一个具体的例子：客户端发送文本 "Hello"

```
"Hello" 的字节：48 65 6C 6C 6F（5 字节）

帧编码：
- FIN = 1（最后一帧）
- RSV = 000
- Opcode = 0001（文本帧）
- MASK = 1（客户端发送必须掩码）
- Payload length = 0000101（5）
- Masking key = 随机 4 字节，例如 37 FA 21 3D

掩码计算：
  H: 48 XOR 37 = 7F
  e: 65 XOR FA = 9F
  l: 6C XOR 21 = 4D
  l: 6C XOR 3D = 51
  o: 6F XOR 37 = 58

最终帧（十六进制）：
  81 85 37 FA 21 3D 7F 9F 4D 51 58

解释：
  81 = 10000001 = FIN(1) RSV(000) Opcode(0001)
  85 = 10000101 = MASK(1) Payload len(0000101 = 5)
  37 FA 21 3D = Masking key
  7F 9F 4D 51 58 = 掩码后的 payload
```

## 2.3 文本帧 vs 二进制帧

### 文本帧（Opcode 0x1）

文本帧传输的是 **UTF-8 编码的字符串**。

```javascript
// 发送文本帧
ws.send('Hello, World!')
ws.send(JSON.stringify({ type: 'CHAT', message: '你好' }))

// 接收文本帧
ws.onmessage = (event) => {
  if (typeof event.data === 'string') {
    console.log('收到文本：', event.data)
    try {
      const json = JSON.parse(event.data)
      console.log('解析后的 JSON：', json)
    } catch {
      console.log('不是 JSON，是纯文本')
    }
  }
}
```

**文本帧的特点：**
- 数据必须是有效的 UTF-8 编码
- 适合传输 JSON、XML、HTML、纯文本
- 浏览器 DevTools 可以直接显示内容
- 如果数据不是有效的 UTF-8，连接会被关闭（状态码 1007）

### 二进制帧（Opcode 0x2）

二进制帧传输的是**原始字节**。

```javascript
// 发送二进制帧
const buffer = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F])
ws.send(buffer)

// 也可以发送 ArrayBuffer
const ab = new ArrayBuffer(5)
const view = new Uint8Array(ab)
view.set([0x48, 0x65, 0x6C, 0x6C, 0x6F])
ws.send(ab)

// 也可以发送 Blob
const blob = new Blob([buffer], { type: 'application/octet-stream' })
ws.send(blob)

// 接收二进制帧
ws.binaryType = 'arraybuffer'  // 重要！默认是 'blob'
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    const bytes = new Uint8Array(event.data)
    console.log('收到二进制：', bytes)
    console.log('第一个字节：', bytes[0]) // 0x48 = 'H'
  }
}
```

**二进制帧的特点：**
- 数据是原始字节，没有编码限制
- 适合传输图片、音频、视频、终端数据、协议缓冲区
- 不需要 UTF-8 验证
- 在 DevTools 中显示为十六进制

### 文本 vs 二进制对比表

| 特性 | 文本帧 | 二进制帧 |
|------|--------|----------|
| **Opcode** | 0x1 | 0x2 |
| **编码** | 必须 UTF-8 | 原始字节 |
| **适合数据** | JSON、XML、纯文本 | 图片、音频、终端数据 |
| **大小开销** | UTF-8 编码（中文 3 字节/字） | 无额外编码开销 |
| **解析** | 直接作为字符串 | 需要按协议解析字节 |
| **调试** | 容易（人类可读） | 困难（需要十六进制查看） |
| **TypeScript** | string | ArrayBuffer / Uint8Array / Blob |

### 如何选择？

```mermaid
graph TD
    A{"数据类型？"} -->|"JSON / XML / 纯文本"| B["✅ 文本帧"]
    A -->|"图片 / 音频 / 视频"| C["✅ 二进制帧"]
    A -->|"终端数据 / 键盘输入"| C
    A -->|"协议缓冲区"| C
    A -->|"结构化数据"| D{"需要高性能？"}
    D -->|是| E["✅ 二进制帧<br/>（用 Protocol Buffers）"]
    D -->|否| B
```

### AI-CLI-Mobile 中的帧类型选择

```mermaid
graph LR
    subgraph "Terminal Channel（终端通道）"
        A["键盘输入"] -->|"二进制帧"| B["服务器 PTY"]
        B -->|"二进制帧"| C["终端输出"]
        PING["心跳 (0x00)"] -->|"二进制帧"| PONG["心跳 (0x01)"]
    end

    subgraph "Control Channel（控制通道）"
        D["AUTH 命令"] -->|"文本帧 (JSON)"| E["服务器控制"]
        E -->|"文本帧 (JSON)"| F["状态更新"]
        CTRL_PING["PING"] -->|"文本帧"| CTRL_PONG["PONG"]
    end

    style A fill:#4dabf7,stroke:#333,color:#fff
    style C fill:#4dabf7,stroke:#333,color:#fff
    style D fill:#69db7c,stroke:#333,color:#fff
    style F fill:#69db7c,stroke:#333,color:#fff
```

## 2.4 关闭帧与状态码

### 关闭帧结构

关闭帧（Opcode 0x8）包含一个 2 字节的状态码和可选的关闭原因：

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-----------------------------------------------+
|     |         |                                               |
|FIN=1|  0x8    |         Status Code (2 bytes)                 |
|     |         |                                               |
+-+-+-+-+-+-+-+-+-----------------------------------------------+
|                    Close Reason (UTF-8)                       |
|                              ...                              |
+---------------------------------------------------------------+
```

### 标准状态码

| 状态码 | 常量名 | 含义 | 详细说明 |
|--------|--------|------|----------|
| **1000** | Normal Closure | 正常关闭 | 连接正常完成，这是最常见的关闭码 |
| **1001** | Going Away | 正在离开 | 服务器关闭或浏览器导航离开页面 |
| **1002** | Protocol Error | 协议错误 | 收到了协议不允许的帧 |
| **1003** | Unsupported Data | 不支持的数据 | 收到了不能处理的数据类型（如收到了二进制但只支持文本） |
| **1004** | Reserved | 保留 | 保留，不能使用 |
| **1005** | No Status Received | 没有收到状态 | 保留值，表示没有收到关闭帧 |
| **1006** | Abnormal Closure | 异常关闭 | 保留值，表示连接异常断开（没有关闭帧） |
| **1007** | Invalid Frame Payload | 无效的帧负载 | 消息中的数据与类型不一致（如文本帧包含非 UTF-8 数据） |
| **1008** | Policy Violation | 策略违规 | 通用的策略违反（不想透露具体原因时使用） |
| **1009** | Message Too Big | 消息过大 | 消息超过了服务器能处理的大小 |
| **1010** | Mandatory Extension | 缺少必需扩展 | 客户端期望服务器协商一个扩展，但服务器没有 |
| **1011** | Internal Error | 内部错误 | 服务器遇到了意外错误 |
| **1015** | TLS Handshake | TLS 握手失败 | 保留值，表示 TLS 握手失败 |

### 私有状态码（4000-4999）

WebSocket 协议允许应用定义 4000-4999 范围内的私有状态码。

```typescript
// packages/shared/src/protocol.ts
export const WS_CLOSE_CODE = {
  AUTH_FAILED: 4001,        // 认证失败
  PROTOCOL_MISMATCH: 4002,  // 协议版本不匹配
} as const
```

### 关闭握手流程

```mermaid
sequenceDiagram
    participant Client as 🌐 客户端
    participant Server as 🖥️ 服务器

    Note over Client: 想关闭连接
    Client->>Server: Close 帧 (1000, "正常关闭")
    Note over Server: 收到关闭帧
    Server-->>Client: Close 帧 (1000, "确认")
    Note over Client,Server: TCP 连接断开
```

**异常关闭：**

```mermaid
sequenceDiagram
    participant Client as 🌐 客户端
    participant Server as 🖥️ 服务器

    Note over Client: 想关闭连接
    Client->>Server: Close 帧 (1000)
    Note over Server: 服务器还在处理...
    Note over Client: 等不及了...
    Client-xServer: TCP 连接断开（RST）
    Note over Server: 收到 RST，连接异常关闭
```

### 关闭代码示例

```javascript
// 客户端主动关闭
ws.close()           // 默认 1000
ws.close(1000)       // 正常关闭
ws.close(1000, '用户主动断开')  // 带原因

// 监听关闭事件
ws.onclose = (event) => {
  console.log('状态码：', event.code)     // 1000
  console.log('原因：', event.reason)      // "用户主动断开"
  console.log('是否干净关闭：', event.wasClean) // true

  // 根据状态码决定后续行为
  switch (event.code) {
    case 1000:
      console.log('正常关闭')
      break
    case 1001:
      console.log('服务器关闭或页面导航')
      break
    case 4001:
      console.log('认证失败，需要重新登录')
      break
    case 4002:
      console.log('协议版本不匹配，需要刷新页面')
      window.location.reload()
      break
    default:
      console.log('异常关闭，尝试重连...')
      scheduleReconnect()
  }
}
```

### AI-CLI-Mobile 的关闭处理

```typescript
// apps/web/src/hooks/useDualChannelWS.ts
termWs.onclose = (event) => {
  // 清理心跳定时器
  if (termPingRef.current) {
    clearInterval(termPingRef.current)
    termPingRef.current = null
  }

  // 协议版本不匹配 → 强制刷新页面
  if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) {
    window.location.reload()
    return
  }

  // 认证失败 → 尝试刷新 token
  if (event.code === WS_CLOSE_CODE.AUTH_FAILED) {
    handleAuthFailureAndRetry()
    return
  }

  // 其他异常 → 尝试重连
  if (store.getState().isConnected) {
    reconnectTermOnly()  // 只重连 Terminal
  } else {
    scheduleReconnect()  // 重连两个通道
  }
}
```

## 2.5 Ping/Pong 心跳

### 工作原理

WebSocket 协议内置了 **Ping/Pong 机制**用于检测连接是否存活。

```mermaid
sequenceDiagram
    participant Client as 🌐 客户端
    participant Server as 🖥️ 服务器

    Note over Client,Server: 正常通信中...

    Server-->>Client: Ping 帧 (opcode 0x9)
    Client-->>Server: Pong 帧 (opcode 0xA) ← 自动回复

    Note over Client,Server: 30 秒后...

    Client->>Server: Ping 帧 (如果 API 允许)
    Server-->>Client: Pong 帧

    Note over Client,Server: 又 30 秒后...

    Server-->>Client: Ping 帧
    Note over Client: 没收到 Pong...
    Note over Client: 连接可能断了！
```

### 协议级 Ping/Pong vs 应用级心跳

| 特性 | 协议级 Ping/Pong | 应用级心跳 |
|------|------------------|------------|
| **实现层** | WebSocket 协议层 | 应用层 |
| **帧类型** | Opcode 0x9 / 0xA | 普通数据帧（0x1 或 0x2） |
| **可见性** | 对应用透明 | 应用代码处理 |
| **浏览器支持** | ⚠️ 不暴露 Ping API | ✅ 完全可控 |
| **灵活性** | 低（只能发空帧） | 高（可以携带数据） |
| **开销** | 极小（2 字节帧头） | 取决于消息格式 |
| **检测能力** | 连接是否存活 | 连接是否存活 + 服务器是否响应 |

> ⚠️ **重要**：浏览器的 WebSocket API **不允许**发送协议级 Ping 帧！Ping 只能由服务器发起，浏览器会自动回复 Pong。

### AI-CLI-Mobile 的心跳实现

项目使用**应用级心跳**，两个通道用不同格式：

**Terminal Channel（二进制心跳）：**

```typescript
// packages/shared/src/protocol.ts
export const TERM_PING = 0x00  // Ping 字节
export const TERM_PONG = 0x01  // Pong 字节

// 客户端：每 30 秒发送一次 Ping
const PING_INTERVAL = 30_000

function startTermPing() {
  termPingRef.current = setInterval(() => {
    const ws = termWsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(new Uint8Array([TERM_PING]))  // 发送 0x00
    }
  }, PING_INTERVAL)
}

// 服务端：收到 Ping 后回复 Pong
ws.on('message', (data: Buffer) => {
  if (data.length === 1 && data[0] === TERM_PING) {
    ws.send(Buffer.from([TERM_PONG]))  // 回复 0x01
    return
  }
  // 否则是键盘输入
  this.sessionManager.sendInput(sessionId!, data)
})

// 服务端也会主动发送 Pong 作为保活探测
private setupTerminalKeepAlive(ws: WebSocket): void {
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(Buffer.from([TERM_PONG]))  // 发送 0x01
    }
  }, PING_INTERVAL_MS)
  this.pingTimers.set(ws, timer)
}
```

**Control Channel（JSON 心跳）：**

```typescript
// 客户端：每 30 秒发送一次 PING
function startCtrlPing() {
  ctrlPingRef.current = setInterval(() => {
    const ws = ctrlWsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg: ControlClientMessage = { type: 'PING' }
      ws.send(JSON.stringify(msg))  // {"type":"PING"}
    }
  }, PING_INTERVAL)
}

// 服务端：收到 PING 后回复 PONG
case 'PING':
  ws.send(JSON.stringify({ type: 'PONG' }))
  break

// 服务端也会主动发送 PING
private setupControlKeepAlive(ws: WebSocket): void {
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PING' }))
    }
  }, PING_INTERVAL_MS)
  this.pingTimers.set(ws, timer)
}
```

### 为什么 Terminal Channel 用二进制心跳？

| 方案 | 大小 | 解析 | 说明 |
|------|------|------|------|
| 二进制 (0x00) | **1 字节** | 检查 1 个字节 | ✅ 最优 |
| JSON (`{"type":"PING"}`) | 14 字节 | JSON.parse | ❌ 太大 |
| 空字符串 | 0 字节 | 无法区分 | ❌ 无法使用 |

Terminal Channel 使用二进制心跳因为：
1. **更小**：1 字节 vs 14 字节
2. **更快解析**：检查 1 个字节 vs JSON.parse
3. **不干扰数据流**：终端数据是二进制的，心跳也是二进制的

## 2.6 消息分片（Fragmentation）

### 什么是分片？

一个 WebSocket 消息可以被分成多个帧发送，这叫做**分片**（Fragmentation）。

```mermaid
sequenceDiagram
    participant Sender as 📤 发送方
    participant Receiver as 📥 接收方

    Note over Sender: 发送大消息 "Hello, World!"

    Sender->>Receiver: 帧 1: FIN=0, Opcode=1, "Hello, "
    Note right of Receiver: 收集中...

    Sender->>Receiver: 帧 2: FIN=0, Opcode=0, "World"
    Note right of Receiver: 收集中...

    Sender->>Receiver: 帧 3: FIN=1, Opcode=0, "!"
    Note right of Receiver: 消息完整！<br/>"Hello, World!"
```

### 分片帧的规则

1. **第一帧**：Opcode 为消息类型（0x1 或 0x2），FIN=0
2. **后续帧**：Opcode 为 0x0（Continuation），FIN=0
3. **最后一帧**：Opcode 为 0x0，FIN=1
4. **控制帧可以插入**：Ping/Pong/Close 可以在分片中间发送

```mermaid
sequenceDiagram
    participant A as 🌐 客户端
    participant B as 🖥️ 服务器

    Note over A: 发送大消息（分片）

    A->>B: 帧1: FIN=0, Opcode=Text, "第一部分"
    A->>B: 帧2: FIN=0, Opcode=Cont, "第二部分"

    Note over B: 插入一个 Ping
    B-->>A: Ping 帧
    A-->>B: Pong 帧

    A->>B: 帧3: FIN=1, Opcode=Cont, "第三部分"

    Note over B: 消息完整！
```

### 什么时候需要分片？

1. **大消息**：消息太大，不想占用太多内存
2. **流式数据**：数据是逐步生成的，不想等全部生成完再发送
3. **互操作性**：需要在分片中间插入控制帧（如 Ping）

### 在 AI-CLI-Mobile 中

AI-CLI-Mobile **不使用分片**，因为：
- 终端数据是逐字符产生的，每帧就是一个完整的输入/输出
- 控制消息是 JSON，通常很小（几百字节），不需要分片
- 简化了客户端和服务端的实现

## 2.7 掩码（Masking）

### 什么是掩码？

掩码是 WebSocket 协议的一个安全机制。客户端发送给服务器的数据**必须**被掩码处理。

### 掩码的计算

```
masked_byte[i] = original_byte[i] XOR masking_key[i % 4]
```

```javascript
// 掩码函数
function maskPayload(payload, maskingKey) {
  const masked = Buffer.alloc(payload.length)
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ maskingKey[i % 4]
  }
  return masked
}

// 解掩码（同样的操作）
function unmaskPayload(masked, maskingKey) {
  return maskPayload(masked, maskingKey) // XOR 是对称的
}
```

### 为什么需要掩码？

掩码**不是加密**！它的目的是防止**缓存投毒**（Cache Poisoning）攻击。

**攻击场景：**
1. 攻击者控制一个恶意网站
2. 受害者访问恶意网站
3. 恶意网站通过受害者的浏览器向银行服务器发送 WebSocket 消息
4. 如果消息没有掩码，攻击者可以精心构造消息，使其看起来像一个普通的 HTTP 响应
5. 中间的代理服务器可能把这个"响应"缓存下来
6. 以后其他用户访问银行时，会看到被缓存的恶意内容

掩码通过让消息内容不可预测（因为掩码密钥是随机的），防止了这种攻击。

### 谁需要掩码？

| 方向 | 是否需要掩码 | 说明 |
|------|-------------|------|
| 客户端→服务器 | ✅ **必须** | 防止缓存投毒 |
| 服务器→客户端 | ❌ 不需要 | 服务器是可信的 |

### AI-CLI-Mobile 中的掩码

AI-CLI-Mobile 使用 `ws` 库和浏览器的 WebSocket API，掩码处理是**自动的**，不需要手动实现：

- 浏览器发送数据时，自动添加掩码
- `ws` 库收到客户端消息时，自动去除掩码
- `ws` 库发送数据给客户端时，不添加掩码（服务器→客户端不需要）

---

# 第三章：浏览器端 WebSocket API

## 3.1 WebSocket 对象创建

### 基本语法

```javascript
const ws = new WebSocket(url)
const ws = new WebSocket(url, protocols)
const ws = new WebSocket(url, ['chat', 'superchat'])
```

### URL 协议

| 协议 | 含义 | 默认端口 | 加密 | 用途 |
|------|------|----------|------|------|
| `ws://` | 普通 WebSocket | 80 | ❌ | 开发环境 |
| `wss://` | 加密 WebSocket | 443 | ✅ | **生产环境必须** |

### 创建后的状态

```javascript
const ws = new WebSocket('wss://example.com/ws')
console.log(ws.readyState)  // 0 = CONNECTING

ws.onopen = () => {
  console.log(ws.readyState)  // 1 = OPEN
}

ws.onclose = () => {
  console.log(ws.readyState)  // 3 = CLOSED
}
```

### AI-CLI-Mobile 中的 URL 构建

```typescript
// apps/web/src/hooks/useDualChannelWS.ts
const WS_BASE = import.meta.env.VITE_WS_URL
  || `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`

// 安全检查
if (import.meta.env.PROD && window.location.protocol === 'http:') {
  console.warn(
    '[安全警告] 当前页面使用 HTTP 协议，WebSocket 将以明文 ws:// 传输。' +
    '生产环境应始终使用 HTTPS 以确保 WebSocket 加密传输(wss://)。'
  )
}

// 创建两个连接
const termWs = new WebSocket(`${WS_BASE}/ws/terminal`)
const ctrlWs = new WebSocket(`${WS_BASE}/ws/control`)
```

### URL 构建逻辑详解

```mermaid
graph TD
    A{"VITE_WS_URL<br/>环境变量？"} -->|有值| B["使用环境变量"]
    A -->|没有| C{"当前页面协议？"}
    C -->|"https:"| D["wss://当前域名"]
    C -->|"http:"| E["ws://当前域名"]

    F{"生产环境<br/>且 http://？"} -->|是| G["⚠️ 打印安全警告"]
    F -->|否| H["正常继续"]

    style D fill:#69db7c,stroke:#333,color:#fff
    style E fill:#ffa94d,stroke:#333,color:#fff
    style G fill:#ff6b6b,stroke:#333,color:#fff
```

## 3.2 事件详解

WebSocket 对象有 4 个事件：

```mermaid
graph TD
    subgraph "WebSocket 生命周期"
        A["new WebSocket(url)"] --> B["readyState = CONNECTING (0)"]
        B --> C["onopen 事件"]
        C --> D["readyState = OPEN (1)"]
        D --> E["onmessage 事件"]
        D --> F["onerror 事件"]
        D --> G["onclose 事件"]
        G --> H["readyState = CLOSED (3)"]
        F --> G
        D --> I["ws.close()"]
        I --> J["readyState = CLOSING (2)"]
        J --> G
    end

    style B fill:#ffa94d,stroke:#333,color:#fff
    style D fill:#69db7c,stroke:#333,color:#fff
    style H fill:#ff6b6b,stroke:#333,color:#fff
```

### readyState 属性

| 值 | 常量 | 含义 | 说明 |
|----|------|------|------|
| 0 | `WebSocket.CONNECTING` | 正在连接 | 握手进行中 |
| 1 | `WebSocket.OPEN` | 连接已打开 | 可以发送/接收数据 |
| 2 | `WebSocket.CLOSING` | 正在关闭 | 关闭握手进行中 |
| 3 | `WebSocket.CLOSED` | 已关闭 | 连接已关闭或打开失败 |

### onopen 事件

连接建立成功时触发。

```javascript
ws.onopen = (event) => {
  console.log('WebSocket 连接已建立！')
  console.log('连接 URL：', ws.url)
  console.log('协议：', ws.protocol)        // 子协议
  console.log('扩展：', ws.extensions)      // 协商的扩展
  console.log('缓冲的字节数：', ws.bufferedAmount) // 0

  // 连接建立后，可以开始发送数据
  ws.send('Hello Server!')

  // 发送认证消息
  ws.send(JSON.stringify({
    type: 'AUTH',
    accessToken: getToken(),
    protocolVersion: '0.1.0'
  }))
}
```

### onmessage 事件

收到消息时触发。

```javascript
ws.onmessage = (event) => {
  // event.data 的类型取决于：
  // 1. 消息是文本还是二进制
  // 2. ws.binaryType 的设置

  if (typeof event.data === 'string') {
    // 文本消息
    console.log('收到文本：', event.data)

    // 如果是 JSON
    try {
      const msg = JSON.parse(event.data)
      handleMessage(msg)
    } catch {
      console.log('不是 JSON，是纯文本')
    }
  } else if (event.data instanceof ArrayBuffer) {
    // 二进制消息（ws.binaryType = 'arraybuffer'）
    const bytes = new Uint8Array(event.data)
    console.log('收到二进制：', bytes)
    handleBinaryData(bytes)
  } else if (event.data instanceof Blob) {
    // 二进制消息（ws.binaryType = 'blob'，默认）
    event.data.arrayBuffer().then(buffer => {
      const bytes = new Uint8Array(buffer)
      handleBinaryData(bytes)
    })
  }
}
```

### binaryType 属性

```javascript
// 设置接收二进制消息的类型
ws.binaryType = 'arraybuffer'  // 推荐：直接得到 ArrayBuffer
ws.binaryType = 'blob'         // 默认：得到 Blob

// arraybuffer vs blob 对比
// arraybuffer: 可以直接访问字节，适合实时处理
// blob: 适合大文件，可以创建 URL 用于下载
```

| binaryType | 数据类型 | 访问字节 | 适用场景 |
|------------|---------|----------|----------|
| `'blob'` | Blob | 需要转换 | 大文件、图片显示 |
| `'arraybuffer'` | ArrayBuffer | 直接访问 | **终端数据**、协议解析 |

### onclose 事件

连接关闭时触发。

```javascript
ws.onclose = (event) => {
  console.log('连接关闭')
  console.log('状态码：', event.code)      // 1000, 4001, etc.
  console.log('原因：', event.reason)       // "正常关闭"
  console.log('是否干净关闭：', event.wasClean) // true/false

  // event.code 的含义
  switch (event.code) {
    case 1000: // 正常关闭
      break
    case 1001: // Going Away
      break
    case 1006: // 异常关闭（没有收到 Close 帧）
      console.log('连接异常断开')
      break
    case 4001: // 自定义：认证失败
      console.log('需要重新登录')
      break
    case 4002: // 自定义：协议版本不匹配
      console.log('需要刷新页面')
      break
  }
}
```

### onerror 事件

发生错误时触发。

```javascript
ws.onerror = (event) => {
  // ⚠️ 浏览器出于安全原因，不会暴露错误的具体信息
  // event 是一个通用的 Event 对象，没有 error 属性
  console.error('WebSocket 发生错误')

  // onerror 之后一定会触发 onclose
  // 所以重连逻辑应该放在 onclose 中，而不是 onerror 中

  // 如果需要更详细的错误信息，可以使用：
  console.log('readyState:', ws.readyState)  // 可能是 CLOSED
}
```

> 💡 **重要**：`onerror` 事件不提供详细的错误信息（出于安全考虑）。错误处理逻辑应该放在 `onclose` 中，因为 `onclose` 会提供状态码和原因。

### 事件顺序

```mermaid
sequenceDiagram
    participant App as 📱 应用代码
    participant WS as 🔌 WebSocket

    App->>WS: new WebSocket(url)

    Note over WS: CONNECTING 状态

    alt 连接成功
        WS->>App: onopen
        Note over WS: OPEN 状态

        loop 数据传输
            WS->>App: onmessage
        end

        App->>WS: ws.close()
        WS->>App: onclose (wasClean: true)

    else 连接失败
        WS->>App: onerror
        WS->>App: onclose (wasClean: false)
    end

    Note over WS: CLOSED 状态
```

## 3.3 发送文本与二进制数据

### 发送文本

```javascript
// 发送纯文本
ws.send('Hello, World!')

// 发送 JSON
const message = {
  type: 'CHAT',
  content: '你好',
  timestamp: Date.now(),
  userId: 'user123'
}
ws.send(JSON.stringify(message))

// 发送多语言文本
ws.send('Hello 你好 こんにちは 안녕하세요')
```

### 发送二进制

```javascript
// 发送 Uint8Array
const bytes = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F])
ws.send(bytes)

// 发送 ArrayBuffer
const buffer = new ArrayBuffer(5)
const view = new Uint8Array(buffer)
view[0] = 0x48  // H
view[1] = 0x65  // e
view[2] = 0x6C  // l
view[3] = 0x6C  // l
view[4] = 0x6F  // o
ws.send(buffer)

// 发送 Blob
const blob = new Blob([bytes], { type: 'application/octet-stream' })
ws.send(blob)

// 从 Canvas 发送图片数据
const canvas = document.querySelector('canvas')
canvas.toBlob((blob) => {
  ws.send(blob)
}, 'image/png')
```

### AI-CLI-Mobile 中的数据发送

```typescript
// apps/web/src/hooks/useDualChannelWS.ts

// 发送终端输入（二进制或文本）
const sendInput = useCallback((data: string | Uint8Array) => {
  const ws = termWsRef.current
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(data)
  } else {
    // 连接断开时，缓存输入
    offlineCacheRef.current?.queueInput(data)
  }
}, [])

// 发送窗口大小调整（JSON）
const sendResize = useCallback((cols: number, rows: number) => {
  // 防抖 + 节流
  if (resizeDebounceRef.current) {
    clearTimeout(resizeDebounceRef.current)
  }
  resizeDebounceRef.current = setTimeout(() => {
    const now = Date.now()
    if (now - lastResizeSentRef.current < RESIZE_THROTTLE) return
    lastResizeSentRef.current = now

    const ws = ctrlWsRef.current
    const sessionId = sessionRef.current?.sessionId
    if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
      const msg: ControlClientMessage = {
        type: 'RESIZE',
        sessionId,
        cols,
        rows
      }
      ws.send(JSON.stringify(msg))
    }
  }, RESIZE_DEBOUNCE)
}, [])

// 发送代码注入（带大小限制）
const sendInjectCode = useCallback((code: string) => {
  const MAX_INJECT_CODE_SIZE = 100 * 1024 // 100KB
  const byteLength = new TextEncoder().encode(code).length
  if (byteLength > MAX_INJECT_CODE_SIZE) {
    console.warn(`INJECT_CODE 超过 ${MAX_INJECT_CODE_SIZE} 字节限制 (${byteLength} bytes)`)
    return
  }

  const ws = ctrlWsRef.current
  const sessionId = sessionRef.current?.sessionId
  if (ws && ws.readyState === WebSocket.OPEN && sessionId) {
    const msg: ControlClientMessage = { type: 'INJECT_CODE', sessionId, code }
    ws.send(JSON.stringify(msg))
  }
}, [])
```

### 发送前的检查

```javascript
function safeSend(ws, data) {
  // 检查连接状态
  if (ws.readyState !== WebSocket.OPEN) {
    console.warn('WebSocket 未连接，无法发送')
    return false
  }

  // 检查缓冲区（防止发送过快）
  if (ws.bufferedAmount > 1024 * 1024) { // 1MB
    console.warn('WebSocket 缓冲区已满，等待...')
    return false
  }

  ws.send(data)
  return true
}
```

## 3.4 重连策略

### 为什么需要重连？

WebSocket 连接可能因为各种原因断开：

| 原因 | 说明 | 频率 |
|------|------|------|
| **网络波动** | WiFi 信号不稳定、移动网络切换 | 高 |
| **NAT 超时** | 路由器/NAT 表项超时 | 中 |
| **服务器重启** | 服务器维护、部署 | 低 |
| **空闲超时** | 服务器或代理的空闲连接超时 | 中 |
| **负载均衡器** | 负载均衡器的连接超时 | 中 |
| **浏览器休眠** | 手机锁屏、标签页后台 | 高 |
| **协议错误** | 消息格式错误 | 低 |

### 指数退避（Exponential Backoff）

```mermaid
graph LR
    subgraph "指数退避"
        A["断开"] -->|"1s"| B["重连 #1"]
        B -->|"失败"| C["2s"]
        C --> D["重连 #2"]
        D -->|"失败"| E["4s"]
        E --> F["重连 #3"]
        F -->|"失败"| G["8s"]
        G --> H["重连 #4"]
        H -->|"失败"| I["16s"]
        I --> J["重连 #5"]
        J -->|"失败"| K["30s（上限）"]
        K --> L["重连 #6"]
    end

    style A fill:#ff6b6b,stroke:#333,color:#fff
    style L fill:#69db7c,stroke:#333,color:#fff
```

### 随机抖动（Jitter）

在指数退避的基础上加随机抖动：

```
实际等待时间 = 延迟 × (0.5 + Math.random() × 0.5)
```

这样每个客户端的重连时间都不同，避免同时重连：

```
客户端 A 第1次重连：1.0s × 0.73 = 0.73s
客户端 B 第1次重连：1.0s × 0.52 = 0.52s
客户端 C 第1次重连：1.0s × 0.91 = 0.91s
客户端 D 第1次重连：1.0s × 0.65 = 0.65s

而不是所有客户端都在 1.0s 时重连！
```

### AI-CLI-Mobile 的重连实现

```typescript
// apps/web/src/hooks/useDualChannelWS.ts

const MAX_RECONNECT_DELAY = 30_000      // 最大延迟 30 秒
const INITIAL_RECONNECT_DELAY = 1_000   // 初始延迟 1 秒

function scheduleReconnect() {
  // 防止重复调度
  if (reconnectTimerRef.current) return

  const delay = reconnectDelayRef.current
  // 添加随机抖动：delay × (0.5 ~ 1.0)
  const jittered = delay * (0.5 + Math.random() * 0.5)
  // 指数退避：下次延迟翻倍，但不超过上限
  reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY)

  reconnectTimerRef.current = setTimeout(() => {
    reconnectTimerRef.current = null
    const s = sessionRef.current
    const t = termRef.current
    if (s && t) {
      reconnectCountRef.current += 1
      setReconnectCount(reconnectCountRef.current)
      connectInternal(s.sessionId, s.cols, s.rows, t)
    }
  }, jittered)
}

// 重连成功后重置
if (msg.type === 'SESSION_READY') {
  // ...
  reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
  reconnectCountRef.current = 0
  setReconnectCount(0)
  // ...
}
```

### 重连状态机

```mermaid
stateDiagram-v2
    [*] --> Connected: 初始连接成功
    Connected --> Reconnecting: 连接断开
    Reconnecting --> Connected: 重连成功
    Reconnecting --> Reconnecting: 重连失败（延迟翻倍）
    Reconnecting --> Failed: 超过最大重试次数
    Failed --> [*]: 通知用户

    state Reconnecting {
        [*] --> Waiting: 计算延迟
        Waiting --> Connecting: 延迟结束
        Connecting --> Waiting: 失败
        Connecting --> [*]: 成功
    }
```

### Token 刷新与重连

```typescript
async function handleAuthFailureAndRetry() {
  // 认证失败时，先尝试刷新 token
  closeSockets()
  clearAllTimers()
  store.getState().setDisconnected()
  isConnectingRef.current = false

  try {
    const newToken = await getRefreshToken()
    if (newToken) {
      // Token 刷新成功，用新 token 重连
      const s = sessionRef.current
      const t = termRef.current
      if (s && t) {
        reconnectCountRef.current += 1
        setReconnectCount(reconnectCountRef.current)
        connectInternal(s.sessionId, s.cols, s.rows, t)
      }
    } else {
      // Token 刷新失败，需要用户重新登录
      onAuthFailure()
    }
  } catch {
    onAuthFailure()
  }
}
```

## 3.5 useDualChannelWS 完整分析

`useDualChannelWS` 是 AI-CLI-Mobile 前端的核心 Hook。让我们完整地分析它。

### 整体架构图

```mermaid
graph TD
    subgraph "useDualChannelWS Hook"
        A["connect(sessionId, cols, rows, term)"] --> B["connectInternal()"]
        B --> C["Terminal WS 连接"]
        B --> D["Control WS 连接"]

        C --> E["AUTH 握手"]
        E --> F["ATTACH_SESSION"]
        F --> G["二进制模式"]
        G --> H["键盘输入 ↑ (sendInput)"]
        G --> I["终端输出 ↓ (term.write)"]

        D --> J["AUTH 握手"]
        J --> K["INIT_SESSION"]
        K --> L["控制消息处理"]
        L --> M["STATUS_UPDATE ↓"]
        L --> N["RESIZE ↑ (sendResize)"]
        L --> O["QUICK_ACTION ↑"]
        L --> P["INJECT_CODE ↑"]
    end

    subgraph "重连机制"
        Q["连接断开"] --> R{"哪个通道？"}
        R -->|"Terminal"| S["reconnectTermOnly()"]
        R -->|"Control"| T["reconnectCtrlOnly()"]
        R -->|"都断了"| U["scheduleReconnect()"]
    end

    subgraph "定时器"
        V["termPingTimer (30s)"]
        W["ctrlPingTimer (30s)"]
        X["reconnectTimer"]
        Y["resizeDebounceTimer (200ms)"]
    end

    style C fill:#4dabf7,stroke:#333,color:#fff
    style D fill:#69db7c,stroke:#333,color:#fff
```

### 状态管理详解

```typescript
// ===== Ref 用于内部逻辑（不触发重新渲染）=====

// WebSocket 连接实例
const termWsRef = useRef<WebSocket | null>(null)      // Terminal WebSocket
const ctrlWsRef = useRef<WebSocket | null>(null)       // Control WebSocket

// 心跳定时器
const termPingRef = useRef<ReturnType<typeof setInterval> | null>(null)
const ctrlPingRef = useRef<ReturnType<typeof setInterval> | null>(null)

// 重连相关
const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY)
const reconnectCountRef = useRef(0)

// 会话信息（重连时需要）
const sessionRef = useRef<{ sessionId: string; cols: number; rows: number } | null>(null)
const termRef = useRef<Terminal | null>(null)  // xterm.js 实例

// Resize 防抖
const resizeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const lastResizeSentRef = useRef(0)

// 连接状态
const isConnectingRef = useRef(false)

// 离线缓存
const offlineCacheRef = useRef<OfflineCache | null>(null)

// ===== State 用于 UI 显示 =====
const [reconnectCount, setReconnectCount] = useState(0)
```

> 💡 **为什么 ref 和 state 混用？**
> - WebSocket 相关状态变化非常频繁（每秒可能多次消息），用 state 会导致大量不必要的组件重新渲染
> - `reconnectCount` 用 state 是因为它需要在 UI 上显示给用户（比如"正在重连 (3)"）
> - 其他内部状态只有 Hook 内部的逻辑需要访问，用 ref 就够了

### 连接流程详解

```mermaid
sequenceDiagram
    participant UI as 📱 UI 组件
    participant Hook as 🪝 useDualChannelWS
    participant TermWS as 🔌 Terminal WS
    participant CtrlWS as 🔌 Control WS
    participant Server as 🖥️ 服务器

    UI->>Hook: connect(sessionId, cols, rows, term)
    Hook->>Hook: 重置状态，清理定时器

    Note over Hook: ===== 阶段 1：连接 Terminal =====

    Hook->>TermWS: new WebSocket('/ws/terminal')
    TermWS->>Server: HTTP Upgrade (带 token)
    Server-->>TermWS: 101 Switching Protocols

    TermWS->>Server: {"type":"AUTH","accessToken":"xxx","protocolVersion":"0.1.0"}
    Server-->>TermWS: {"type":"AUTH_OK"}

    TermWS->>Server: {"type":"ATTACH_SESSION","sessionId":"abc123"}
    Note over TermWS: 切换到二进制模式

    Hook->>Hook: startTermPing()

    Note over Hook: ===== 阶段 2：连接 Control =====

    Hook->>CtrlWS: new WebSocket('/ws/control')
    CtrlWS->>Server: HTTP Upgrade (带 token)
    Server-->>CtrlWS: 101 Switching Protocols

    CtrlWS->>Server: {"type":"AUTH","accessToken":"xxx","protocolVersion":"0.1.0"}
    Server-->>CtrlWS: {"type":"AUTH_OK"}

    CtrlWS->>Server: {"type":"INIT_SESSION","sessionId":"abc123","cols":80,"rows":24,"adapter":"claude"}
    Server-->>CtrlWS: {"type":"SESSION_READY","sessionId":"abc123"}

    Note over Hook: ===== 两个通道都就绪！ =====

    Hook->>Hook: startCtrlPing()
    Hook->>UI: setConnected('CONNECTED')

    Note over Hook,Server: ===== 正常通信 =====

    loop 用户操作
        UI->>Hook: sendInput("ls\n")
        Hook->>TermWS: "ls\n" (二进制)
        TermWS->>Server: 键盘输入

        Server-->>TermWS: 终端输出 (二进制)
        TermWS->>Hook: onmessage
        Hook->>UI: term.write(output)

        UI->>Hook: sendResize(120, 40)
        Hook->>CtrlWS: {"type":"RESIZE","cols":120,"rows":40}
    end
```

### 独立重连机制详解

```mermaid
graph TD
    subgraph "场景 1：Terminal 断了，Control 还在"
        A["Terminal 断开"] --> B["reconnectTermOnly()"]
        B --> C["关闭 Terminal WS<br/>（清理事件监听器）"]
        B --> D["保持 Control WS<br/>（不受影响）"]
        B --> E["重建 Terminal WS"]
        E --> F["AUTH 握手"]
        F --> G["ATTACH_SESSION"]
        G --> H["恢复正常 ✅"]

        I["Control WS 继续工作"] --> D
    end

    subgraph "场景 2：Control 断了，Terminal 还在"
        J["Control 断开"] --> K["reconnectCtrlOnly()"]
        K --> L["关闭 Control WS"]
        K --> M["保持 Terminal WS"]
        K --> N["重建 Control WS"]
        N --> O["AUTH 握手"]
        O --> P["INIT_SESSION"]
        P --> Q["恢复正常 ✅"]

        R["Terminal WS 继续工作"] --> M
    end

    subgraph "场景 3：都断了"
        S["都断开"] --> T["scheduleReconnect()"]
        T --> U["等待退避时间"]
        U --> V["重建两个 WS"]
        V --> W["完整连接流程"]
        W --> X["恢复正常 ✅"]
    end

    style H fill:#69db7c,stroke:#333,color:#fff
    style Q fill:#69db7c,stroke:#333,color:#fff
    style X fill:#69db7c,stroke:#333,color:#fff
```

**为什么要独立重连？**

| 场景 | 如果一起重连 | 独立重连 |
|------|-------------|----------|
| Terminal 断了 2 秒 | Control 也断了，需要重新认证 | Control 不受影响 |
| Control 断了 1 秒 | Terminal 也断了，终端输出中断 | Terminal 不受影响 |
| 网络完全断开 | 一起重连 | 一起重连（没有区别） |

**reconnectTermOnly 的实现：**

```typescript
function reconnectTermOnly() {
  const s = sessionRef.current
  const t = termRef.current
  if (!s || !t) return

  // 1. 关闭 Terminal WS（清理所有事件监听器）
  if (termWsRef.current) {
    termWsRef.current.onopen = null
    termWsRef.current.onmessage = null
    termWsRef.current.onclose = null
    termWsRef.current.onerror = null
    if (termWsRef.current.readyState === WebSocket.OPEN ||
        termWsRef.current.readyState === WebSocket.CONNECTING) {
      termWsRef.current.close()
    }
    termWsRef.current = null
  }

  // 2. 清理 Terminal 心跳定时器
  if (termPingRef.current) {
    clearInterval(termPingRef.current)
    termPingRef.current = null
  }

  // 3. 注意：Control WS 不动！

  // 4. 重建 Terminal WS
  const token = getAccessToken()
  if (!token) { onAuthFailure(); return }

  store.getState().setConnected('CONNECTING_TERM')
  const termWs = new WebSocket(`${WS_BASE}/ws/terminal`)
  termWs.binaryType = 'arraybuffer'
  termWsRef.current = termWs

  // 5. 设置事件监听器
  termWs.onopen = () => {
    termWs.send(JSON.stringify({
      type: 'AUTH',
      accessToken: token,
      protocolVersion: PROTOCOL_VERSION,
    }))
  }

  termWs.onmessage = (event) => {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'AUTH_OK') {
          // 认证成功，发送 ATTACH
          termWs.send(JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId: s.sessionId
          }))

          // 切换到二进制模式
          termWs.onmessage = (ev) => {
            if (ev.data instanceof ArrayBuffer) {
              const buf = new Uint8Array(ev.data)
              if (buf.length === 1 && buf[0] === 0x01) return // 忽略心跳
              t.write(buf)
            }
          }

          startTermPing()
          store.getState().setConnected('CONNECTED')
          isConnectingRef.current = false
          return
        }
      } catch {}
      return
    }
  }

  termWs.onclose = (event) => {
    if (termPingRef.current) {
      clearInterval(termPingRef.current)
      termPingRef.current = null
    }
    if (event.code === WS_CLOSE_CODE.PROTOCOL_MISMATCH) {
      window.location.reload()
      return
    }
    if (event.code === WS_CLOSE_CODE.AUTH_FAILED) {
      handleAuthFailureAndRetry()
      return
    }
    scheduleReconnect()
  }
}
```

## 3.6 离线缓存机制

### 设计思路

当 WebSocket 连接断开时，用户的键盘输入不能丢失。AI-CLI-Mobile 实现了离线输入缓存：

```mermaid
graph TD
    subgraph "在线模式"
        A["用户输入"] --> B["sendInput()"]
        B --> C["ws.send(data)"]
        C --> D["服务器"]
    end

    subgraph "离线模式"
        E["用户输入"] --> F["sendInput()"]
        F --> G{"ws.readyState === OPEN?"}
        G -->|否| H["offlineCache.queueInput(data)"]
        H --> I["数据存储在内存中"]
    end

    subgraph "重连后"
        J["连接恢复"] --> K{"有缓存的输入？"}
        K -->|是| L["offlineCache.flushInputs()"]
        L --> M["批量发送缓存"]
        M --> N["服务器"]
        K -->|否| O["正常继续"]
    end

    style H fill:#ffa94d,stroke:#333,color:#fff
    style L fill:#69db7c,stroke:#333,color:#fff
```

### 实现代码

```typescript
// 初始化离线缓存
offlineCacheRef.current = new OfflineCache(sessionId)

// 发送输入时的逻辑
const sendInput = useCallback((data: string | Uint8Array) => {
  const ws = termWsRef.current
  if (ws && ws.readyState === WebSocket.OPEN) {
    // 在线：直接发送
    ws.send(data)
  } else {
    // 离线：缓存起来
    offlineCacheRef.current?.queueInput(data)
  }
}, [])

// 重连成功后发送缓存
if (msg.type === 'SESSION_READY') {
  // ...

  // 检查是否有缓存的输入
  if (offlineCacheRef.current?.hasQueuedInputs()) {
    // 批量发送缓存的输入
    offlineCacheRef.current.flushInputs((data) => sendInput(data))
  }

  // 发送 Ctrl+L 触发终端重绘
  if (reconnectCountRef.current > 0) {
    const termWs = termWsRef.current
    if (termWs && termWs.readyState === WebSocket.OPEN) {
      termWs.send('\x0c')  // Ctrl+L
    }
  }

  // ...
}
```

### 离线缓存的限制

| 限制 | 说明 | 原因 |
|------|------|------|
| 内存限制 | 最多缓存 1MB 输入 | 防止内存溢出 |
| 时间限制 | 最多缓存 5 分钟 | 过期的输入没有意义 |
| 顺序保证 | 缓存的输入按顺序发送 | 终端操作有顺序依赖 |

## 3.7 连接状态管理

### 状态定义

```typescript
type ConnectionPhase =
  | 'DISCONNECTED'      // 未连接
  | 'CONNECTING_TERM'   // 正在连接 Terminal
  | 'CONNECTING_CTRL'   // 正在连接 Control
  | 'CONNECTED'         // 已连接（两个通道都就绪）
```

### 状态转换图

```mermaid
stateDiagram-v2
    [*] --> DISCONNECTED
    DISCONNECTED --> CONNECTING_TERM: connect()
    CONNECTING_TERM --> CONNECTING_CTRL: Terminal AUTH_OK
    CONNECTING_CTRL --> CONNECTED: Control SESSION_READY
    CONNECTED --> CONNECTING_TERM: Terminal 断开
    CONNECTED --> CONNECTING_CTRL: Control 断开
    CONNECTING_TERM --> DISCONNECTED: 重连失败
    CONNECTING_CTRL --> DISCONNECTED: 重连失败
    CONNECTED --> DISCONNECTED: disconnect()

    note right of CONNECTING_TERM
        正在建立 Terminal WS
        等待 AUTH_OK
    end note

    note right of CONNECTING_CTRL
        Terminal 已连接
        正在建立 Control WS
    end note

    note right of CONNECTED
        两个通道都就绪
        可以正常通信
    end note
```

### UI 根据状态显示不同内容

```tsx
function StatusBar() {
  const { connectionPhase, reconnectCount } = useSessionStore()

  switch (connectionPhase) {
    case 'DISCONNECTED':
      return <div className="status disconnected">未连接</div>

    case 'CONNECTING_TERM':
      return <div className="status connecting">正在连接终端...</div>

    case 'CONNECTING_CTRL':
      return <div className="status connecting">正在连接控制通道...</div>

    case 'CONNECTED':
      return <div className="status connected">已连接</div>
  }
}
```

---

# 第四章：服务端 WebSocket（ws 库）

## 4.1 ws 库基础使用

### 安装

```bash
npm install ws
npm install -D @types/ws  # TypeScript 类型定义
```

### 最简单的服务器

```javascript
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws, request) => {
  console.log('新客户端连接')
  console.log('IP：', request.socket.remoteAddress)
  console.log('URL：', request.url)

  // 接收消息
  ws.on('message', (data, isBinary) => {
    console.log('收到消息：', data.toString())
    console.log('是否二进制：', isBinary)

    // 回复消息
    ws.send(`你说的是：${data.toString()}`)
  })

  // 连接关闭
  ws.on('close', (code, reason) => {
    console.log('客户端断开：', code, reason.toString())
  })

  // 发送欢迎消息
  ws.send('欢迎连接到 WebSocket 服务器！')
})
```

### 发送不同类型的数据

```javascript
ws.on('connection', (socket) => {
  // 发送文本
  socket.send('Hello')

  // 发送 JSON
  socket.send(JSON.stringify({
    type: 'greeting',
    message: '你好',
    timestamp: Date.now()
  }))

  // 发送二进制
  const buffer = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F])
  socket.send(buffer)

  // 发送带选项的消息
  socket.send('Hello', {
    binary: false,    // 是否作为二进制发送
    compress: false,  // 是否压缩
    mask: false,      // 是否掩码（服务器→客户端通常不需要）
    fin: true,        // 是否是最后一帧
  })
})
```

### 接收消息

```javascript
ws.on('message', (data, isBinary) => {
  if (isBinary) {
    // 二进制数据
    console.log('二进制数据长度：', data.length, '字节')
    console.log('前 10 个字节：', data.slice(0, 10))

    // 解析二进制协议
    const header = data.readUInt8(0)
    const payload = data.slice(1)
    console.log('头部：', header)
    console.log('负载：', payload)
  } else {
    // 文本数据
    const text = data.toString()
    console.log('文本数据：', text)

    // 尝试解析 JSON
    try {
      const json = JSON.parse(text)
      console.log('JSON 数据：', json)
      handleMessage(json)
    } catch {
      console.log('不是 JSON，是纯文本')
    }
  }
})
```

### 广播消息

```javascript
// 向所有连接的客户端广播
function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

// 向除了发送者之外的所有客户端广播
function broadcastExcept(sender, message) {
  wss.clients.forEach((client) => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}
```

### 错误处理

```javascript
ws.on('error', (error) => {
  console.error('WebSocket 错误：', error.message)
  console.error('错误代码：', error.code)
})

// 服务器级别的错误
wss.on('error', (error) => {
  console.error('WebSocket 服务器错误：', error)
})

// 处理头部过大等错误
wss.on('headers', (headers, request) => {
  // 可以修改响应头
  headers.push('X-Custom-Header: value')
})
```

### ws 库的选项

```javascript
const wss = new WebSocketServer({
  port: 8080,                    // 监听端口
  host: '0.0.0.0',              // 监听地址
  path: '/ws',                   // 路径
  backlog: 511,                  // 连接队列大小
  server: httpServer,            // 使用已有的 HTTP 服务器
  verifyClient: (info, callback) => {
    // 验证客户端
    const token = new URL(info.req.url, 'http://localhost')
      .searchParams.get('token')
    if (isValidToken(token)) {
      callback(true)  // 允许连接
    } else {
      callback(false, 401, 'Unauthorized')  // 拒绝连接
    }
  },
  perMessageDeflate: {           // 压缩配置
    zlibDeflateOptions: {
      level: 3,                  // 压缩级别 1-9
    },
    threshold: 1024,             // 只压缩 > 1KB 的消息
    serverNoContextTakeover: true,
    clientNoContextTakeover: true,
  },
  maxPayload: 1024 * 1024,       // 最大消息大小 (1MB)
  skipUTF8Validation: false,     // 是否跳过 UTF-8 验证
})
```

## 4.2 @fastify/websocket 集成

### 为什么用 Fastify？

| 特性 | Express + ws | Fastify + @fastify/websocket |
|------|-------------|------------------------------|
| **性能** | ~14,000 req/s | ~30,000 req/s |
| **路由集成** | 手动处理 | **自动路由** |
| **Schema 验证** | 无 | **内置（JSON Schema）** |
| **TypeScript** | 需要额外配置 | **原生支持** |
| **插件系统** | 中间件 | **封装插件** |
| **日志** | 需要 morgan 等 | **内置 pino** |
| **文档** | 需要 swagger-jsdoc | **内置 @fastify/swagger** |

### 安装和配置

```bash
npm install fastify @fastify/websocket
```

```typescript
// apps/server/src/index.ts
import Fastify from 'fastify'
import websocket from '@fastify/websocket'

const fastify = Fastify({
  logger: true,  // 启用 pino 日志
})

// 注册 WebSocket 插件
await fastify.register(websocket, {
  options: {
    maxPayload: 1024 * 1024,  // 最大消息 1MB
    clientTracking: true,      // 跟踪客户端连接
  },
})

// 注册路由
await fastify.register(terminalRoutes)
await fastify.register(controlRoutes)

// 启动服务器
await fastify.listen({ port: 3000, host: '0.0.0.0' })
```

### 路由定义

```typescript
// apps/server/src/routes/terminal.ts
import { FastifyInstance } from 'fastify'
import { verifyWsUpgradeToken } from '../lib/wsAuth.js'

export async function terminalRoutes(fastify: FastifyInstance) {
  fastify.get('/ws/terminal', {
    websocket: true,  // 标记为 WebSocket 路由
    schema: {
      hide: true,  // 不在 Swagger UI 中显示
      summary: 'WebSocket 终端连接',
      description: '通过 WebSocket 连接到终端会话',
      querystring: {
        type: 'object',
        required: ['token'],
        properties: {
          token: {
            type: 'string',
            description: 'JWT access token',
          },
        },
      },
    },
  }, (socket, request) => {
    // 验证 token
    if (!verifyWsUpgradeToken(request, socket, 'Terminal')) return

    // 交给 WSGateway 处理
    fastify.wsGateway.handleTerminalConnection(socket)
  })
}
```

### @fastify/websocket 的工作原理

```mermaid
graph TD
    subgraph "@fastify/websocket 请求处理"
        A["HTTP 请求到达 Fastify"] --> B{"是 WebSocket 升级？"}
        B -->|否| C["普通 HTTP 处理"]
        B -->|是| D{"匹配 WebSocket 路由？"}
        D -->|否| E["404 Not Found"]
        D -->|是| F["Schema 验证"]
        F -->|失败| G["400 Bad Request"]
        F -->|成功| H["调用路由处理函数"]
        H --> I["101 Switching Protocols"]
        I --> J["WebSocket 通信"]
    end

    style I fill:#69db7c,stroke:#333,color:#fff
    style G fill:#ff6b6b,stroke:#333,color:#fff
```

### 装饰器（Decorator）

Fastify 支持装饰器模式，可以给 fastify 实例添加自定义属性：

```typescript
// 注册装饰器
fastify.decorate('wsGateway', new WSGateway(sessionManager, jwtSecret, jwtRefreshSecret))

// 类型声明
declare module 'fastify' {
  interface FastifyInstance {
    wsGateway: WSGateway
  }
}
```

## 4.3 消息路由

### WSGateway 的消息路由

WSGateway 使用 `switch` 语句对消息进行路由分发：

```mermaid
graph TD
    subgraph "Control Channel 消息路由"
        A["收到 JSON 消息"] --> B{"msg.type？"}
        B -->|"PING"| C["回复 PONG"]
        B -->|"INIT_SESSION"| D["创建/附加会话"]
        B -->|"ATTACH_SESSION"| E["附加到已有会话"]
        B -->|"RESIZE"| F["调整终端大小"]
        B -->|"QUICK_ACTION"| G["执行快捷操作"]
        B -->|"INJECT_CODE"| H["注入代码到终端"]
        B -->|"START_RECORDING"| I["开始录制终端输出"]
        B -->|"STOP_RECORDING"| J["停止录制"]
        B -->|"GET_RECORDING"| K["获取录制数据"]
        B -->|"OBSERVE_SESSION"| L["观察会话（只读）"]
        B -->|"REFRESH"| M["刷新 Token"]
        B -->|其他| N["忽略"]
    end

    style A fill:#4dabf7,stroke:#333,color:#fff
    style C fill:#69db7c,stroke:#333,color:#fff
    style D fill:#69db7c,stroke:#333,color:#fff
```

### 消息处理代码

```typescript
// apps/server/src/core/WSGateway.ts

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

    case 'REFRESH': {
      // 刷新 Token
      try {
        const decoded = jwt.verify(msg.refreshToken, this.jwtRefreshSecret) as JwtPayload
        const newAccessToken = jwt.sign(
          { userId: decoded.userId, username: decoded.username },
          this.jwtSecret,
          { expiresIn: '15m' },
        )
        ws.send(JSON.stringify({
          type: 'TOKEN_RENEWED',
          accessToken: newAccessToken,
        }))
      } catch {
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Invalid refresh token',
        }))
      }
      break
    }

    case 'INIT_SESSION': {
      const { sessionId, cols, rows, adapter } = msg
      // 校验终端尺寸
      const safeCols = Math.max(TERM_COLS_MIN, Math.min(TERM_COLS_MAX, Math.floor(cols) || 80))
      const safeRows = Math.max(TERM_ROWS_MIN, Math.min(TERM_ROWS_MAX, Math.floor(rows) || 24))
      try {
        if (!currentUser) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }))
          break
        }
        this.sessionManager.createOrAttachSession(
          sessionId, safeCols, safeRows, adapter, currentUser.userId
        )
        this.sessionManager.attachClient(sessionId, undefined, ws)
        setSessionId(sessionId)
        ws.send(JSON.stringify({ type: 'SESSION_READY', sessionId }))
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        ws.send(JSON.stringify({ type: 'ERROR', message }))
      }
      break
    }

    case 'RESIZE': {
      if (!currentSessionId) {
        ws.send(JSON.stringify({ type: 'ERROR', message: 'No active session' }))
        break
      }
      if (!this.validateSessionAccess(ws, currentSessionId, currentUser)) break
      if (msg.cols && msg.rows) {
        const safeCols = Math.max(TERM_COLS_MIN, Math.min(TERM_COLS_MAX, Math.floor(msg.cols) || 80))
        const safeRows = Math.max(TERM_ROWS_MIN, Math.min(TERM_ROWS_MAX, Math.floor(msg.rows) || 24))
        try {
          this.sessionManager.resize(currentSessionId, safeCols, safeRows)
        } catch (err) {
          pinoLogger.warn({ err, sessionId: currentSessionId }, 'RESIZE failed')
        }
      }
      break
    }

    case 'INJECT_CODE': {
      if (!currentSessionId || !this.validateSessionAccess(ws, currentSessionId, currentUser)) break
      // 服务端兜底：1MB 限制
      const INJECT_CODE_MAX_SIZE = 1048576
      if (msg.code && Buffer.byteLength(msg.code, 'utf-8') > INJECT_CODE_MAX_SIZE) {
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'INJECT_CODE exceeds maximum size (1MB)',
        }))
        break
      }
      if (msg.code) {
        this.sessionManager.sendInput(currentSessionId, msg.code)
      }
      break
    }

    // ... 其他消息类型
  }
}
```

## 4.4 连接管理

### 连接状态机

```typescript
enum WSState {
  UNAUTHENTICATED,  // 刚连接，等待认证
  AUTHENTICATED,    // 已认证，可以通信
}
```

```mermaid
stateDiagram-v2
    [*] --> UNAUTHENTICATED: WebSocket 连接建立
    UNAUTHENTICATED --> AUTHENTICATED: 收到有效 AUTH
    UNAUTHENTICATED --> [*]: 认证超时 (15s)
    UNAUTHENTICATED --> [*]: 无效 Token
    UNAUTHENTICATED --> [*]: 协议版本不匹配
    AUTHENTICATED --> [*]: 客户端断开
    AUTHENTICATED --> [*]: 服务器关闭
    AUTHENTICATED --> [*]: 心跳超时
```

### 认证超时

```typescript
const AUTH_TIMEOUT_MS = 15_000  // 15 秒

const authTimeout = setTimeout(() => {
  if (state === WSState.UNAUTHENTICATED) {
    pinoLogger.warn('Terminal WS auth timeout')
    ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Auth timeout')
  }
}, AUTH_TIMEOUT_MS)

// 认证成功后清除超时
this.verifyAuth(ws, msg, (payload) => {
  clearTimeout(authTimeout)
  state = WSState.AUTHENTICATED
  // ...
})
```

### 心跳管理

```typescript
// 使用 Map 管理每个连接的心跳定时器
private pingTimers = new Map<WebSocket, NodeJS.Timeout>()

private setupTerminalKeepAlive(ws: WebSocket): void {
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(Buffer.from([TERM_PONG]))  // 发送保活探测
    }
  }, PING_INTERVAL_MS)
  this.pingTimers.set(ws, timer)
}

private setupControlKeepAlive(ws: WebSocket): void {
  const timer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'PING' }))
    }
  }, PING_INTERVAL_MS)
  this.pingTimers.set(ws, timer)
}

private cleanupPing(ws: WebSocket): void {
  const timer = this.pingTimers.get(ws)
  if (timer) {
    clearInterval(timer)
    this.pingTimers.delete(ws)
  }
}

// 服务器关闭时清理所有定时器
destroy(): void {
  for (const timer of this.pingTimers.values()) {
    clearInterval(timer)
  }
  this.pingTimers.clear()
}
```

## 4.5 WSGateway 逐行分析

### 类结构

```typescript
export class WSGateway {
  // 依赖注入
  private sessionManager: SessionManager  // 会话管理器
  private jwtSecret: string               // JWT 签名密钥
  private jwtRefreshSecret: string        // JWT 刷新密钥

  // 内部状态
  private pingTimers = new Map<WebSocket, NodeJS.Timeout>()

  constructor(
    sessionManager: SessionManager,
    jwtSecret: string,
    jwtRefreshSecret: string
  ) {
    this.sessionManager = sessionManager
    this.jwtSecret = jwtSecret
    this.jwtRefreshSecret = jwtRefreshSecret
  }
}
```

### Terminal Channel 处理流程

```mermaid
sequenceDiagram
    participant Client as 🌐 客户端
    participant WSG as 🖥️ WSGateway
    participant SM as 📋 SessionManager

    Client->>WSG: WebSocket 连接
    Note over WSG: state = UNAUTHENTICATED
    Note over WSG: 启动 15s 认证超时

    Client->>WSG: {"type":"AUTH","accessToken":"xxx","protocolVersion":"0.1.0"}
    WSG->>WSG: verifyAuth()
    alt 认证成功
        WSG->>WSG: 清除超时，state = AUTHENTICATED
        WSG-->>Client: {"type":"AUTH_OK"}
    else 认证失败
        WSG-->>Client: close(4001, "Invalid token")
    end

    Client->>WSG: {"type":"ATTACH_SESSION","sessionId":"abc"}
    WSG->>SM: hasSession("abc")?
    SM-->>WSG: true
    WSG->>SM: getOwner("abc")
    SM-->>WSG: "user123"
    WSG->>WSG: 检查 owner === currentUser.userId
    WSG->>SM: attachClient("abc", ws)
    Note over WSG: 切换到二进制模式

    loop 终端交互
        Client->>WSG: 键盘输入 (二进制)
        WSG->>SM: sendInput("abc", data)
        SM->>SM: 写入 PTY
        SM-->>WSG: PTY 输出 (二进制)
        WSG-->>Client: 终端输出
    end

    loop 心跳 (30s)
        WSG-->>Client: 0x01 (PONG)
        Client->>WSG: 0x00 (PING)
    end
```

### 认证验证

```typescript
private verifyAuth(
  ws: WebSocket,
  msg: { accessToken?: string; protocolVersion?: string },
  onSuccess: (payload: JwtPayload) => void,
): void {
  // 1. 检查协议版本
  if (msg.protocolVersion && msg.protocolVersion !== PROTOCOL_VERSION) {
    ws.close(WS_CLOSE_CODE.PROTOCOL_MISMATCH, 'Protocol version mismatch')
    return
  }

  // 2. 检查 token 是否存在
  if (!msg.accessToken) {
    pinoLogger.warn('WS auth failed — missing accessToken')
    ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Missing access token')
    return
  }

  // 3. 验证 JWT
  try {
    const decoded = jwt.verify(msg.accessToken, this.jwtSecret) as JwtPayload
    onSuccess(decoded)
  } catch {
    pinoLogger.warn('WS auth failed — invalid token')
    ws.close(WS_CLOSE_CODE.AUTH_FAILED, 'Invalid token')
  }
}
```

### 权限校验

```typescript
private validateSessionAccess(
  ws: WebSocket,
  sessionId: string,
  currentUser: JwtPayload | null,
): boolean {
  // 1. 连接是否还开着
  if (ws.readyState !== WebSocket.OPEN) return false

  // 2. 会话是否存在
  if (!this.sessionManager.hasSession(sessionId)) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found' }))
    return false
  }

  // 3. 用户是否已认证
  if (!currentUser) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Not authenticated' }))
    return false
  }

  // 4. 会话是否属于当前用户
  const owner = this.sessionManager.getOwner(sessionId)
  if (!owner || owner !== currentUser.userId) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Permission denied' }))
    return false
  }

  return true
}
```

## 4.6 SessionManager 集成

### SessionManager 的职责

```mermaid
graph TD
    subgraph "SessionManager"
        A["createOrAttachSession()"] --> B["创建新 PTY 进程"]
        A --> C["附加到已有会话"]

        D["attachClient()"] --> E["绑定 Terminal WS"]
        D --> F["绑定 Control WS"]

        G["sendInput()"] --> H["写入 PTY"]

        I["resize()"] --> J["调整 PTY 大小"]

        K["detachClient()"] --> L["解绑 WS"]
        K --> M{"还有其他客户端？"}
        M -->|否| N["清理会话"]
        M -->|是| O["保持会话"]
    end

    subgraph "PTY 进程"
        P["node-pty"] --> Q["bash/zsh"]
        Q --> R["终端输出"]
        R --> S["发送给所有绑定的客户端"]
    end

    H --> P
    S --> E
```

### WSGateway 与 SessionManager 的协作

```mermaid
sequenceDiagram
    participant Client as 🌐 客户端
    participant WSG as 🖥️ WSGateway
    participant SM as 📋 SessionManager
    participant PTY as 💻 PTY 进程

    Client->>WSG: INIT_SESSION
    WSG->>SM: createOrAttachSession(sessionId, cols, rows, adapter, userId)
    SM->>PTY: 创建 PTY 进程
    SM-->>WSG: 成功
    WSG->>SM: attachClient(sessionId, undefined, ws)
    SM->>SM: 记录 Control WS
    WSG-->>Client: SESSION_READY

    Client->>WSG: Terminal WS 二进制数据
    WSG->>SM: sendInput(sessionId, data)
    SM->>PTY: 写入 PTY
    PTY-->>SM: 终端输出
    SM->>SM: 找到绑定的 Terminal WS
    SM-->>Client: 终端输出（二进制）
```

---

# 第五章：WebSocket 双通道架构

## 5.1 什么是双通道？

AI-CLI-Mobile 使用**两个独立的 WebSocket 连接**来处理不同类型的数据：

```mermaid
graph TD
    subgraph "手机浏览器"
        A["xterm.js 终端模拟器"] <--> B["useDualChannelWS Hook"]
        C["控制面板 UI"] <--> B
        B <--> D["Terminal Channel<br/>ws://host/ws/terminal"]
        B <--> E["Control Channel<br/>ws://host/ws/control"]
    end

    subgraph "服务器"
        F["@fastify/websocket"] <--> G["WSGateway"]
        G <--> H["SessionManager"]
        H <--> I["PTY 进程<br/>(node-pty)"]
        H <--> J["录制系统"]
        H <--> K["观察者连接"]
    end

    D <-->|"二进制帧<br/>终端数据 + 心跳"| F
    E <-->|"文本帧 (JSON)<br/>控制命令 + 心跳"| F

    style D fill:#4dabf7,stroke:#333,color:#fff
    style E fill:#69db7c,stroke:#333,color:#fff
```

## 5.2 Terminal Channel

### 职责

Terminal Channel 专门负责**终端数据**的传输，包括：

| 方向 | 数据 | 格式 | 说明 |
|------|------|------|------|
| 客户端→服务器 | 键盘输入 | 二进制 | 用户敲的每个键、粘贴的文本 |
| 服务器→客户端 | 终端输出 | 二进制 | PTY 的输出（包括 ANSI 转义序列） |
| 客户端→服务器 | 心跳 Ping | 二进制 (0x00) | 每 30 秒发送 |
| 服务器→客户端 | 心跳 Pong | 二进制 (0x01) | 响应 Ping 或保活探测 |
| 客户端→服务器 | Ctrl+L | 二进制 (0x0C) | 重连后触发终端重绘 |

### 为什么用二进制？

终端数据本质上是**字节流**，包含：
- ASCII 字符（0x00-0x7F）
- UTF-8 编码的多字节字符（中文、日文等）
- ANSI 转义序列（颜色、光标移动、清屏等）
- 特殊键的转义序列（箭头键、功能键、Home/End 等）
- Ctrl 组合键（Ctrl+C=0x03, Ctrl+L=0x0C 等）

如果用文本帧传输，WebSocket 会强制进行 UTF-8 验证，可能破坏某些二进制序列。

### 完整生命周期

```mermaid
sequenceDiagram
    participant Client as 🌐 浏览器
    participant Server as 🖥️ 服务器
    participant PTY as 💻 PTY 进程

    Note over Client,Server: 1. 建立连接
    Client->>Server: WebSocket 连接 (/ws/terminal?token=xxx)

    Note over Client,Server: 2. 认证
    Client->>Server: {"type":"AUTH","accessToken":"xxx","protocolVersion":"0.1.0"}
    Server-->>Client: {"type":"AUTH_OK"}

    Note over Client,Server: 3. 附加会话
    Client->>Server: {"type":"ATTACH_SESSION","sessionId":"abc123"}
    Note over Server: 切换到二进制模式

    Note over Client,PTY: 4. 终端交互
    Client->>Server: "ls -la\n" (二进制)
    Server->>PTY: 写入 PTY
    PTY-->>Server: "file1.txt file2.txt\n$ " (二进制)
    Server-->>Client: 终端输出 (二进制)

    Client->>Server: "cat file1.txt\n" (二进制)
    Server->>PTY: 写入 PTY
    PTY-->>Server: "Hello World\n$ " (二进制)
    Server-->>Client: 终端输出 (二进制)

    Note over Client,Server: 5. 心跳
    loop 每 30 秒
        Client->>Server: 0x00 (PING)
        Server-->>Client: 0x01 (PONG)
    end

    Note over Client,Server: 6. 断开
    Client->>Server: Close 帧 (1000)
    Server->>PTY: 分离 PTY
```

## 5.3 Control Channel

### 职责

Control Channel 负责**控制命令**的传输：

| 方向 | 消息类型 | 说明 |
|------|----------|------|
| 客户端→服务器 | AUTH | 认证 |
| 客户端→服务器 | REFRESH | 刷新 Token |
| 客户端→服务器 | PING | 心跳 |
| 客户端→服务器 | INIT_SESSION | 初始化会话 |
| 客户端→服务器 | ATTACH_SESSION | 附加到会话 |
| 客户端→服务器 | RESIZE | 调整终端大小 |
| 客户端→服务器 | QUICK_ACTION | 快捷操作 |
| 客户端→服务器 | INJECT_CODE | 注入代码 |
| 客户端→服务器 | START_RECORDING | 开始录制 |
| 客户端→服务器 | STOP_RECORDING | 停止录制 |
| 客户端→服务器 | GET_RECORDING | 获取录制 |
| 客户端→服务器 | OBSERVE_SESSION | 观察会话 |
| 服务器→客户端 | AUTH_OK | 认证成功 |
| 服务器→客户端 | TOKEN_RENEWED | Token 已刷新 |
| 服务器→客户端 | PONG | 心跳响应 |
| 服务器→客户端 | STATUS_UPDATE | Agent 状态更新 |
| 服务器→客户端 | SESSION_READY | 会话就绪 |
| 服务器→客户端 | ERROR | 错误 |
| 服务器→客户端 | RECORDING_DATA | 录制数据 |
| 服务器→客户端 | RECORDING_STATUS | 录制状态 |

### 协议类型定义

```typescript
// packages/shared/src/protocol.ts

// Agent 状态
export type AgentStatus = 'IDLE' | 'RUNNING' | 'WAITING_APPROVAL' | 'ERROR'

// 客户端消息（联合类型）
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

// 服务端消息（联合类型）
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

### 消息流向图

```mermaid
graph TD
    subgraph "客户端 → 服务器"
        A1["AUTH"] --> B1["认证"]
        A2["INIT_SESSION"] --> B2["创建会话"]
        A3["RESIZE"] --> B3["调整大小"]
        A4["QUICK_ACTION"] --> B4["执行操作"]
        A5["INJECT_CODE"] --> B5["注入代码"]
        A6["PING"] --> B6["心跳"]
    end

    subgraph "服务器 → 客户端"
        C1["AUTH_OK"] --> D1["认证成功"]
        C2["SESSION_READY"] --> D2["会话就绪"]
        C3["STATUS_UPDATE"] --> D3["状态变化"]
        C4["TOKEN_RENEWED"] --> D4["Token 刷新"]
        C5["PONG"] --> D5["心跳响应"]
        C6["ERROR"] --> D6["错误信息"]
    end

    style A1 fill:#69db7c,stroke:#333,color:#fff
    style C1 fill:#4dabf7,stroke:#333,color:#fff
```

## 5.4 双通道的设计理由

### 为什么不合并成一个通道？

| 特性 | 单通道（混合） | 双通道（分离） |
|------|---------------|---------------|
| **实现复杂度** | 低 | 中 |
| **数据隔离** | ❌ 混在一起 | ✅ 天然隔离 |
| **类型切换** | 需要判断每条消息的类型 | 各用各的类型 |
| **独立重连** | ❌ 一个断了都断 | ✅ 可以独立重连 |
| **性能** | 控制消息可能被终端数据阻塞 | 互不影响 |
| **安全性** | 需要额外区分 | 天然分离 |
| **调试** | 难以区分数据流 | 容易区分 |
| **扩展性** | 添加新消息类型需要修改混合逻辑 | 各通道独立扩展 |

### 核心优势详解

**1. 数据隔离**

Terminal Channel 每秒可能传输几百帧二进制数据（终端输出），Control Channel 每分钟可能只发几条 JSON 命令。如果混在一起：
- 控制命令可能被大量终端数据"淹没"
- 需要在每条消息中判断"这是终端数据还是控制命令"
- JSON.parse 和二进制处理混在一起，代码复杂

**2. 类型安全**

```typescript
// 双通道：类型天然分离
// Terminal Channel 只处理二进制
termWs.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    term.write(new Uint8Array(event.data))
  }
}

// Control Channel 只处理 JSON
ctrlWs.onmessage = (event) => {
  if (typeof event.data === 'string') {
    const msg: ControlServerMessage = JSON.parse(event.data)
    handleCtrlMessage(msg)
  }
}

// 单通道：需要判断类型
ws.onmessage = (event) => {
  if (typeof event.data === 'string') {
    // 可能是控制命令，也可能是文本终端数据
    const msg = JSON.parse(event.data)
    if (isControlMessage(msg)) {
      handleCtrlMessage(msg)
    } else {
      term.write(msg.data)
    }
  } else {
    // 一定是终端数据
    term.write(new Uint8Array(event.data))
  }
}
```

**3. 独立重连**

这是最重要的优势。Terminal Channel 因为传输高频数据，断连的概率更高。独立重连意味着：
- Terminal 断了 2 秒，只需要重连 Terminal
- Control Channel 不受影响，用户的状态信息不会丢失
- 重连更快，用户体验更好

## 5.5 独立重连机制

### 三种断连场景

```mermaid
graph TD
    subgraph "场景分析"
        A{"哪个通道断了？"} -->|"Terminal 断了"| B["reconnectTermOnly()"]
        A -->|"Control 断了"| C["reconnectCtrlOnly()"]
        A -->|"都断了"| D["scheduleReconnect()"]
    end

    B --> E["保持 Control 连接<br/>只重建 Terminal<br/>快速恢复 ✅"]
    C --> F["保持 Terminal 连接<br/>只重建 Control<br/>快速恢复 ✅"]
    D --> G["等待退避时间<br/>重建两个连接<br/>完整恢复 ✅"]

    style E fill:#4dabf7,stroke:#333,color:#fff
    style F fill:#69db7c,stroke:#333,color:#fff
    style G fill:#ffa94d,stroke:#333,color:#fff
```

### 判断逻辑

```typescript
// Terminal Channel 的 onclose
termWs.onclose = (event) => {
  // 清理心跳
  if (termPingRef.current) {
    clearInterval(termPingRef.current)
    termPingRef.current = null
  }

  // 场景判断
  if (store.getState().connectionPhase === 'CONNECTING_TERM') {
    // 还在连接 Terminal 阶段，Terminal 断了 = 整体失败
    closeSockets()
    clearAllTimers()
    store.getState().setDisconnected()
    isConnectingRef.current = false
    scheduleReconnect()  // 重连两个通道
  } else if (store.getState().isConnected) {
    // 已经连接成功，Terminal 断了 = 只重连 Terminal
    reconnectTermOnly()
  }
}

// Control Channel 的 onclose
ctrlWs.onclose = (event) => {
  if (ctrlPingRef.current) {
    clearInterval(ctrlPingRef.current)
    ctrlPingRef.current = null
  }

  if (store.getState().isConnected) {
    // 已经连接成功，Control 断了 = 只重连 Control
    reconnectCtrlOnly()
  } else if (store.getState().connectionPhase === 'CONNECTING_CTRL') {
    // 还在连接 Control 阶段，Control 断了 = 整体失败
    closeSockets()
    clearAllTimers()
    store.getState().setDisconnected()
    isConnectingRef.current = false
    scheduleReconnect()
  }
}
```
---

# 补充章节：Socket.IO 与 WebSocket 对比

> 📖 本节对比 Socket.IO 和原生 WebSocket，帮你理解何时选择哪种方案。

## Socket.IO vs 原生 WebSocket

```mermaid
graph LR
    subgraph "Socket.IO"
        S1["自动重连"] --> S2["房间/命名空间"]
        S2 --> S3["二进制支持"]
        S3 --> S4["ACK 确认机制"]
    end

    subgraph "原生 WebSocket"
        W1["简单轻量"] --> W2["浏览器原生"]
        W2 --> W3["无额外依赖"]
        W3 --> W4["需要自行实现高级功能"]
    end

    style S1 fill:#FF9800,color:#fff
    style W1 fill:#4CAF50,color:#fff
```

| 特性 | Socket.IO | 原生 WebSocket | 项目选择 |
|------|-----------|---------------|---------|
| 包体积 | ~45KB | 0KB（浏览器内置） | 原生 ✅ |
| 自动重连 | 内置 | 需要自行实现 | — |
| 房间/命名空间 | 内置 | 不支持 | — |
| ACK 确认 | 内置 | 不支持 | — |
| 二进制支持 | 支持 | 原生支持 | — |
| 协议开销 | 高（Engine.IO 层） | 低（原生帧） | 原生 ✅ |
| 断线检测 | 心跳 + ACK | 需要 Ping/Pong | — |

**项目选择原生 WebSocket 的理由：**

1. **终端场景不需要 Socket.IO 的高级功能**：不需要房间、命名空间、ACK 确认
2. **性能要求**：终端数据是高频二进制流，Socket.IO 的额外协议层会增加延迟
3. **包体积**：移动端 PWA 要求尽可能小的包体积
4. **自行实现了所需功能**：重连（指数退避+抖动）、心跳（Ping/Pong）、双通道（独立管理）

---

# 补充章节：WebSocket 消息协议设计

> 📖 本节讨论 WebSocket 应用层消息协议的设计选择。

## 消息格式对比

| 格式 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **JSON** | 可读性好、调试方便 | 体积大、解析慢 | 控制消息（低频） |
| **MessagePack** | 紧凑二进制、比 JSON 小 30-50% | 不可读 | 需要紧凑的场景 |
| **Protobuf** | 最紧凑、强类型 | 需要 .proto 定义 | 高频数据传输 |
| **自定义二进制** | 最小开销 | 实现复杂 | 终端 I/O（高频） |

**项目中的选择：**
- **Terminal Channel**：自定义二进制帧（1字节心跳 + 原始 UTF-8 数据）
- **Control Channel**：JSON 消息（可读性优先，频率低）

---

# 补充章节：WebSocket 集群方案

> 📖 当需要水平扩展 WebSocket 服务时，如何处理跨实例通信？

## 集群挑战

```mermaid
graph TD
    C1["客户端A"] -->|"连接"| S1["服务端实例1"]
    C2["客户端B"] -->|"连接"| S2["服务端实例2"]
    S1 -.->|"如何通信?"| S2

    style S1 fill:#4CAF50,color:#fff
    style S2 fill:#2196F3,color:#fff
```

当两个客户端连接到不同的服务端实例时，如何实现消息广播？

## 解决方案

```mermaid
graph TB
    subgraph "方案1: Redis Pub/Sub"
        R1["实例1"] -->|"发布"| Redis["Redis"]
        R2["实例2"] -->|"订阅"| Redis
        Redis -->|"广播"| R1
        Redis -->|"广播"| R2
    end

    subgraph "方案2: 粘性会话"
        LB["负载均衡器"] -->|"同一客户端<br/>始终路由到同一实例"| I1["实例1"]
        LB -->|"另一客户端"| I2["实例2"]
    end

    style Redis fill:#f44336,color:#fff
    style LB fill:#9C27B0,color:#fff
```

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| Redis Pub/Sub | 真正的跨实例通信 | 需要 Redis 基础设施 | 大规模集群 |
| 粘性会话 | 简单，无需额外组件 | 实例故障会丢失连接 | 小规模部署 |
| 共享存储 | 状态持久化 | 性能瓶颈 | 状态密集型 |

**AI-CLI-Mobile 的选择：** 单实例部署（Docker 单容器），不需要集群方案。如果未来需要扩展，Redis Pub/Sub 是最自然的选择。

---

> 📝 补充章节完成。

---

## 十、实时协作编辑算法：OT vs CRDT

### 10.1 问题背景

当多个用户同时编辑同一文档时，如何保证所有人看到一致的最终结果？这是协同编辑的核心挑战。

### 10.2 OT（Operational Transformation）

OT 是 Google Docs 采用的经典算法。核心思想：当并发操作发生时，通过**操作变换**将操作调整为可以在对方操作之后正确执行的形式。

```mermaid
flowchart TD
    subgraph OT工作原理
        A[用户A的操作: 在位置3插入'X'] --> T[变换函数 Transform]
        B[用户B的操作: 在位置5插入'Y'] --> T
        T --> A'[变换后: 在位置3插入'X']
        T --> B'[变换后: 在位置6插入'Y']
        A' --> R[两端收敛到相同结果]
        B' --> R
    end
```

**OT 变换示例**：

```
原始文档: "ABCDE"

用户A操作: 在位置2插入"X" → "ABXCDE"
用户B操作: 在位置4插入"Y" → "ABCDEY"

变换逻辑:
- A 的操作不受 B 影响（插入位置在 B 之前）→ 保持不变
- B 的操作需要调整（A 在前面插入了字符，位置+1）→ 位置4变为位置5

最终结果（两端一致）: "ABXCDEY"
```

**OT 的优缺点**：

| 优点 | 缺点 |
|------|------|
| 成熟稳定（Google Docs 验证） | 需要中心化服务器协调 |
| 变换函数可精确控制 | 变换函数编写复杂（n种操作类型需要 n² 个变换函数） |
| 最终一致性有保证 | 离线编辑后合并困难 |

### 10.3 CRDT（Conflict-free Replicated Data Type）

CRDT 是一种数据结构，设计上保证**无需协调即可自动合并**。代表产品：Figma、Notion。

```mermaid
flowchart TD
    subgraph CRDT工作原理
        A[用户A: 插入字符X<br/>ID: a@t1, 值:X] --> M[自动合并]
        B[用户B: 插入字符Y<br/>ID: b@t2, 值:Y] --> M
        M --> R[确定性合并<br/>所有节点得到相同结果]
    end
```

**常见 CRDT 类型**：

| CRDT 类型 | 数据结构 | 典型应用 |
|-----------|---------|---------|
| G-Counter | 只增计数器 | 页面浏览量 |
| PN-Counter | 可增可减计数器 | 点赞数 |
| LWW-Register | 最后写入获胜 | 用户配置 |
| OR-Set | 可观察删除集合 | 标签管理 |
| RGA（Replicated Growable Array） | 有序列表 | **文本编辑** |

**文本 CRDT（RGA）核心思想**：

```
每个字符都有唯一 ID = (节点ID, 逻辑时间戳)
字符之间用 "偏序" 关系排列（而非简单的位置索引）

示例：
节点A插入: "H" @a1, "l" @a2, "l" @a3, "o" @a4
节点B插入: "e" @b1, "l" @b2

合并规则：按 ID 排序（时间戳优先，节点ID 作为 tiebreaker）
最终结果: "Hello" (H@1, e@b1, l@a2, l@b2, o@a4)
```

### 10.4 OT vs CRDT 对比

| 对比项 | OT | CRDT |
|--------|-----|------|
| 架构 | **中心化**（需要服务器） | **去中心化**（P2P 可行） |
| 合并方式 | 变换函数 | 自动合并（数学保证） |
| 实现复杂度 | 低（但变换函数难写） | 高（数据结构复杂） |
| 空间开销 | 低 | 高（需存储元数据） |
| 离线支持 | 困难 | ✅ 天然支持 |
| 实时性 | ✅ 好 | ✅ 好 |
| 代表产品 | Google Docs、OTDB | Figma、Notion、Yjs |

### 10.5 实践建议

```mermaid
flowchart TD
    A[需要协同编辑?] --> B{需要 P2P / 离线优先?}
    B -->|是| C[使用 CRDT<br/>推荐: Yjs / Automerge]
    B -->|否| D{团队规模?}
    D -->|小团队快速实现| E[使用 OT<br/>推荐: ShareDB]
    D -->|大型产品| F{功能需求?}
    F -->|纯文本编辑| E
    F -->|富媒体 / 图形| C
```

---

## 十一、WebTransport 协议简介

### 11.1 什么是 WebTransport

WebTransport 是一种基于 HTTP/3 和 QUIC 的新型 Web API，提供低延迟、可靠的双向通信。

```mermaid
flowchart LR
    subgraph 传输层对比
        A[WebSocket<br/>基于 TCP<br/>有序、可靠] --> B[WebTransport<br/>基于 QUIC/HTTP3<br/>可选可靠性]
    end
```

### 11.2 WebTransport vs WebSocket

| 对比项 | WebSocket | WebTransport |
|--------|-----------|-------------|
| 传输层 | TCP | **QUIC (UDP)** |
| 多路复用 | ❌（队头阻塞） | ✅（无队头阻塞） |
| 可靠性 | 始终可靠 | **可选**（可靠流 + 不可靠数据报） |
| 建立连接 | 1-RTT (TLS) | **0-RTT / 1-RTT** |
| 多流支持 | ❌（单流） | ✅（多个独立流） |
| 二进制支持 | ✅ | ✅ |
| 不可靠传输 | ❌ | ✅（Datagram） |
| 浏览器支持 | 所有主流浏览器 | Chrome/Edge（2023+） |
| 服务端 | 丰富 | 较新（需 QUIC 库） |

### 11.3 WebTransport 核心概念

```javascript
// 创建 WebTransport 连接
const transport = new WebTransport('https://example.com/chat');

await transport.ready;
console.log('连接已建立');

// 1. 可靠双向流（类似 WebSocket，保证顺序和送达）
const stream = await transport.createBidirectionalStream();
const writer = stream.writable.getWriter();
const reader = stream.readable.getReader();

writer.write(new TextEncoder().encode('Hello'));
const { value } = await reader.read();
console.log(new TextDecoder().decode(value));

// 2. 不可靠数据报（适合实时游戏、视频）
const datagramWriter = transport.datagrams.writable.getWriter();
const datagramReader = transport.datagrams.readable.getReader();

// 发送数据报（可能丢失，但延迟最低）
await datagramWriter.write(new Uint8Array([1, 2, 3]));

// 接收数据报
const { value: dg } = await datagramReader.read();

// 3. 多个独立流（无队头阻塞）
const stream1 = await transport.createBidirectionalStream();
const stream2 = await transport.createBidirectionalStream();
// stream1 阻塞不影响 stream2

transport.closed.then(() => console.log('连接关闭'));
```

### 11.4 适用场景

| 场景 | 推荐协议 | 原因 |
|------|---------|------|
| 聊天应用 | WebSocket | 成熟、兼容性好 |
| 实时游戏 | **WebTransport** | 不可靠数据报，低延迟 |
| 视频直播 | **WebTransport** | 丢帧可接受，延迟敏感 |
| 屏幕共享 | **WebTransport** | 多流支持，无队头阻塞 |
| IoT 设备通信 | WebTransport | 轻量、支持不可靠传输 |
| 金融数据推送 | WebSocket | 可靠性优先 |

---

## 十二、WebSocket 消息压缩（permessage-deflate）

### 12.1 压缩原理

WebSocket 支持通过 `permessage-deflate` 扩展对消息进行 zlib 压缩，减少网络传输数据量。

```mermaid
flowchart LR
    A[原始消息<br/>10KB JSON] --> B[deflate 压缩]
    B --> C[压缩后<br/>~2KB]
    C --> D[网络传输]
    D --> E[inflate 解压]
    E --> F[原始消息<br/>10KB JSON]
```

### 12.2 协商过程

```
# 客户端发起握手
GET /chat HTTP/1.1
Upgrade: websocket
Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits

# 服务器响应
HTTP/1.1 101 Switching Protocols
Sec-WebSocket-Extensions: permessage-deflate; server_max_window_bits=15
```

### 12.3 压缩参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `server_max_window_bits` | 服务器 LZ77 窗口大小 | 15（32KB） |
| `client_max_window_bits` | 客户端 LZ77 窗口大小 | 15（32KB） |
| `server_no_context_takeover` | 服务器每条消息独立压缩 | false（复用上下文） |
| `client_no_context_takeover` | 客户端每条消息独立压缩 | false（复用上下文） |

### 12.4 Node.js 服务端配置

```javascript
const WebSocket = require('ws');

// 启用 permessage-deflate
const wss = new WebSocket.Server({
  port: 8080,
  perMessageDeflate: {
    zlibDeflateOptions: {
      level: 6,          // 压缩级别 1-9（6 是平衡点）
      memLevel: 8,       // 内存使用级别
    },
    threshold: 1024,      // 消息大于 1KB 才压缩
    serverNoContextTakeover: true,  // 节省内存（每条消息独立压缩）
    clientNoContextTakeover: true,
    serverMaxWindowBits: 10,        // 减小窗口节省内存
    concurrencyLimit: 10,           // 并发压缩数
  },
});

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    // 压缩后的消息自动解压
    console.log('收到:', data.toString());

    // 发送的消息自动压缩（如果大于 threshold）
    ws.send(JSON.stringify({ large: 'x'.repeat(5000) }));
  });
});
```

### 12.5 压缩效果参考

| 数据类型 | 原始大小 | 压缩后 | 压缩比 |
|---------|---------|--------|--------|
| JSON（重复字段） | 10 KB | ~2 KB | **80%** |
| 日志文本 | 5 KB | ~1.5 KB | **70%** |
| 二进制数据 | 10 KB | ~8 KB | **20%** |
| 随机数据 | 10 KB | ~10 KB | **0%** |
| 小消息（<1KB） | 不压缩 | — | 低于 threshold |

> ⚠️ **注意事项**：`permessage-deflate` 会增加 CPU 使用和内存消耗。对于高并发场景（>1000 连接），建议设置 `threshold` 和 `serverNoContextTakeover: true` 以控制资源消耗。

---

## 十三、消息队列与 WebSocket 集成

### 13.1 为什么需要消息队列

单个 WebSocket 服务器能处理的连接数有限。当需要水平扩展（多台服务器）时，问题来了：

```
用户A 连接到 Server1
用户B 连接到 Server2

A 发消息给 B → Server1 不知道 B 在 Server2 → 消息丢失！
```

**解决方案**：用消息队列（如 Redis Pub/Sub）作为服务器间的消息中转。

### 13.2 Redis Pub/Sub 架构图

```mermaid
flowchart TD
    subgraph 客户端
        UA[用户A]
        UB[用户B]
        UC[用户C]
    end

    subgraph WebSocket 服务器集群
        WS1[WS Server 1]
        WS2[WS Server 2]
        WS3[WS Server 3]
    end

    subgraph 消息中间件
        R[(Redis Pub/Sub)]
        Q[Redis Stream / 消息队列]
    end

    UA -->|连接| WS1
    UB -->|连接| WS2
    UC -->|连接| WS3

    WS1 -->|PUBLISH channel:room1| R
    R -->|SUBSCRIBE channel:room1| WS1
    R -->|SUBSCRIBE channel:room1| WS2
    R -->|SUBSCRIBE channel:room1| WS3

    WS1 --> Q
    Q -->|持久化消息| WS2
    Q -->|持久化消息| WS3

    WS1 -.->|转发给用户A| UA
    WS2 -.->|转发给用户B| UB
    WS3 -.->|转发给用户C| UC
```

### 13.3 Node.js 实现示例

```javascript
const WebSocket = require('ws');
const Redis = require('ioredis');

// Redis 订阅者（每个 WS 服务器各一个）
const redisSub = new Redis();
const redisPub = new Redis();

const wss = new WebSocket.Server({ port: 8080 });
const rooms = new Map(); // roomId -> Set<ws>

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    switch (msg.type) {
      case 'join':
        // 加入房间
        currentRoom = msg.room;
        if (!rooms.has(currentRoom)) {
          rooms.set(currentRoom, new Set());
          // 订阅 Redis 频道
          redisSub.subscribe(`room:${currentRoom}`);
        }
        rooms.get(currentRoom).add(ws);
        break;

      case 'chat':
        // 发布消息到 Redis（所有服务器都能收到）
        redisPub.publish(`room:${currentRoom}`, JSON.stringify({
          sender: msg.sender,
          content: msg.content,
          timestamp: Date.now(),
        }));
        break;
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(ws);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
        redisSub.unsubscribe(`room:${currentRoom}`);
      }
    }
  });
});

// Redis 订阅回调：转发消息给本地连接的客户端
redisSub.on('message', (channel, message) => {
  const roomId = channel.replace('room:', '');
  const clients = rooms.get(roomId);
  if (clients) {
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
});
```

### 13.4 Redis Pub/Sub vs Redis Stream

| 对比项 | Redis Pub/Sub | Redis Stream |
|--------|--------------|-------------|
| 消息持久化 | ❌ | ✅ |
| 消息回放 | ❌ | ✅ |
| 消费者组 | ❌ | ✅ |
| 适用场景 | 实时转发（在线用户） | 离线消息、消息记录 |
| 可靠性 | 消息可能丢失 | 消息持久化 |

### 13.5 混合架构：Pub/Sub + Stream

```
实时转发 → Redis Pub/Sub（低延迟，不持久化）
消息记录 → Redis Stream（持久化，支持回放）

用户上线时 → 从 Stream 回放离线消息
用户在线时 → 通过 Pub/Sub 实时接收
```

---

## 十四、WebSocket 负载均衡策略

### 14.1 WebSocket 负载均衡的挑战

WebSocket 是长连接，与 HTTP 短连接的负载均衡完全不同：

| 挑战 | 说明 |
|------|------|
| 连接持久性 | 一旦建立，连接持续数小时甚至数天 |
| 有状态 | 每个连接关联用户状态 |
| 会话连续性 | 同一用户的消息必须路由到同一服务器（或通过消息队列同步） |

### 14.2 两种主要策略

#### 策略1：粘性会话（Sticky Session）

```mermaid
flowchart LR
    C1[用户A] --> LB[负载均衡器<br/>IP Hash / Cookie]
    C2[用户B] --> LB
    C3[用户C] --> LB
    LB -->|A 始终路由到| S1[Server 1]
    LB -->|B,C 始终路由到| S2[Server 2]
```

| 优点 | 缺点 |
|------|------|
| 实现简单 | 服务器宕机，连接断开 |
| 无需共享状态 | 负载可能不均衡 |
| 延迟低 | 扩展性差 |

```nginx
# Nginx 粘性会话配置
upstream websocket_backend {
    ip_hash;  # 基于客户端 IP 的哈希
    server ws1.example.com:8080;
    server ws2.example.com:8080;
    server ws3.example.com:8080;
}

server {
    listen 443 ssl;
    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;  # 长连接超时
    }
}
```

#### 策略2：共享状态（Shared State）

```mermaid
flowchart TD
    C1[用户A] --> LB[负载均衡器<br/>Round Robin]
    C2[用户B] --> LB
    LB --> S1[Server 1]
    LB --> S2[Server 2]
    S1 --> R[(Redis<br/>Pub/Sub)]
    S2 --> R
    R -->|消息中转| S1
    R -->|消息中转| S2
```

| 优点 | 缺点 |
|------|------|
| 负载均衡 | 需要额外基础设施（Redis） |
| 高可用（服务器宕机不影响） | 增加延迟（经过消息队列） |
| 易于水平扩展 | 实现复杂度高 |

### 14.3 负载均衡器对比

| 负载均衡器 | WebSocket 支持 | 粘性会话 | 健康检查 |
|-----------|---------------|---------|---------|
| Nginx | ✅ | ✅ (ip_hash) | ✅ |
| HAProxy | ✅ | ✅ (source / cookie) | ✅ |
| AWS ALB | ✅ | ✅ (cookie) | ✅ |
| Envoy | ✅ | ✅ (ring hash) | ✅ |
| Traefik | ✅ | ✅ (sticky cookie) | ✅ |

### 14.4 生产环境推荐

```
小规模 (<1000 连接):
  → Nginx 粘性会话，单机即可

中规模 (1000-10000 连接):
  → Nginx/HAProxy + Redis Pub/Sub
  → 共享状态架构

大规模 (>10000 连接):
  → 多层架构：CDN → LB → WS 服务器集群 → Redis Cluster
  → 考虑 WebSocket 网关（如 Socket.IO Cluster）
```

---

## 十五、WebSocket 最佳实践清单

### 15.1 完整 Checklist

#### 连接管理

- [ ] **心跳机制**：定期发送 Ping/Pong 检测连接存活
- [ ] **超时设置**：空闲连接超时自动断开
- [ ] **重连策略**：客户端自动重连（指数退避）
- [ ] **连接数限制**：单 IP / 单用户最大连接数
- [ ] **优雅关闭**：服务端关闭前通知客户端

#### 消息设计

- [ ] **消息格式统一**：使用 JSON Schema 或 Protocol Buffers
- [ ] **消息类型字段**：`{ type: "xxx", data: {...} }`
- [ ] **消息 ID**：每条消息有唯一 ID，用于去重和确认
- [ ] **消息大小限制**：设置最大消息体大小（如 64KB）
- [ ] **二进制支持**：大数据用 ArrayBuffer 传输

#### 安全

- [ ] **WSS 加密**：生产环境强制使用 `wss://`
- [ ] **认证**：连接时验证 Token（JWT / Session）
- [ ] **授权**：验证用户有权限加入指定频道/房间
- [ ] **输入校验**：所有消息内容必须校验
- [ ] **限流**：单连接消息发送速率限制
- [ ] **CORS**：限制允许的 Origin

#### 性能

- [ ] **消息压缩**：启用 `permessage-deflate`
- [ ] **批量发送**：高频消息合并后发送
- [ ] **广播优化**：避免向不相关的连接发送消息
- [ ] **连接池**：数据库/Redis 连接使用连接池
- [ ] **背压控制**：慢消费者限速

#### 可靠性

- [ ] **消息确认**：重要消息需要 ACK 确认
- [ ] **离线消息**：用户上线后接收离线期间的消息
- [ ] **消息重试**：未确认的消息自动重试
- [ ] **幂等处理**：重复消息不会产生副作用
- [ ] **日志记录**：连接事件、错误、性能指标

#### 运维

- [ ] **健康检查**：监控 WebSocket 服务器状态
- [ ] **指标采集**：连接数、消息量、延迟、错误率
- [ ] **优雅重启**：重启前迁移连接或通知客户端重连
- [ ] **水平扩展**：通过消息队列支持多服务器
- [ ] **告警**：异常连接数、高错误率告警

### 15.2 心跳实现示例

```javascript
// 服务端心跳
class WebSocketServer {
  constructor(wss) {
    this.wss = wss;

    // 每 30 秒检查一次
    this.heartbeatInterval = setInterval(() => {
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          console.log('客户端超时，断开连接');
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();  // 发送 Ping
      });
    }, 30000);

    wss.on('connection', (ws) => {
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;  // 收到 Pong，标记为活跃
      });
    });
  }
}
```

```javascript
// 客户端心跳 + 自动重连
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('已连接');
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.reconnect();
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket 错误:', err);
    };
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  stopHeartbeat() {
    clearInterval(this.heartbeatTimer);
  }

  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('重连次数超限，停止重连');
      return;
    }

    // 指数退避：1s, 2s, 4s, 8s, 16s...
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`${delay / 1000}秒后重连 (第${this.reconnectAttempts}次)`);
    setTimeout(() => this.connect(), delay);
  }
}
```

---

## 十六、WebSocket 性能测试方法

### 16.1 测试工具概览

| 工具 | 特点 | 适用场景 |
|------|------|---------|
| **wscat** | 简单命令行工具 | 手动测试、调试 |
| **websocket-bench** | 专用基准测试 | 并发连接测试 |
| **artillery** | 功能丰富，支持 WS | 场景化压测 |
| **k6** | 脚本化压测 | CI/CD 集成 |
| **locust** | Python 编写，Web UI | 可视化压测 |

### 16.2 wscat 快速测试

```bash
# 安装
npm install -g wscat

# 连接 WebSocket 服务器
wscat -c ws://localhost:8080

# 带认证头连接
wscat -c ws://localhost:8080 -H "Authorization: Bearer xxx"

# 发送消息
> {"type":"chat","content":"Hello!"}

# 批量发送（脚本化）
echo '{"type":"chat","content":"test"}' | wscat -c ws://localhost:8080 -x
```

### 16.3 artillery 压测配置

```yaml
# artillery-ws-test.yml
config:
  target: "ws://localhost:8080"
  phases:
    - duration: 10        # 10秒内逐渐增加到100个连接
      arrivalRate: 10
    - duration: 30        # 持续30秒，每秒10个新连接
      arrivalRate: 10
    - duration: 10        # 10秒内逐渐减少
      arrivalRate: 1
  ws:
    # WebSocket 特定配置
    subprotocols: []
  environments:
    production:
      target: "wss://ws.example.com"

scenarios:
  - engine: "ws"
    flow:
      - connect:
          headers:
            Authorization: "Bearer {{ $randomNumber() }}"
      - send:
          payload: '{"type":"join","room":"test-room"}'
      - think: 1
      - send:
          payload: '{"type":"chat","content":"Hello from {{ $randomNumber() }}"}'
      - think: 2
      - send:
          payload: '{"type":"chat","content":"Another message"}'
```

```bash
# 运行压测
artillery run artillery-ws-test.yml

# 生成报告
artillery report artillery-ws-test.yml
```

### 16.4 k6 压测脚本

```javascript
// k6-ws-test.js
import ws from 'k6/ws';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 100 },   // 10秒内增加到100 VU
    { duration: '30s', target: 100 },   // 持续30秒
    { duration: '10s', target: 0 },     // 10秒内减少到0
  ],
  thresholds: {
    ws_connecting: ['p(95)<500'],        // 95%的连接建立时间<500ms
    ws_msgs_received: ['count>1000'],   // 至少接收1000条消息
  },
};

export default function () {
  const url = 'ws://localhost:8080';
  const res = ws.connect(url, (socket) => {
    socket.on('open', () => {
      console.log('连接已建立');

      // 加入房间
      socket.send(JSON.stringify({ type: 'join', room: 'test' }));

      // 定时发送消息
      for (let i = 0; i < 10; i++) {
        socket.send(JSON.stringify({
          type: 'chat',
          content: `Message ${i}`,
        }));
        sleep(1);
      }
    });

    socket.on('message', (data) => {
      check(data, {
        '消息非空': (d) => d.length > 0,
      });
    });

    socket.on('close', () => console.log('连接关闭'));
    socket.setTimeout(() => socket.close(), 15000);
  });

  check(res, { '状态为101': (r) => r && r.status === 101 });
}
```

```bash
# 运行 k6 压测
k6 run k6-ws-test.js

# 输出示例
# ✓ ws_connecting..............avg=45ms   p(95)=120ms
# ✓ ws_msgs_received...........count=5240
# ✓ ws_session_duration........avg=15.2s
# ✓ ws_sessions................count=100
```

### 16.5 性能指标说明

| 指标 | 说明 | 参考值 |
|------|------|--------|
| **连接建立时间** | TCP + WS 握手耗时 | < 200ms (同机房) |
| **消息延迟** | 发送到接收的端到端延迟 | < 50ms (同机房) |
| **最大并发连接** | 单机能维持的最大连接数 | 10K-100K (取决于配置) |
| **消息吞吐量** | 每秒处理的消息数 | 10K-100K msg/s |
| **内存占用** | 每个连接的内存开销 | 2-10KB / 连接 |
| **CPU 使用率** | 压测期间 CPU 占用 | < 80% |
| **消息丢失率** | 丢失消息占比 | 0%（可靠连接） |

### 16.6 性能优化建议

```
1. 操作系统层面：
   - 调整文件描述符限制：ulimit -n 100000
   - TCP 参数优化：tcp_tw_reuse, tcp_fin_timeout

2. 应用层面：
   - 使用 epoll/kqueue（非阻塞 I/O）
   - 消息批量发送（合并小消息）
   - 启用 permessage-deflate（大于1KB的消息）
   - 避免 JSON.parse/stringify 热点路径

3. 架构层面：
   - 水平扩展 + Redis Pub/Sub
   - 使用 sticky session 或共享状态
   - CDN 边缘 WebSocket（如 Cloudflare Durable Objects）
```

---

*本章节涵盖了实时协作算法、WebTransport、消息压缩、消息队列集成、负载均衡、最佳实践和性能测试等高级 WebSocket 主题。掌握这些内容将帮助你构建生产级的实时通信系统。*

---

## 十七、WebSocket 安全防护

### 17.1 WebSocket 安全威胁

| 威胁 | 说明 | 防御措施 |
|------|------|---------|
| **跨站 WebSocket 劫持（CSWSH）** | 恶意网站发起 WS 连接 | 验证 Origin 头 |
| **注入攻击** | 恶意消息内容 | 输入校验 + 转义 |
| **DoS 攻击** | 大量连接耗尽资源 | 连接数限制 + 速率限制 |
| **中间人攻击** | 窃听未加密的 WS | 强制使用 wss:// |
| **消息篡改** | 修改传输中的消息 | TLS 加密 + 消息签名 |

### 17.2 Origin 验证

```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({
  port: 8080,
  // 验证 Origin
  verifyClient: (info, callback) => {
    const origin = info.origin || info.req.headers.origin;
    const allowedOrigins = [
      'https://example.com',
      'https://app.example.com',
      'http://localhost:3000',  // 开发环境
    ];

    if (allowedOrigins.includes(origin)) {
      callback(true);  // 允许连接
    } else {
      callback(false, 403, 'Forbidden Origin');  // 拒绝连接
    }
  },
});
```

### 17.3 认证与授权

```javascript
// 方式1：连接时通过查询参数传递 Token
const wss = new WebSocket.Server({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, 'http://localhost');
  const token = url.searchParams.get('token');

  // 验证 JWT Token
  try {
    const user = jwt.verify(token, SECRET_KEY);
    request.user = user;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } catch (err) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
  }
});

// 方式2：连接后第一条消息认证
wss.on('connection', (ws) => {
  let authenticated = false;

  // 设置认证超时（5秒内必须完成认证）
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      ws.close(4001, 'Authentication timeout');
    }
  }, 5000);

  ws.on('message', (data) => {
    if (!authenticated) {
      // 第一条消息必须是认证消息
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'auth') {
          const user = jwt.verify(msg.token, SECRET_KEY);
          ws.user = user;
          authenticated = true;
          clearTimeout(authTimeout);
          ws.send(JSON.stringify({ type: 'auth_success' }));
        } else {
          ws.close(4002, 'Authentication required');
        }
      } catch (err) {
        ws.close(4003, 'Invalid token');
      }
      return;
    }

    // 已认证，正常处理消息
    handleMessage(ws, data);
  });
});
```

### 17.4 消息速率限制

```javascript
class RateLimiter {
  constructor(maxMessages, windowMs) {
    this.maxMessages = maxMessages;
    this.windowMs = windowMs;
    this.clients = new Map(); // ws -> { count, resetTime }
  }

  check(ws) {
    const now = Date.now();
    let client = this.clients.get(ws);

    if (!client || now > client.resetTime) {
      client = { count: 0, resetTime: now + this.windowMs };
      this.clients.set(ws, client);
    }

    client.count++;

    if (client.count > this.maxMessages) {
      return false; // 超过限制
    }
    return true;
  }

  remove(ws) {
    this.clients.delete(ws);
  }
}

// 使用：每秒最多10条消息
const limiter = new RateLimiter(10, 1000);

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    if (!limiter.check(ws)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Rate limit exceeded'
      }));
      return;
    }
    // 处理消息...
  });

  ws.on('close', () => limiter.remove(ws));
});
```

### 17.5 消息大小限制

```javascript
const wss = new WebSocket.Server({
  port: 8080,
  maxPayload: 64 * 1024,  // 最大消息体 64KB
});

// 或者在连接级别检查
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    if (data.length > 65536) {  // 64KB
      ws.send(JSON.stringify({ type: 'error', message: 'Message too large' }));
      return;
    }
    // 处理消息...
  });
});
```

### 17.6 安全配置 Checklist

```
✅ 强制使用 wss://（TLS 加密）
✅ 验证 Origin 头（防止 CSWSH）
✅ 连接时认证（JWT / Session Token）
✅ 消息速率限制（防 DoS）
✅ 消息大小限制（防内存耗尽）
✅ 输入校验和转义（防注入）
✅ 连接数限制（单 IP / 单用户）
✅ 日志记录（连接/断开/错误）
✅ 超时断开（空闲连接回收）
✅ 优雅降级（服务器过载时拒绝新连接）
```

---

## 十八、WebSocket 调试工具

### 18.1 浏览器开发者工具

Chrome DevTools 的 WebSocket 调试功能：

```
1. 打开 Chrome DevTools (F12)
2. 切换到 Network 标签
3. 筛选 WS（点击 "WS" 过滤器）
4. 点击具体的 WebSocket 连接
5. 查看：
   - Messages 标签：所有收发的消息
   - 点击消息可查看详情
   - 绿色箭头 = 发送，红色箭头 = 接收
   - 支持消息搜索和过滤
```

### 18.2 命令行调试工具

```bash
# wscat：交互式 WebSocket 客户端
npm install -g wscat

# 基本连接
wscat -c ws://localhost:8080

# 带认证头
wscat -c ws://localhost:8080 -H "Authorization: Bearer token123"

# 发送消息
> {"type":"ping"}

# websocat：更强大的命令行工具
# 安装（macOS）
brew install websocat

# 连接并发送文件
websocat ws://localhost:8080 < message.json

# 二进制模式
websocat --binary ws://localhost:8080

# 带日志
websocat -v ws://localhost:8080  # -v 显示详细日志
```

### 18.3 Wireshark 抓包分析

```bash
# 捕获 WebSocket 流量
# 过滤器：tcp.port == 8080

# 如果使用 wss://（加密），需要配置 TLS 解密：
# 1. 设置环境变量 SSLKEYLOGFILE
export SSLKEYLOGFILE=~/sslkeylog.txt

# 2. 在 Wireshark 中配置：
# Edit → Preferences → Protocols → TLS → (Pre)-Master-Secret log filename
# 填入 ~/sslkeylog.txt

# 3. 重新启动浏览器，开始抓包
```

### 18.4 常见问题排查

| 问题 | 可能原因 | 排查方法 |
|------|---------|---------|
| 连接失败 (ECONNREFUSED) | 服务未启动 / 端口错误 | `netstat -tlnp` 检查端口 |
| 403 Forbidden | Origin 验证失败 | 检查请求头 Origin |
| 401 Unauthorized | Token 无效 / 过期 | 验证 Token 有效性 |
| 连接立即断开 | 服务端代码异常 | 查看服务端日志 |
| 消息发送失败 | 连接已关闭 | 检查 `readyState` |
| 高延迟 | 网络问题 / 服务端处理慢 | 测量 RTT / 检查服务端性能 |
| 内存泄漏 | 事件监听器未清理 | `ws.on('close', cleanup)` |

### 18.5 消息日志记录

```javascript
// 生产环境 WebSocket 消息日志
const fs = require('fs');
const logStream = fs.createWriteStream('ws-messages.log', { flags: 'a' });

function logMessage(direction, ws, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    direction,  // 'in' or 'out'
    userId: ws.user?.id,
    ip: ws._socket.remoteAddress,
    size: data.length,
    type: (() => {
      try { return JSON.parse(data).type; } catch { return 'binary'; }
    })(),
  };
  logStream.write(JSON.stringify(entry) + '\n');
}

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    logMessage('in', ws, data);
    // 处理消息...
  });

  const originalSend = ws.send.bind(ws);
  ws.send = (data) => {
    logMessage('out', ws, data);
    return originalSend(data);
  };
});
```

---

*本章节还涵盖了 WebSocket 安全防护、调试工具等实用内容，帮助你在生产环境中构建安全可靠的实时通信系统。*

---

## 14.11 WebSocket 连接生命周期管理

WebSocket 连接的生命周期管理是生产环境中最重要的工程实践，包括连接建立、心跳保活、断线重连和优雅关闭。

### 14.11.1 连接状态机

```mermaid
stateDiagram-v2
    [*] --> Disconnected
    
    Disconnected --> Connecting: connect()
    Connecting --> Connected: onopen
    Connecting --> Disconnected: onerror / 超时
    
    Connected --> Connected: 收到 PONG / 消息
    Connected --> Reconnecting: onclose (意外断开)
    Connected --> Closing: close()
    Connected --> Reconnecting: 心跳超时
    
    Reconnecting --> Connecting: 重连延迟结束
    Reconnecting --> Disconnected: 超过最大重连次数
    
    Closing --> Disconnected: onclose (优雅关闭)
    
    Connected --> [*]: 手动断开
    Disconnected --> [*]: 手动断开
```

### 14.11.2 完整的 WebSocket 管理器

```typescript
interface WebSocketManagerOptions {
  url: string;
  protocols?: string | string[];
  heartbeatInterval?: number;     // 心跳间隔（ms），默认 30000
  heartbeatTimeout?: number;      // 心跳超时（ms），默认 5000
  reconnectInterval?: number;     // 重连间隔（ms），默认 1000
  maxReconnectAttempts?: number;  // 最大重连次数，默认 10
  reconnectDecay?: number;        // 重连退避因子，默认 1.5
}

enum WsState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  CLOSING = 'CLOSING'
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private state: WsState = WsState.DISCONNECTED;
  private reconnectAttempts = 0;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<string, Set<Function>>();

  private options: Required<WebSocketManagerOptions>;

  constructor(options: WebSocketManagerOptions) {
    this.options = {
      heartbeatInterval: 30000,
      heartbeatTimeout: 5000,
      reconnectInterval: 1000,
      maxReconnectAttempts: 10,
      reconnectDecay: 1.5,
      protocols: undefined as any,
      ...options
    };
  }

  // ===== 连接管理 =====
  
  connect(): void {
    if (this.state === WsState.CONNECTED || this.state === WsState.CONNECTING) {
      return;
    }

    this.state = WsState.CONNECTING;
    this.emit('stateChange', this.state);

    try {
      this.ws = new WebSocket(this.options.url, this.options.protocols);
      this.setupEventHandlers();
    } catch (error) {
      this.handleError(error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.state = WsState.CONNECTED;
      this.reconnectAttempts = 0;
      this.emit('stateChange', this.state);
      this.emit('open');
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onclose = (event) => {
      this.stopHeartbeat();
      
      if (this.state === WsState.CLOSING) {
        // 优雅关闭，不重连
        this.state = WsState.DISCONNECTED;
        this.emit('stateChange', this.state);
        this.emit('close', event);
      } else {
        // 意外断开，尝试重连
        this.state = WsState.RECONNECTING;
        this.emit('stateChange', this.state);
        this.emit('disconnect', event);
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      this.emit('error', event);
    };
  }

  // ===== 心跳机制 =====

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.state !== WsState.CONNECTED) return;
      
      // 发送 PING
      this.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      
      // 设置 PONG 超时
      this.heartbeatTimeoutTimer = setTimeout(() => {
        // PONG 超时，连接可能已断开
        this.ws?.close();
      }, this.options.heartbeatTimeout);
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      // 处理 PONG 响应
      if (message.type === 'PONG') {
        if (this.heartbeatTimeoutTimer) {
          clearTimeout(this.heartbeatTimeoutTimer);
          this.heartbeatTimeoutTimer = null;
        }
        return;
      }
      
      this.emit('message', message);
    } catch {
      // 非 JSON 消息
      this.emit('rawMessage', data);
    }
  }

  // ===== 重连机制（指数退避）=====

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.state = WsState.DISCONNECTED;
      this.emit('stateChange', this.state);
      this.emit('reconnectFailed');
      return;
    }

    // 指数退避 + 随机抖动
    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(this.options.reconnectDecay, this.reconnectAttempts),
      30000  // 最大 30 秒
    );
    const jitter = delay * (0.5 + Math.random() * 0.5); // 添加随机抖动

    this.reconnectAttempts++;
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay: jitter });

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, jitter);
  }

  // ===== 消息发送 =====

  send(data: string | object): boolean {
    if (this.state !== WsState.CONNECTED || !this.ws) {
      return false;
    }

    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.ws.send(payload);
    return true;
  }

  // ===== 优雅关闭 =====

  close(code: number = 1000, reason: string = 'Client closing'): void {
    this.state = WsState.CLOSING;
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(code, reason);
    }
  }

  // ===== 事件系统 =====

  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(...args); } catch (e) { console.error('Listener error:', e); }
    });
  }

  private handleError(error: any): void {
    this.state = WsState.DISCONNECTED;
    this.emit('stateChange', this.state);
    this.emit('error', error);
    this.scheduleReconnect();
  }

  get currentState(): WsState {
    return this.state;
  }
}
```

**使用示例：**

```typescript
const ws = new WebSocketManager({
  url: 'wss://api.example.com/ws',
  heartbeatInterval: 25000,
  maxReconnectAttempts: 5
});

ws.on('open', () => console.log('✅ 已连接'));
ws.on('message', (msg) => console.log('📨 收到:', msg));
ws.on('reconnecting', ({ attempt, delay }) => {
  console.log(`🔄 第 ${attempt} 次重连，${(delay/1000).toFixed(1)}s 后...`);
});
ws.on('reconnectFailed', () => console.error('❌ 重连失败'));
ws.on('stateChange', (state) => console.log('📊 状态:', state));

ws.connect();
```

### 14.11.3 心跳机制最佳实践

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Server as 服务器
    
    Note over Client,Server: 连接已建立
    
    loop 每 25 秒
        Client->>Server: PING (timestamp)
        Server-->>Client: PONG (timestamp)
        Note over Client: 收到 PONG，重置超时计时器
    end
    
    Note over Client: PONG 超时（5秒无响应）
    Client->>Client: 关闭连接
    Client->>Client: 触发重连流程
```

**心跳配置建议：**

| 场景 | 心跳间隔 | 超时时间 | 说明 |
|------|---------|---------|------|
| 移动 App | 25-30s | 5s | 考虑省电 |
| Web 页面 | 30-45s | 5s | 标准配置 |
| 高频交易 | 5-10s | 2s | 低延迟要求 |
| IoT 设备 | 60-120s | 10s | 省电优先 |

---

## 14.12 WebSocket 消息序列化方案

### 14.12.1 常见序列化格式对比

| 格式 | 编码大小 | 编码速度 | 解码速度 | 浏览器支持 | 可读性 |
|------|---------|---------|---------|-----------|--------|
| **JSON** | 大 | 快 | 快 | ✅ 原生 | ⭐ 最好 |
| **MessagePack** | 小 | 很快 | 很快 | 需库 | ❌ 二进制 |
| **Protobuf** | ⭐ 最小 | ⭐ 最快 | ⭐ 最快 | 需库 | ❌ 二进制 |
| **CBOR** | 小 | 快 | 快 | 需库 | ❌ 二进制 |
| **Avro** | 小 | 快 | 快 | 需库 | ❌ 二进制 |

**性能基准测试（1000 条消息）：**

| 格式 | 编码时间 | 解码时间 | 数据大小 | 压缩率 |
|------|---------|---------|---------|--------|
| JSON | 12ms | 15ms | 48.2 KB | 100% |
| MessagePack | 8ms | 9ms | 32.1 KB | 67% |
| Protobuf | 5ms | 6ms | 24.8 KB | 51% |

### 14.12.2 JSON 方案（默认推荐）

```typescript
// JSON 消息协议设计
interface WsMessage<T = any> {
  id: string;           // 消息唯一 ID（用于请求-响应匹配）
  type: string;         // 消息类型
  payload: T;           // 消息体
  timestamp: number;    // 时间戳
  version?: number;     // 协议版本
}

// 使用示例
const message: WsMessage = {
  id: crypto.randomUUID(),
  type: 'chat.send',
  payload: {
    roomId: 'room_123',
    content: 'Hello!',
    contentType: 'text'
  },
  timestamp: Date.now(),
  version: 1
};

ws.send(JSON.stringify(message));
```

### 14.12.3 MessagePack 方案

```typescript
import { encode, decode } from '@msgpack/msgpack';

// 发送二进制消息
function sendBinary(ws: WebSocket, data: object): void {
  const encoded = encode(data);
  ws.send(encoded.buffer);
}

// 接收二进制消息
ws.onmessage = async (event) => {
  if (event.data instanceof ArrayBuffer) {
    const decoded = decode(new Uint8Array(event.data));
    handleMessage(decoded);
  }
};
```

### 14.12.4 Protobuf 方案

```protobuf
// messages.proto
syntax = "proto3";

message WsEnvelope {
  string id = 1;
  MessageType type = 2;
  bytes payload = 3;
  int64 timestamp = 4;
}

enum MessageType {
  CHAT_SEND = 0;
  CHAT_RECEIVE = 1;
  USER_TYPING = 2;
  HEARTBEAT = 3;
}

message ChatPayload {
  string room_id = 1;
  string content = 2;
  string content_type = 3;
}
```

```typescript
import { WsEnvelope, ChatPayload } from './generated/messages';

// 编码
const chatPayload = ChatPayload.create({
  roomId: 'room_123',
  content: 'Hello!',
  contentType: 'text'
});

const envelope = WsEnvelope.create({
  id: crypto.randomUUID(),
  type: MessageType.CHAT_SEND,
  payload: ChatPayload.encode(chatPayload).finish(),
  timestamp: Date.now()
});

ws.send(WsEnvelope.encode(envelope).finish());

// 解码
ws.onmessage = (event) => {
  const envelope = WsEnvelope.decode(new Uint8Array(event.data));
  const payload = ChatPayload.decode(envelope.payload);
};
```

### 14.12.5 选择建议

```mermaid
flowchart TD
    Start{选择序列化方案} --> Q1{需要跨语言?}
    Q1 -->|是| Q2{性能要求极高?}
    Q2 -->|是| Protobuf[✅ Protobuf]
    Q2 -->|否| Q3{需要 Schema?}
    Q3 -->|是| Protobuf
    Q3 -->|否| MsgPack[✅ MessagePack]
    
    Q1 -->|否| Q4{浏览器端?}
    Q4 -->|是| Q5{消息量大?}
    Q5 -->|超过 100条/秒| MsgPack
    Q5 -->|正常| JSON[✅ JSON]
    Q4 -->|否| Protobuf
```

---

## 14.13 多房间 / 多频道架构设计

### 14.13.1 命名空间与频道

```mermaid
graph TB
    WS[WebSocket 连接] --> NS1[命名空间: /chat]
    WS --> NS2[命名空间: /notification]
    WS --> NS3[命名空间: /live]
    
    NS1 --> CH1[频道: room_general]
    NS1 --> CH2[频道: room_tech]
    NS1 --> CH3[频道: room_random]
    
    NS2 --> CH4[频道: user_123]
    
    NS3 --> CH5[频道: stream_456]
    
    style WS fill:#FF6B35,color:#fff
    style NS1 fill:#2196F3,color:#fff
    style NS2 fill:#4CAF50,color:#fff
    style NS3 fill:#9C27B0,color:#fff
```

### 14.13.2 Socket.IO 风格的实现

```typescript
import { Server, Socket } from 'socket.io';

const io = new Server(httpServer, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 5000
});

// ===== 频道管理器 =====
class ChannelManager {
  private channels = new Map<string, Set<string>>();

  join(channel: string, socketId: string): void {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(socketId);
  }

  leave(channel: string, socketId: string): void {
    this.channels.get(channel)?.delete(socketId);
    if (this.channels.get(channel)?.size === 0) {
      this.channels.delete(channel);
    }
  }

  getClients(channel: string): string[] {
    return Array.from(this.channels.get(channel) || []);
  }

  getChannels(socketId: string): string[] {
    const result: string[] = [];
    for (const [channel, clients] of this.channels) {
      if (clients.has(socketId)) {
        result.push(channel);
      }
    }
    return result;
  }
}

const channelManager = new ChannelManager();

// ===== 命名空间：聊天 =====
const chatNs = io.of('/chat');

chatNs.use(async (socket, next) => {
  // Token 认证
  const token = socket.handshake.auth.token;
  try {
    const user = await verifyToken(token);
    socket.data.user = user;
    next();
  } catch {
    next(new Error('认证失败'));
  }
});

chatNs.on('connection', (socket: Socket) => {
  const user = socket.data.user;
  console.log(`用户 ${user.name} 连接到聊天`);

  // 加入房间
  socket.on('join:room', (roomId: string) => {
    socket.join(roomId);
    channelManager.join(roomId, socket.id);
    
    // 通知房间其他人
    socket.to(roomId).emit('user:joined', {
      userId: user.id,
      userName: user.name,
      timestamp: Date.now()
    });
    
    // 返回房间信息
    socket.emit('room:info', {
      roomId,
      members: channelManager.getClients(roomId).length
    });
  });

  // 离开房间
  socket.on('leave:room', (roomId: string) => {
    socket.leave(roomId);
    channelManager.leave(roomId, socket.id);
    
    socket.to(roomId).emit('user:left', {
      userId: user.id,
      userName: user.name,
      timestamp: Date.now()
    });
  });

  // 发送消息（带房间路由）
  socket.on('message:send', async (data: {
    roomId: string;
    content: string;
    type: 'text' | 'image' | 'file';
  }) => {
    const message = {
      id: crypto.randomUUID(),
      roomId: data.roomId,
      senderId: user.id,
      senderName: user.name,
      content: data.content,
      type: data.type,
      timestamp: Date.now()
    };

    // 存储消息
    await saveMessage(message);
    
    // 广播给房间所有人（包括发送者）
    chatNs.to(data.roomId).emit('message:receive', message);
    
    // 同时发送给离线用户的推送通知
    const offlineMembers = await getOfflineMembers(data.roomId, user.id);
    if (offlineMembers.length > 0) {
      await sendPushNotifications(offlineMembers, message);
    }
  });

  // 正在输入
  socket.on('typing:start', (roomId: string) => {
    socket.to(roomId).emit('typing:update', {
      userId: user.id,
      userName: user.name,
      isTyping: true
    });
  });

  socket.on('typing:stop', (roomId: string) => {
    socket.to(roomId).emit('typing:update', {
      userId: user.id,
      userName: user.name,
      isTyping: false
    });
  });

  // 断开连接
  socket.on('disconnect', () => {
    const channels = channelManager.getChannels(socket.id);
    channels.forEach(channel => {
      channelManager.leave(channel, socket.id);
      socket.to(channel).emit('user:left', {
        userId: user.id,
        userName: user.name,
        timestamp: Date.now()
      });
    });
  });
});

// ===== 命名空间：通知 =====
const notifyNs = io.of('/notification');

notifyNs.on('connection', (socket: Socket) => {
  // 每个用户自动加入自己的通知频道
  const userId = socket.data.user.id;
  socket.join(`user:${userId}`);
  
  socket.on('disconnect', () => {
    console.log(`用户 ${userId} 断开通知连接`);
  });
});

// 从其他服务发送通知
function sendNotification(userId: string, notification: object) {
  notifyNs.to(`user:${userId}`).emit('notification', notification);
}
```

### 14.13.3 消息路由架构

```mermaid
graph TB
    Client[客户端] -->|WebSocket| Gateway[WS 网关]
    
    Gateway --> Router{消息路由器}
    
    Router -->|type=chat| ChatHandler[聊天处理器]
    Router -->|type=notification| NotifyHandler[通知处理器]
    Router -->|type=presence| PresenceHandler[在线状态处理器]
    
    ChatHandler --> RoomService[房间服务]
    ChatHandler --> MessageStore[(消息存储)]
    
    NotifyHandler --> PushService[推送服务]
    
    PresenceHandler --> RedisPubSub[Redis Pub/Sub]
    
    subgraph 多实例部署
        Instance1[WS 实例 1] <-->|Redis Pub/Sub| Instance2[WS 实例 2]
        Instance2 <-->|Redis Pub/Sub| Instance3[WS 实例 3]
    end
    
    style Gateway fill:#FF6B35,color:#fff
    style Router fill:#2196F3,color:#fff
```

```typescript
// Redis Pub/Sub 多实例消息同步
import Redis from 'ioredis';

const pub = new Redis();
const sub = new Redis();

// 订阅频道消息
sub.subscribe('chat:broadcast');

sub.on('message', (channel, message) => {
  const data = JSON.parse(message);
  
  // 广播给本实例连接的客户端
  if (data.targetRoom) {
    io.of('/chat').to(data.targetRoom).emit('message:receive', data.message);
  }
});

// 发布消息到其他实例
async function broadcastToRoom(roomId: string, message: object) {
  // 先发给本实例
  io.of('/chat').to(roomId).emit('message:receive', message);
  
  // 再发布到 Redis，通知其他实例
  await pub.publish('chat:broadcast', JSON.stringify({
    targetRoom: roomId,
    message,
    sourceInstance: INSTANCE_ID
  }));
}
```

---

## 14.14 WebSocket 安全最佳实践

### 14.14.1 安全威胁与防护

| 威胁 | 描述 | 防护措施 |
|------|------|---------|
| **跨站 WebSocket 劫持** | 恶意网站发起 WS 连接 | Origin 检查 |
| **未授权访问** | 无认证即可连接 | Token 认证 |
| **消息注入** | 注入恶意消息内容 | 消息验证 + 转义 |
| **DoS 攻击** | 大量连接耗尽资源 | 速率限制 + 连接数限制 |
| **数据泄露** | 敏感信息通过 WS 传输 | WSS 加密 |

### 14.14.2 Origin 检查

```typescript
import { Server } from 'socket.io';

const ALLOWED_ORIGINS = [
  'https://example.com',
  'https://app.example.com',
  'http://localhost:3000'  // 仅开发环境
];

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('不允许的来源'));
      }
    },
    credentials: true
  }
});
```

### 14.14.3 Token 认证

```typescript
// 方式 1：连接时通过 auth 传递 Token
const socket = io('wss://api.example.com', {
  auth: { token: 'eyJhbG...' }
});

// 服务端验证
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('缺少认证 Token'));
  }

  try {
    const payload = await verifyJWT(token);
    
    // 检查 Token 是否在黑名单中
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return next(new Error('Token 已失效'));
    }
    
    socket.data.user = payload;
    next();
  } catch (err) {
    next(new Error('Token 无效或已过期'));
  }
});

// 方式 2：通过查询参数传递（不推荐，Token 会出现在 URL 中）
// wss://api.example.com?token=eyJhbG...
```

### 14.14.4 消息大小限制与速率限制

```typescript
import { Server } from 'socket.io';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const io = new Server(httpServer, {
  // 消息大小限制
  maxHttpBufferSize: 1e6,  // 1MB
});

// 速率限制器
const rateLimiter = new RateLimiterMemory({
  points: 100,     // 每个时间窗口允许的消息数
  duration: 60,    // 时间窗口（秒）
});

// 连接数限制
const connectionLimiter = new RateLimiterMemory({
  points: 5,       // 每个 IP 最多 5 个连接
  duration: 1,     // 每秒
});

io.use(async (socket, next) => {
  const ip = socket.handshake.address;
  
  try {
    await connectionLimiter.consume(ip);
    next();
  } catch {
    next(new Error('连接过于频繁'));
  }
});

io.on('connection', (socket) => {
  // 消息速率限制
  socket.use(async ([event, ...args], next) => {
    try {
      await rateLimiter.consume(socket.data.user.id);
      next();
    } catch {
      next(new Error('消息发送过于频繁'));
    }
  });

  // 消息内容验证
  socket.on('message:send', (data) => {
    // 验证消息大小
    if (JSON.stringify(data).length > 10000) {
      socket.emit('error', { message: '消息过长' });
      return;
    }
    
    // 验证消息格式
    if (!data.roomId || !data.content) {
      socket.emit('error', { message: '消息格式错误' });
      return;
    }
    
    // XSS 过滤
    data.content = sanitizeHtml(data.content);
    
    // 处理消息...
  });
});
```

### 14.14.5 完整安全配置清单

```typescript
const io = new Server(httpServer, {
  // 传输安全
  transports: ['websocket'],        // 禁用 polling（可选）
  serveClient: false,                // 不提供客户端文件
  
  // 连接限制
  maxHttpBufferSize: 1e6,            // 1MB 消息上限
  connectTimeout: 10000,             // 连接超时 10s
  
  // CORS
  cors: {
    origin: allowOriginCheck,
    credentials: true,
    methods: ['GET', 'POST']
  },
  
  // Cookie（用于 sticky sessions）
  cookie: {
    name: 'io',
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  }
});
```

---

## 14.15 实时应用场景架构

### 14.15.1 在线协作编辑（如 Google Docs）

```mermaid
graph TB
    subgraph 客户端
        Editor[编辑器] --> OT[OT 算法模块]
        OT --> WSC1[WebSocket 客户端]
    end
    
    subgraph 服务器
        WSS[WebSocket 服务器] --> OTS[OT 服务器模块]
        OTS --> DocStore[(文档存储)]
        OTS --> VerStore[(版本历史)]
        OTS --> PubSub[Redis Pub/Sub]
    end
    
    WSC1 <-->|操作变换| WSS
    
    subgraph 冲突解决
        OT -->|本地操作| Transform[操作变换]
        Transform -->|变换后操作| Server[发送到服务器]
        Server -->|广播| Others[其他客户端]
    end
    
    style OTS fill:#2196F3,color:#fff
```

**核心概念：OT（Operational Transformation）**

```typescript
// 简化的 OT 操作
interface TextOperation {
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
}

// 操作变换示例
function transform(opA: TextOperation, opB: TextOperation): TextOperation {
  // 两个用户同时编辑：
  // 用户 A: 在位置 5 插入 "Hello"
  // 用户 B: 在位置 3 插入 "World"
  
  // 变换后的操作需要考虑对方的操作
  if (opA.type === 'insert' && opB.type === 'insert') {
    if (opA.position <= opB.position) {
      // A 的位置在 B 前面，B 需要后移
      return { ...opB, position: opB.position + opA.content!.length };
    } else {
      // A 的位置在 B 后面，A 需要后移
      return { ...opA, position: opA.position + opB.content!.length };
    }
  }
  
  // ... 其他情况的变换逻辑
}
```

### 14.15.2 即时通讯系统

```mermaid
graph TB
    subgraph 客户端层
        App1[移动端 App]
        App2[Web 端]
        App3[桌面端]
    end
    
    subgraph 网关层
        LB[负载均衡]
        WS1[WS 实例 1]
        WS2[WS 实例 2]
        WS3[WS 实例 3]
    end
    
    subgraph 服务层
        MsgSvc[消息服务]
        UserSvc[用户服务]
        PushSvc[推送服务]
        FileSvc[文件服务]
    end
    
    subgraph 存储层
        MongoDB[(MongoDB<br/>消息存储)]
        Redis[(Redis<br/>在线状态/缓存)]
        S3[(S3<br/>文件存储)]
        MQ[(消息队列)]
    end
    
    App1 & App2 & App3 --> LB
    LB --> WS1 & WS2 & WS3
    
    WS1 & WS2 & WS3 <-->|Redis Pub/Sub| Redis
    
    MsgSvc --> MongoDB
    MsgSvc --> MQ
    PushSvc --> MQ
    UserSvc --> Redis
    FileSvc --> S3
    
    style LB fill:#FF6B35,color:#fff
    style Redis fill:#f44336,color:#fff
```

**消息可靠投递：**

```typescript
// 客户端消息发送（带确认机制）
async function sendMessage(message: ChatMessage): Promise<boolean> {
  const messageId = crypto.randomUUID();
  
  return new Promise((resolve) => {
    // 设置超时
    const timeout = setTimeout(() => {
      resolve(false); // 超时未确认
    }, 10000);
    
    // 监听服务器确认
    socket.once(`ack:${messageId}`, () => {
      clearTimeout(timeout);
      resolve(true);
    });
    
    // 发送消息
    socket.emit('message:send', {
      ...message,
      id: messageId,
      clientTimestamp: Date.now()
    });
    
    // 本地乐观更新
    addMessageToUI({ ...message, id: messageId, status: 'sending' });
  });
}

// 服务器端确认机制
socket.on('message:send', async (data) => {
  try {
    await saveMessage(data);
    
    // 确认消息已收到
    socket.emit(`ack:${data.id}`);
    
    // 更新发送者 UI 状态
    socket.emit('message:status', {
      id: data.id,
      status: 'delivered'
    });
    
    // 广播给目标用户
    broadcastToUser(data.recipientId, 'message:receive', data);
  } catch (error) {
    socket.emit('message:error', {
      id: data.id,
      error: '发送失败'
    });
  }
});
```

### 14.15.3 实时数据推送（如股票行情）

```mermaid
graph LR
    DataSource[数据源] -->|WebSocket| Gateway[数据网关]
    Gateway --> Redis[Redis Pub/Sub]
    Redis --> WS1[WS 实例 1]
    Redis --> WS2[WS 实例 2]
    
    WS1 --> C1[订阅 AAPL 的客户端]
    WS1 --> C2[订阅 GOOGL 的客户端]
    WS2 --> C3[订阅 AAPL 的客户端]
    
    subgraph 数据聚合
        Gateway --> Aggregator[聚合器]
        Aggregator -->|1秒聚合| WS1
        Aggregator -->|原始数据| WS2
    end
    
    style Gateway fill:#FF6B35,color:#fff
    style Redis fill:#f44336,color:#fff
```

```typescript
// 股票行情订阅
class StockTicker {
  private subscriptions = new Map<string, Set<string>>(); // symbol -> socketIds

  subscribe(socketId: string, symbols: string[]): void {
    symbols.forEach(symbol => {
      if (!this.subscriptions.has(symbol)) {
        this.subscriptions.set(symbol, new Set());
      }
      this.subscriptions.get(symbol)!.add(socketId);
    });
  }

  unsubscribe(socketId: string, symbols?: string[]): void {
    if (symbols) {
      symbols.forEach(symbol => {
        this.subscriptions.get(symbol)?.delete(socketId);
      });
    } else {
      // 取消所有订阅
      for (const [, sockets] of this.subscriptions) {
        sockets.delete(socketId);
      }
    }
  }

  // 推送行情数据
  broadcast(symbol: string, data: StockData): void {
    const sockets = this.subscriptions.get(symbol);
    if (!sockets) return;
    
    sockets.forEach(socketId => {
      io.to(socketId).emit('stock:update', {
        symbol,
        price: data.price,
        change: data.change,
        volume: data.volume,
        timestamp: Date.now()
      });
    });
  }
}

// 客户端使用
socket.emit('stock:subscribe', ['AAPL', 'GOOGL', 'MSFT']);

socket.on('stock:update', (data) => {
  updateStockUI(data.symbol, data);
});
```

### 14.15.4 多人游戏

```mermaid
graph TB
    subgraph 客户端预测
        Input[玩家输入] --> Predict[客户端预测]
        Predict --> Render[立即渲染]
        Input --> Send[发送到服务器]
    end
    
    subgraph 服务器权威
        Server[游戏服务器] --> Validate[验证操作]
        Validate --> Update[更新游戏状态]
        Update --> Broadcast[广播给所有玩家]
    end
    
    subgraph 状态同步
        Broadcast --> Reconcile[客户端校验]
        Reconcile -->|状态不一致| Rollback[回滚 + 重放]
        Reconcile -->|状态一致| Continue[继续]
    end
    
    style Server fill:#FF6B35,color:#fff
```

```typescript
// 游戏状态同步
interface GameState {
  tick: number;
  players: Map<string, PlayerState>;
}

interface PlayerState {
  x: number;
  y: number;
  health: number;
  lastInputTick: number;
}

// 服务器游戏循环
class GameServer {
  private tickRate = 20; // 每秒 20 次状态更新
  private tickInterval = 1000 / this.tickRate;
  private currentTick = 0;
  private pendingInputs: Map<string, any[]> = new Map();

  start(): void {
    setInterval(() => this.gameLoop(), this.tickInterval);
  }

  private gameLoop(): void {
    this.currentTick++;
    
    // 处理所有玩家输入
    for (const [playerId, inputs] of this.pendingInputs) {
      inputs.forEach(input => {
        this.processInput(playerId, input);
      });
      this.pendingInputs.set(playerId, []);
    }
    
    // 更新游戏状态
    this.updatePhysics();
    this.checkCollisions();
    
    // 广播状态
    this.broadcastState();
  }

  private broadcastState(): void {
    const state = {
      tick: this.currentTick,
      players: Array.from(this.state.players.entries()).map(([id, state]) => ({
        id,
        x: state.x,
        y: state.y,
        health: state.health,
        lastInputTick: state.lastInputTick
      }))
    };
    
    io.emit('game:state', state);
  }
}
```

### 14.15.5 各场景架构对比

| 场景 | 延迟要求 | 数据频率 | 可靠性要求 | 关键技术 |
|------|---------|---------|-----------|---------|
| 在线协作 | < 100ms | 中 | 高 | OT/CRDT |
| 即时通讯 | < 500ms | 低 | ⭐ 最高 | 消息确认 + 持久化 |
| 实时行情 | < 50ms | ⭐ 极高 | 中 | 数据聚合 + 采样 |
| 多人游戏 | < 50ms | ⭐ 极高 | 低（允许丢包） | 客户端预测 + 服务器权威 |
| 实时通知 | < 1s | 低 | 高 | 推送 + 存储转发 |

---

## 24. WebSocket 协议帧格式深度解析

WebSocket 协议（RFC 6455）使用帧（Frame）作为数据传输的基本单位。理解帧格式对于调试、性能优化和安全分析至关重要。

### 24.1 帧结构总览

```mermaid
graph LR
    subgraph "WebSocket 帧结构（2-14字节头部 + Payload）"
        A["字节1<br/>FIN(1) + RSV(3) + Opcode(4)"]
        B["字节2<br/>MASK(1) + Payload Length(7)"]
        C["扩展长度<br/>0/2/8字节"]
        D["Masking Key<br/>0/4字节"]
        E["Payload Data<br/>0~2^63 字节"]
    end
    A --> B --> C --> D --> E
```

### 24.2 各字段详解

| 字段 | 位数 | 说明 |
|------|------|------|
| **FIN** | 1 bit | 是否为消息的最后一个分片。1=最后帧，0=后续还有帧 |
| **RSV1, RSV2, RSV3** | 各 1 bit | 保留位，通常为 0。用于扩展协商（如 permessage-deflate 压缩） |
| **Opcode** | 4 bits | 帧类型标识 |
| **MASK** | 1 bit | Payload 是否经过掩码处理。客户端→服务器必须为 1 |
| **Payload Length** | 7 bits | 负载长度（后续可能扩展为 16 或 64 位） |
| **Masking Key** | 0 或 32 bits | 掩码密钥，仅当 MASK=1 时存在 |
| **Payload Data** | 可变 | 实际传输的数据 |

#### Opcode 类型

| Opcode | 含义 | 说明 |
|--------|------|------|
| `0x0` | Continuation | 延续帧（分片消息的后续帧） |
| `0x1` | Text | 文本帧（UTF-8 编码） |
| `0x2` | Binary | 二进制帧 |
| `0x3-0x7` | Reserved | 保留，供未来数据帧使用 |
| `0x8` | Connection Close | 关闭连接帧 |
| `0x9` | Ping | Ping 帧 |
| `0xA` | Pong | Pong 帧 |
| `0xB-0xF` | Reserved | 保留，供未来控制帧使用 |

#### Payload Length 编码规则

```text
情况1：长度 0-125 字节
  → 直接用 7 位表示

情况2：长度 126-65535 字节
  → 7 位设为 126，后续 2 字节（16 位）存储实际长度

情况3：长度 > 65535 字节
  → 7 位设为 127，后续 8 字节（64 位）存储实际长度
```

### 24.3 帧解析代码实现

```javascript
class WebSocketFrameParser {
  // 解析单个帧
  static parse(buffer, offset = 0) {
    if (buffer.length - offset < 2) {
      return { error: '数据不足', bytesNeeded: 2 - (buffer.length - offset) };
    }

    // 字节1: FIN + RSV + Opcode
    const byte1 = buffer[offset];
    const fin = (byte1 >> 7) & 1;
    const rsv1 = (byte1 >> 6) & 1;
    const rsv2 = (byte1 >> 5) & 1;
    const rsv3 = (byte1 >> 4) & 1;
    const opcode = byte1 & 0x0F;

    // 字节2: MASK + Payload Length
    const byte2 = buffer[offset + 1];
    const masked = (byte2 >> 7) & 1;
    let payloadLength = byte2 & 0x7F;
    let headerSize = 2;

    // 扩展长度
    if (payloadLength === 126) {
      if (buffer.length - offset < 4) {
        return { error: '数据不足', bytesNeeded: 4 - (buffer.length - offset) };
      }
      payloadLength = buffer.readUInt16BE(offset + 2);
      headerSize = 4;
    } else if (payloadLength === 127) {
      if (buffer.length - offset < 10) {
        return { error: '数据不足', bytesNeeded: 10 - (buffer.length - offset) };
      }
      payloadLength = Number(buffer.readBigUInt64BE(offset + 2));
      headerSize = 10;
    }

    // Masking Key
    let maskingKey = null;
    if (masked) {
      if (buffer.length - offset < headerSize + 4) {
        return { error: '数据不足', bytesNeeded: headerSize + 4 - (buffer.length - offset) };
      }
      maskingKey = buffer.slice(offset + headerSize, offset + headerSize + 4);
      headerSize += 4;
    }

    // Payload Data
    const totalSize = headerSize + payloadLength;
    if (buffer.length - offset < totalSize) {
      return { error: '数据不足', bytesNeeded: totalSize - (buffer.length - offset) };
    }

    let payload = buffer.slice(offset + headerSize, offset + totalSize);

    // 反掩码
    if (masked && maskingKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    // 文本帧解码
    let data = payload;
    if (opcode === 0x1) {
      data = payload.toString('utf-8');
    }

    return {
      fin: !!fin,
      rsv1: !!rsv1,
      rsv2: !!rsv2,
      rsv3: !!rsv3,
      opcode,
      masked: !!masked,
      payloadLength,
      data,
      totalBytes: totalSize,
    };
  }

  // 构建帧（服务端发给客户端，不需要掩码）
  static build(data, opcode = 0x1, fin = true) {
    const payload = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const payloadLength = payload.length;

    let header;
    if (payloadLength < 126) {
      header = Buffer.alloc(2);
      header[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0F);
      header[1] = payloadLength;
    } else if (payloadLength < 65536) {
      header = Buffer.alloc(4);
      header[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0F);
      header[1] = 126;
      header.writeUInt16BE(payloadLength, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0F);
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(payloadLength), 2);
    }

    return Buffer.concat([header, payload]);
  }

  // 构建带掩码的帧（客户端发给服务器）
  static buildMasked(data, opcode = 0x1, fin = true) {
    const payload = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const maskingKey = crypto.randomBytes(4);

    // 应用掩码
    const maskedPayload = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) {
      maskedPayload[i] = payload[i] ^ maskingKey[i % 4];
    }

    const payloadLength = payload.length;
    let header;
    if (payloadLength < 126) {
      header = Buffer.alloc(2);
      header[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0F);
      header[1] = 0x80 | payloadLength;
    } else if (payloadLength < 65536) {
      header = Buffer.alloc(4);
      header[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0F);
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payloadLength, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = (fin ? 0x80 : 0x00) | (opcode & 0x0F);
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payloadLength), 2);
    }

    return Buffer.concat([header, maskingKey, maskedPayload]);
  }
}
```

### 24.4 分片消息处理

```javascript
class FragmentedMessageHandler {
  constructor() {
    this.fragments = [];
    this.currentOpcode = null;
  }

  handleFrame(frame) {
    // 第一个分片
    if (frame.opcode !== 0x0 && !frame.fin) {
      this.currentOpcode = frame.opcode;
      this.fragments = [frame.data];
      return null; // 等待更多分片
    }

    // 后续分片
    if (frame.opcode === 0x0 && !frame.fin) {
      this.fragments.push(frame.data);
      return null; // 等待更多分片
    }

    // 最后一个分片
    if (frame.opcode === 0x0 && frame.fin) {
      this.fragments.push(frame.data);
      const completeMessage = this.assembleMessage();
      return { opcode: this.currentOpcode, data: completeMessage };
    }

    // 非分片消息（单帧）
    if (frame.fin && frame.opcode !== 0x0) {
      return { opcode: frame.opcode, data: frame.data };
    }

    return null;
  }

  assembleMessage() {
    if (this.currentOpcode === 0x1) {
      // 文本消息：拼接字符串
      return this.fragments.join('');
    } else {
      // 二进制消息：拼接 Buffer
      return Buffer.concat(this.fragments.map(
        f => typeof f === 'string' ? Buffer.from(f) : f
      ));
    }
  }

  reset() {
    this.fragments = [];
    this.currentOpcode = null;
  }
}
```

---

## 25. 实时数据推送架构对比

### 25.1 四种方案全面对比

| 特性 | WebSocket | SSE | Long Polling | HTTP/2 Push |
|------|-----------|-----|--------------|-------------|
| **协议** | ws:// / wss:// | HTTP/1.1+ | HTTP/1.1+ | HTTP/2 |
| **通信方向** | 全双工 | 服务器→客户端 | 伪全双工 | 服务器→客户端 |
| **连接方式** | 独立 TCP 连接 | HTTP 连接复用 | 多个 HTTP 请求 | HTTP/2 流 |
| **实时性** | ⭐⭐⭐⭐⭐ 极高 | ⭐⭐⭐⭐ 高 | ⭐⭐⭐ 中等 | ⭐⭐⭐⭐ 高 |
| **二进制支持** | ✅ 原生支持 | ❌ 仅文本 | ❌ 仅文本 | ✅ 支持 |
| **自动重连** | ❌ 需手动实现 | ✅ 浏览器内置 | ❌ 需手动实现 | ✅ 浏览器内置 |
| **浏览器兼容** | 所有现代浏览器 | 所有现代浏览器 | 所有浏览器 | 所有现代浏览器 |
| **代理/防火墙** | ⚠️ 可能被阻止 | ✅ 通常没问题 | ✅ 通常没问题 | ✅ 通常没问题 |
| **服务器资源** | 中等（长连接） | 低 | 高（频繁请求） | 低 |
| **负载均衡** | ⚠️ 需要会话亲和 | ✅ 无状态 | ✅ 无状态 | ⚠️ 需要会话亲和 |
| **CDN 友好** | ❌ | ⚠️ 部分支持 | ⚠️ 部分支持 | ✅ |
| **适用场景** | 聊天/游戏/协作 | 通知/数据流 | 兼容旧浏览器 | 预加载资源 |

### 25.2 SSE（Server-Sent Events）实现

```javascript
// 服务端（Node.js + Express）
const express = require('express');
const app = express();

app.get('/events', (req, res) => {
  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // 发送事件的辅助函数
  const sendEvent = (data, event = 'message', id = null) => {
    if (id) res.write(`id: ${id}\n`);
    if (event !== 'message') res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 发送初始连接确认
  sendEvent({ status: 'connected' }, 'connected');

  // 定期发送心跳
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n'); // 注释行作为心跳
  }, 30000);

  // 模拟数据推送
  const dataInterval = setInterval(() => {
    sendEvent({
      timestamp: Date.now(),
      value: Math.random() * 100,
    }, 'data', String(Date.now()));
  }, 5000);

  // 客户端断开连接
  req.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(dataInterval);
  });
});

app.listen(3000);
```

```javascript
// 客户端
class SSEClient {
  constructor(url, options = {}) {
    this.url = url;
    this.options = options;
    this.eventSource = null;
    this.handlers = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnect || Infinity;
    this.reconnectDelay = options.reconnectDelay || 1000;
  }

  connect() {
    this.eventSource = new EventSource(this.url);

    this.eventSource.onopen = () => {
      console.log('SSE 连接已建立');
      this.reconnectAttempts = 0;
      this.emit('open');
    };

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.emit('message', data);
    };

    this.eventSource.onerror = (event) => {
      if (this.eventSource.readyState === EventSource.CLOSED) {
        console.log('SSE 连接已关闭');
        this.emit('close');
      } else {
        console.error('SSE 连接错误');
        this.emit('error', event);
      }
    };

    // 注册自定义事件
    this.handlers.forEach((handler, eventName) => {
      if (eventName !== 'message' && eventName !== 'open' && eventName !== 'close' && eventName !== 'error') {
        this.eventSource.addEventListener(eventName, (event) => {
          handler(JSON.parse(event.data));
        });
      }
    });
  }

  on(event, handler) {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event, data) {
    const handler = this.handlers.get(event);
    if (handler) handler(data);
  }

  close() {
    if (this.eventSource) {
      this.eventSource.close();
    }
  }
}

// 使用
const sse = new SSEClient('/events')
  .on('open', () => console.log('已连接'))
  .on('message', (data) => console.log('消息:', data))
  .on('data', (data) => updateChart(data))
  .on('error', (err) => console.error('错误:', err));
sse.connect();
```

### 25.3 Long Polling 实现

```javascript
// 服务端
const express = require('express');
const app = express();

// 等待队列
const waitingClients = [];
let messageId = 0;
const messageQueue = [];

app.get('/poll', (req, res) => {
  const lastId = parseInt(req.query.lastId) || 0;

  // 检查是否有新消息
  const newMessages = messageQueue.filter(m => m.id > lastId);
  if (newMessages.length > 0) {
    return res.json({ messages: newMessages, lastId: newMessages[newMessages.length - 1].id });
  }

  // 没有新消息，加入等待队列
  const timeout = setTimeout(() => {
    const index = waitingClients.indexOf(client);
    if (index > -1) waitingClients.splice(index, 1);
    res.json({ messages: [], lastId });
  }, 30000); // 30秒超时

  const client = { res, lastId, timeout };
  waitingClients.push(client);

  req.on('close', () => {
    clearTimeout(timeout);
    const index = waitingClients.indexOf(client);
    if (index > -1) waitingClients.splice(index, 1);
  });
});

// 推送新消息
function broadcast(message) {
  const msg = { id: ++messageId, data: message, timestamp: Date.now() };
  messageQueue.push(msg);

  // 通知所有等待的客户端
  while (waitingClients.length > 0) {
    const client = waitingClients.shift();
    clearTimeout(client.timeout);
    client.res.json({ messages: [msg], lastId: msg.id });
  }
}
```

```javascript
// 客户端
class LongPollingClient {
  constructor(url) {
    this.url = url;
    this.lastId = 0;
    this.isRunning = false;
    this.handlers = new Map();
  }

  async poll() {
    while (this.isRunning) {
      try {
        const response = await fetch(`${this.url}?lastId=${this.lastId}`);
        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
          data.messages.forEach(msg => {
            this.emit('message', msg.data);
            this.lastId = msg.id;
          });
        }
      } catch (error) {
        this.emit('error', error);
        // 等待后重试
        await new Promise(r => setTimeout(r, 5000));
      }
    }
  }

  start() {
    this.isRunning = true;
    this.poll();
  }

  stop() {
    this.isRunning = false;
  }

  on(event, handler) {
    this.handlers.set(event, handler);
    return this;
  }

  emit(event, data) {
    const handler = this.handlers.get(event);
    if (handler) handler(data);
  }
}
```

```mermaid
graph TD
    A[需要实时数据推送？] --> B{需要双向通信？}
    B -->|是| C[WebSocket]
    B -->|否| D{服务器→客户端即可？}

    D -->|是| E{需要二进制数据？}
    E -->|是| C
    E -->|否| F{浏览器兼容性要求？}

    F -->|需要兼容旧浏览器| G[Long Polling]
    F -->|现代浏览器| H{需要经过代理/CDN？}

    H -->|是| I[SSE]
    H -->|否| J{需要资源预加载？}

    J -->|是| K[HTTP/2 Push]
    J -->|否| I

    C --> L[聊天/游戏/协作编辑]
    I --> M[通知/数据流/日志]
    G --> N[兼容性方案]
```

---

## 26. WebSocket 连接池管理

### 26.1 连接池架构

```javascript
class WebSocketConnectionPool {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 10;
    this.idleTimeout = options.idleTimeout || 60000; // 60秒
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30秒
    this.url = options.url;
    this.protocols = options.protocols;

    this.connections = new Map(); // id -> { ws, status, lastActivity, inUse }
    this.waitingQueue = []; // 等待连接的请求队列
    this.nextId = 1;
    this.isShutdown = false;

    // 启动健康检查
    this.healthCheckTimer = setInterval(() => this.healthCheck(), this.healthCheckInterval);
    // 启动空闲检测
    this.idleCheckTimer = setInterval(() => this.checkIdleConnections(), 10000);
  }

  // 获取连接
  async acquire() {
    if (this.isShutdown) throw new Error('连接池已关闭');

    // 查找空闲连接
    for (const [id, conn] of this.connections) {
      if (conn.status === 'ready' && !conn.inUse) {
        conn.inUse = true;
        conn.lastActivity = Date.now();
        return { id, ws: conn.ws };
      }
    }

    // 创建新连接
    if (this.connections.size < this.maxConnections) {
      return this.createConnection();
    }

    // 等待连接释放
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.findIndex(w => w.resolve === resolve);
        if (index > -1) this.waitingQueue.splice(index, 1);
        reject(new Error('获取连接超时'));
      }, 10000);

      this.waitingQueue.push({
        resolve: (conn) => { clearTimeout(timeout); resolve(conn); },
        reject: (err) => { clearTimeout(timeout); reject(err); },
      });
    });
  }

  // 释放连接
  release(id) {
    const conn = this.connections.get(id);
    if (!conn) return;

    conn.inUse = false;
    conn.lastActivity = Date.now();

    // 检查等待队列
    if (this.waitingQueue.length > 0) {
      const waiter = this.waitingQueue.shift();
      conn.inUse = true;
      waiter.resolve({ id, ws: conn.ws });
    }
  }

  // 创建新连接
  async createConnection() {
    const id = this.nextId++;
    const ws = new WebSocket(this.url, this.protocols);

    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        const conn = {
          ws, status: 'ready', lastActivity: Date.now(), inUse: true,
        };
        this.connections.set(id, conn);

        ws.onclose = () => this.handleClose(id);
        ws.onerror = (err) => this.handleError(id, err);

        resolve({ id, ws });
      };

      ws.onerror = (err) => {
        reject(err);
      };

      setTimeout(() => reject(new Error('连接超时')), 10000);
    });
  }

  // 处理连接关闭
  handleClose(id) {
    const conn = this.connections.get(id);
    if (!conn) return;

    this.connections.delete(id);

    // 如果有待等待的请求，创建新连接
    if (this.waitingQueue.length > 0) {
      this.createConnection().then(newConn => {
        const waiter = this.waitingQueue.shift();
        waiter.resolve(newConn);
      }).catch(err => {
        if (this.waitingQueue.length > 0) {
          this.waitingQueue.shift().reject(err);
        }
      });
    }
  }

  // 处理连接错误
  handleError(id, err) {
    console.error(`连接 ${id} 错误:`, err);
    const conn = this.connections.get(id);
    if (conn) {
      conn.status = 'error';
      conn.ws.close();
    }
  }

  // 健康检查
  healthCheck() {
    for (const [id, conn] of this.connections) {
      if (conn.status === 'ready' && !conn.inUse) {
        try {
          // 发送 Ping
          conn.ws.ping();
        } catch (err) {
          console.error(`连接 ${id} 健康检查失败:`, err);
          conn.status = 'error';
          conn.ws.close();
        }
      }
    }
  }

  // 空闲连接检测
  checkIdleConnections() {
    const now = Date.now();
    for (const [id, conn] of this.connections) {
      if (!conn.inUse && now - conn.lastActivity > this.idleTimeout) {
        console.log(`关闭空闲连接 ${id}`);
        conn.ws.close(1000, '空闲超时');
        this.connections.delete(id);
      }
    }
  }

  // 优雅关闭
  async shutdown() {
    this.isShutdown = true;
    clearInterval(this.healthCheckTimer);
    clearInterval(this.idleCheckTimer);

    // 拒绝等待中的请求
    this.waitingQueue.forEach(w => w.reject(new Error('连接池已关闭')));
    this.waitingQueue = [];

    // 关闭所有连接
    const closePromises = [];
    for (const [id, conn] of this.connections) {
      closePromises.push(new Promise(resolve => {
        conn.ws.onclose = resolve;
        conn.ws.close(1001, '服务关闭');
      }));
    }

    await Promise.all(closePromises);
    this.connections.clear();
  }

  // 获取统计信息
  getStats() {
    let ready = 0, inUse = 0, error = 0;
    for (const conn of this.connections.values()) {
      if (conn.status === 'ready') ready++;
      if (conn.inUse) inUse++;
      if (conn.status === 'error') error++;
    }
    return {
      total: this.connections.size,
      ready, inUse, error,
      waiting: this.waitingQueue.length,
      maxConnections: this.maxConnections,
    };
  }
}

// 使用示例
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/ws',
  maxConnections: 5,
  idleTimeout: 120000,
});

async function sendMessage(message) {
  const { id, ws } = await pool.acquire();
  try {
    ws.send(JSON.stringify(message));
    // 等待响应...
  } finally {
    pool.release(id);
  }
}
```

---

## 27. WebSocket 消息中间件

### 27.1 消息路由系统

```javascript
class MessageRouter {
  constructor() {
    this.routes = new Map();
    this.middlewares = [];
  }

  // 注册全局中间件
  use(middleware) {
    this.middlewares.push(middleware);
  }

  // 注册消息路由
  on(pattern, handler) {
    this.routes.set(pattern, handler);
    return this;
  }

  // 处理消息
  async handle(message, context) {
    // 执行全局中间件
    for (const middleware of this.middlewares) {
      const result = await middleware(message, context);
      if (result === false) return; // 中间件中断
      if (result && typeof result === 'object') {
        Object.assign(message, result); // 中间件可能修改消息
      }
    }

    // 匹配路由
    for (const [pattern, handler] of this.routes) {
      const match = this.matchPattern(pattern, message.type);
      if (match) {
        context.params = match;
        await handler(message, context);
        return;
      }
    }

    // 未匹配
    console.warn(`未找到路由: ${message.type}`);
  }

  matchPattern(pattern, type) {
    // 简单的模式匹配
    if (pattern === type) return {};
    if (pattern === '*') return { wildcard: type };

    // 支持通配符 chat.*
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2);
      if (type.startsWith(prefix + '.')) {
        return { subType: type.slice(prefix.length + 1) };
      }
    }

    // 支持参数 :param
    const patternParts = pattern.split('.');
    const typeParts = type.split('.');
    if (patternParts.length !== typeParts.length) return null;

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = typeParts[i];
      } else if (patternParts[i] !== typeParts[i]) {
        return null;
      }
    }

    return params;
  }
}

// 中间件：消息日志
function loggerMiddleware(message, context) {
  console.log(`[${new Date().toISOString()}] ${context.wsId} -> ${message.type}`, message.data);
  return true;
}

// 中间件：认证检查
function authMiddleware(message, context) {
  const publicTypes = ['auth.login', 'auth.register', 'ping'];
  if (publicTypes.includes(message.type)) return true;

  if (!context.user) {
    context.ws.send(JSON.stringify({
      type: 'error',
      data: { code: 'UNAUTHORIZED', message: '请先登录' },
    }));
    return false;
  }
  return true;
}

// 中间件：消息验证
function validationMiddleware(message, context) {
  if (!message.type || typeof message.type !== 'string') {
    return false;
  }
  if (message.data && typeof message.data !== 'object') {
    return false;
  }
  return true;
}

// 使用示例
const router = new MessageRouter();

router.use(validationMiddleware);
router.use(loggerMiddleware);
router.use(authMiddleware);

router.on('chat.message', async (msg, ctx) => {
  // 处理聊天消息
  broadcastToRoom(msg.data.roomId, {
    type: 'chat.message',
    data: { ...msg.data, user: ctx.user, timestamp: Date.now() },
  });
});

router.on('chat.join', async (msg, ctx) => {
  // 加入聊天室
  joinRoom(ctx.ws, msg.data.roomId);
});

router.on('user.status', async (msg, ctx) => {
  // 更新用户状态
  updateUserStatus(ctx.user.id, msg.data.status);
});
```

### 27.2 消息过滤与转换

```javascript
// 消息过滤器
class MessageFilter {
  constructor() {
    this.filters = [];
  }

  addFilter(filterFn) {
    this.filters.push(filterFn);
    return this;
  }

  shouldProcess(message) {
    return this.filters.every(filter => filter(message));
  }
}

// 常用过滤器
const filters = {
  // 速率限制过滤器
  rateLimit(maxPerSecond) {
    const counts = new Map();
    return (message) => {
      const key = `${message.userId}:${message.type}`;
      const now = Date.now();
      const record = counts.get(key) || { count: 0, resetTime: now + 1000 };

      if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + 1000;
      }

      record.count++;
      counts.set(key, record);

      return record.count <= maxPerSecond;
    };
  },

  // 消息大小过滤器
  maxSize(maxBytes) {
    return (message) => {
      return JSON.stringify(message).length <= maxBytes;
    };
  },

  // 类型白名单过滤器
  allowedTypes(types) {
    return (message) => types.includes(message.type);
  },
};

// 消息转换器
class MessageTransformer {
  constructor() {
    this.transforms = [];
  }

  addTransform(transformFn) {
    this.transforms.push(transformFn);
    return this;
  }

  transform(message) {
    let result = { ...message };
    for (const transformFn of this.transforms) {
      result = transformFn(result) || result;
    }
    return result;
  }
}

// 常用转换器
const transformers = {
  // 添加时间戳
  addTimestamp: (message) => ({
    ...message,
    timestamp: message.timestamp || Date.now(),
  }),

  // 消息压缩（移除不必要的字段）
  compress: (message) => {
    const { _debug, _trace, ...rest } = message;
    return rest;
  },

  // 数据脱敏
  sanitize: (message) => {
    if (message.data?.password) {
      message.data.password = '***';
    }
    if (message.data?.email) {
      message.data.email = message.data.email.replace(/(.{2}).+(@.+)/, '$1***$2');
    }
    return message;
  },
};
```

### 27.3 消息持久化

```javascript
class MessagePersistence {
  constructor(options = {}) {
    this.storage = options.storage; // Redis/数据库实例
    this.ttl = options.ttl || 86400; // 默认24小时
    this.maxHistory = options.maxHistory || 100; // 每个频道最多保存条数
  }

  // 保存消息
  async save(channel, message) {
    const key = `ws:messages:${channel}`;
    const entry = {
      ...message,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    // 添加到列表
    await this.storage.lpush(key, JSON.stringify(entry));
    // 裁剪列表长度
    await this.storage.ltrim(key, 0, this.maxHistory - 1);
    // 设置过期时间
    await this.storage.expire(key, this.ttl);

    return entry;
  }

  // 获取历史消息
  async getHistory(channel, limit = 50, before = null) {
    const key = `ws:messages:${channel}`;
    let messages;

    if (before) {
      // 获取指定时间之前的消息
      const all = await this.storage.lrange(key, 0, -1);
      messages = all
        .map(m => JSON.parse(m))
        .filter(m => m.timestamp < before)
        .slice(0, limit);
    } else {
      const raw = await this.storage.lrange(key, 0, limit - 1);
      messages = raw.map(m => JSON.parse(m));
    }

    return messages.reverse(); // 按时间正序
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
```

---

## 28. 实时通知系统设计

### 28.1 推送策略

```javascript
class NotificationService {
  constructor(options = {}) {
    this.wsServer = options.wsServer;
    this.persistence = options.persistence;
    this.deliveryReceipts = new Map();

    // 推送策略配置
    this.strategies = {
      immediate: { delay: 0, batch: false },
      batched: { delay: 5000, batch: true, maxBatchSize: 20 },
      priority: { delay: 0, batch: false, priority: 'high' },
    };
  }

  // 发送通知
  async send(notification) {
    const {
      userId, type, title, body, data,
      priority = 'normal',
      strategy = 'immediate',
      ttl = 86400, // 24小时
    } = notification;

    const message = {
      id: this.generateId(),
      type: 'notification',
      data: { notificationType: type, title, body, data },
      priority,
      timestamp: Date.now(),
      ttl,
      status: 'pending',
    };

    // 持久化通知
    await this.persistence.save(`notifications:${userId}`, message);

    // 应用推送策略
    const strategyConfig = this.strategies[strategy];
    if (strategyConfig.batch) {
      await this.addToBatch(userId, message, strategyConfig);
    } else {
      await this.deliver(userId, message, strategyConfig);
    }

    return message.id;
  }

  // 立即投递
  async deliver(userId, message, strategy) {
    const delay = strategy.delay || 0;

    if (delay > 0) {
      setTimeout(() => this.doDeliver(userId, message), delay);
    } else {
      await this.doDeliver(userId, message);
    }
  }

  async doDeliver(userId, message) {
    const connection = this.wsServer.getConnection(userId);

    if (connection && connection.readyState === WebSocket.OPEN) {
      // 用户在线，通过 WebSocket 推送
      connection.send(JSON.stringify(message));
      message.status = 'delivered';
    } else {
      // 用户离线，存储为未读
      message.status = 'stored';
      await this.persistence.save(`unread:${userId}`, message);

      // 可选：发送推送通知（FCM/APNs）
      await this.sendPushNotification(userId, message);
    }
  }

  // 批量投递
  async addToBatch(userId, message, strategy) {
    const batchKey = `batch:${userId}`;
    const batch = await this.persistence.get(batchKey) || [];
    batch.push(message);

    if (batch.length >= strategy.maxBatchSize) {
      await this.flushBatch(userId, batch);
    } else {
      await this.persistence.set(batchKey, batch, strategy.delay / 1000);
      // 设置定时刷新
      setTimeout(() => this.flushBatch(userId, batch), strategy.delay);
    }
  }

  async flushBatch(userId, batch) {
    if (batch.length === 0) return;

    const batchMessage = {
      type: 'notification_batch',
      data: {
        notifications: batch,
        count: batch.length,
      },
      timestamp: Date.now(),
    };

    const connection = this.wsServer.getConnection(userId);
    if (connection && connection.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify(batchMessage));
    }

    await this.persistence.del(`batch:${userId}`);
  }

  // 确认机制
  async acknowledge(userId, notificationId) {
    const key = `notifications:${userId}`;
    const notifications = await this.persistence.get(key) || [];
    const notification = notifications.find(n => n.id === notificationId);

    if (notification) {
      notification.status = 'acknowledged';
      notification.acknowledgedAt = Date.now();
      await this.persistence.set(key, notifications);
    }
  }

  // 获取未读通知
  async getUnread(userId) {
    const unread = await this.persistence.get(`unread:${userId}`) || [];
    const count = unread.length;
    return { notifications: unread, count };
  }

  generateId() {
    return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
```

### 28.2 优先级队列

```javascript
class PriorityMessageQueue {
  constructor() {
    this.queues = {
      critical: [],   // 关键（系统告警、安全事件）
      high: [],       // 高（聊天消息、交易通知）
      normal: [],     // 普通（社交动态、推荐）
      low: [],        // 低（营销、活动）
    };
    this.processing = false;
  }

  enqueue(message) {
    const priority = message.priority || 'normal';
    if (!this.queues[priority]) {
      throw new Error(`未知优先级: ${priority}`);
    }

    this.queues[priority].push({
      ...message,
      enqueuedAt: Date.now(),
    });

    this.process();
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.hasMessages()) {
      const message = this.dequeue();
      if (message) {
        try {
          await this.deliverMessage(message);
        } catch (err) {
          console.error('消息投递失败:', err);
          if (message.retryCount < 3) {
            message.retryCount = (message.retryCount || 0) + 1;
            this.enqueue(message); // 重试
          }
        }
      }
    }

    this.processing = false;
  }

  dequeue() {
    // 按优先级出队
    for (const priority of ['critical', 'high', 'normal', 'low']) {
      if (this.queues[priority].length > 0) {
        return this.queues[priority].shift();
      }
    }
    return null;
  }

  hasMessages() {
    return Object.values(this.queues).some(q => q.length > 0);
  }

  getStats() {
    return {
      critical: this.queues.critical.length,
      high: this.queues.high.length,
      normal: this.queues.normal.length,
      low: this.queues.low.length,
      total: Object.values(this.queues).reduce((sum, q) => sum + q.length, 0),
    };
  }
}
```

---

## 29. WebSocket 性能基准测试

### 29.1 k6 压力测试脚本

```javascript
// k6 WebSocket 压力测试
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// 自定义指标
const messagesSent = new Counter('messages_sent');
const messagesReceived = new Counter('messages_received');
const messageLatency = new Trend('message_latency');
const connectionErrors = new Counter('connection_errors');
const connectionSuccess = new Rate('connection_success');

// 测试配置
export const options = {
  scenarios: {
    // 场景1：并发连接测试
    connections: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },   // 30秒内增加到100个连接
        { duration: '1m', target: 500 },     // 1分钟内增加到500个连接
        { duration: '2m', target: 1000 },    // 2分钟内增加到1000个连接
        { duration: '1m', target: 1000 },    // 保持1000个连接1分钟
        { duration: '30s', target: 0 },      // 30秒内降到0
      ],
    },
    // 场景2：消息吞吐量测试
    throughput: {
      executor: 'constant-arrival-rate',
      rate: 1000,            // 每秒1000个新连接
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 500,
      maxVUs: 2000,
    },
  },
  thresholds: {
    connection_success: ['rate>0.95'],           // 连接成功率>95%
    message_latency: ['p(95)<500', 'p(99)<1000'], // 95%延迟<500ms
    messages_sent: ['count>10000'],               // 至少发送10000条消息
  },
};

// 测试函数
export default function () {
  const url = `wss://${__ENV.WS_HOST || 'localhost:8080'}/ws`;
  const userId = `user_${__VU}_${__ITER}`;

  const res = ws.connect(url, {}, function (socket) {
    connectionSuccess.add(1);

    socket.on('open', () => {
      console.log(`用户 ${userId} 已连接`);

      // 发送认证消息
      socket.send(JSON.stringify({
        type: 'auth',
        data: { userId, token: 'test-token' },
      }));

      // 定期发送消息
      const interval = setInterval(() => {
        const sendTime = Date.now();
        socket.send(JSON.stringify({
          type: 'ping',
          data: { timestamp: sendTime },
        }));
        messagesSent.add(1);
      }, 1000);

      // 接收消息
      socket.on('message', (data) => {
        const message = JSON.parse(data);
        messagesReceived.add(1);

        if (message.type === 'pong') {
          const latency = Date.now() - message.data.timestamp;
          messageLatency.add(latency);
        }
      });

      // 保持连接30秒
      sleep(30);
      clearInterval(interval);
    });

    socket.on('error', (e) => {
      connectionErrors.add(1);
      console.error(`连接错误: ${e.error()}`);
    });

    socket.on('close', () => {
      console.log(`用户 ${userId} 断开`);
    });
  });

  check(res, { '连接成功': (r) => r && r.status === 101 });
}
```

### 29.2 Node.js 性能测试

```javascript
// WebSocket 性能测试工具
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class WSBenchmark {
  constructor(url, options = {}) {
    this.url = url;
    this.concurrency = options.concurrency || 100;
    this.duration = options.duration || 30000; // 30秒
    this.messageSize = options.messageSize || 256; // 256字节
    this.messageInterval = options.messageInterval || 100; // 100ms

    this.connections = [];
    this.stats = {
      connectionsOpened: 0,
      connectionsClosed: 0,
      connectionsFailed: 0,
      messagesSent: 0,
      messagesReceived: 0,
      latencies: [],
      startTime: null,
      endTime: null,
    };
  }

  async run() {
    console.log(`开始基准测试: ${this.url}`);
    console.log(`并发连接: ${this.concurrency}, 持续时间: ${this.duration}ms`);

    this.stats.startTime = Date.now();

    // 创建连接
    const connectPromises = [];
    for (let i = 0; i < this.concurrency; i++) {
      connectPromises.push(this.createConnection(i));
      // 分批连接，避免同时建立过多连接
      if (i % 50 === 49) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    await Promise.allSettled(connectPromises);
    console.log(`连接完成: ${this.stats.connectionsOpened} 成功, ${this.stats.connectionsFailed} 失败`);

    // 等待测试持续时间
    await new Promise(r => setTimeout(r, this.duration));

    // 停止测试
    this.stats.endTime = Date.now();
    await this.cleanup();

    return this.generateReport();
  }

  async createConnection(id) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);

      ws.on('open', () => {
        this.stats.connectionsOpened++;
        this.connections.push(ws);

        // 定期发送消息
        const interval = setInterval(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            clearInterval(interval);
            return;
          }

          const sendTime = performance.now();
          const message = JSON.stringify({
            type: 'benchmark',
            id,
            timestamp: sendTime,
            payload: 'x'.repeat(this.messageSize),
          });

          ws.send(message);
          this.stats.messagesSent++;
        }, this.messageInterval);

        ws._benchmarkInterval = interval;
        resolve(ws);
      });

      ws.on('message', (data) => {
        this.stats.messagesReceived++;
        try {
          const msg = JSON.parse(data);
          if (msg.timestamp) {
            const latency = performance.now() - msg.timestamp;
            this.stats.latencies.push(latency);
          }
        } catch (e) {}
      });

      ws.on('close', () => {
        this.stats.connectionsClosed++;
        if (ws._benchmarkInterval) clearInterval(ws._benchmarkInterval);
      });

      ws.on('error', (err) => {
        this.stats.connectionsFailed++;
        reject(err);
      });
    });
  }

  async cleanup() {
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    const latencies = this.stats.latencies.sort((a, b) => a - b);

    const report = {
      duration: `${duration.toFixed(1)}s`,
      connections: {
        opened: this.stats.connectionsOpened,
        closed: this.stats.connectionsClosed,
        failed: this.stats.connectionsFailed,
        successRate: `${((this.stats.connectionsOpened / this.concurrency) * 100).toFixed(1)}%`,
      },
      messages: {
        sent: this.stats.messagesSent,
        received: this.stats.messagesReceived,
        throughput: `${(this.stats.messagesSent / duration).toFixed(0)} msg/s`,
      },
      latency: {
        min: latencies.length > 0 ? `${latencies[0].toFixed(2)}ms` : 'N/A',
        avg: latencies.length > 0 ? `${(latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2)}ms` : 'N/A',
        p50: latencies.length > 0 ? `${latencies[Math.floor(latencies.length * 0.5)].toFixed(2)}ms` : 'N/A',
        p95: latencies.length > 0 ? `${latencies[Math.floor(latencies.length * 0.95)].toFixed(2)}ms` : 'N/A',
        p99: latencies.length > 0 ? `${latencies[Math.floor(latencies.length * 0.99)].toFixed(2)}ms` : 'N/A',
        max: latencies.length > 0 ? `${latencies[latencies.length - 1].toFixed(2)}ms` : 'N/A',
      },
    };

    console.log('\n===== 基准测试报告 =====');
    console.log(JSON.stringify(report, null, 2));

    return report;
  }
}

// 运行测试
const benchmark = new WSBenchmark('ws://localhost:8080', {
  concurrency: 500,
  duration: 30000,
  messageSize: 256,
  messageInterval: 100,
});

benchmark.run().then(report => {
  console.log('测试完成');
  process.exit(0);
});
```

### 29.3 性能优化建议

```mermaid
graph TD
    A[WebSocket 性能瓶颈] --> B[连接层]
    A --> C[消息层]
    A --> D[应用层]

    B --> B1[使用 wss:// 减少握手]
    B --> B2[启用 permessage-deflate 压缩]
    B --> B3[连接池复用]
    B --> B4[心跳保活优化]

    C --> C1[消息压缩 gzip/zstd]
    C --> C2[二进制协议代替 JSON]
    C --> C3[消息批量发送]
    C --> C4[分片大消息]

    D --> D1[消息队列缓冲]
    D --> D2[水平扩展 + Redis Pub/Sub]
    D --> D3[负载均衡策略]
    D --> D4[监控与告警]
```

| 优化方向 | 具体措施 | 预期效果 |
|----------|----------|----------|
| **协议优化** | 使用 Protobuf 替代 JSON | 消息体积减少 50-80% |
| **压缩** | 启用 permessage-deflate | 带宽减少 60-70% |
| **批量** | 合并小消息批量发送 | 减少帧数量，降低 CPU 开销 |
| **二进制** | 使用二进制帧替代文本帧 | 解析速度提升 3-5 倍 |
| **连接复用** | 连接池 + 多路复用 | 减少连接建立开销 |
| **水平扩展** | Redis Pub/Sub 跨节点广播 | 支持百万级连接 |
| **背压控制** | 消息队列 + 流控 | 防止客户端过载 |

---

以上内容涵盖了 WebSocket 帧格式深度解析、实时推送架构对比、连接池管理、消息中间件、通知系统设计和性能基准测试等 WebSocket 与实时通信的完整知识体系。
