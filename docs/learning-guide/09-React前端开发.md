# React 前端开发完全指南（以 AI-CLI-Mobile 为例）

> 📖 本篇是学习指南的第九篇，面向完全不懂 React 的初学者，从零开始讲解 React 前端开发的方方面面。
> 阅读本篇后，你将理解：React 的核心概念、Hooks 的使用与原理、状态管理、TypeScript 集成、样式方案、路由系统和测试策略。
> 所有示例均来自 AI-CLI-Mobile 项目的真实代码，学完就能上手实战。

---

## 目录

- [第一章：React 基础概念](#第一章react-基础概念)
  - [1.1 什么是 React？](#11-什么是-react)
  - [1.2 组件化思想](#12-组件化思想)
  - [1.3 JSX 语法详解](#13-jsx-语法详解)
  - [1.4 Props：组件的"参数"](#14-props组件的参数)
  - [1.5 State：组件的"记忆"](#15-state组件的记忆)
  - [1.6 生命周期：组件的一生](#16-生命周期组件的一生)
  - [1.7 事件处理](#17-事件处理)
  - [1.8 条件渲染与列表渲染](#18-条件渲染与列表渲染)
  - [1.9 本章小结](#19-本章小结)
- [第二章：React Hooks 深度解析](#第二章react-hooks-深度解析)
  - [2.1 什么是 Hooks？](#21-什么是-hooks)
  - [2.2 useState：让函数组件拥有状态](#22-usestate让函数组件拥有状态)
  - [2.3 useEffect：副作用处理](#23-useeffect副作用处理)
  - [2.4 useRef：可变引用容器](#24-useref可变引用容器)
  - [2.5 useCallback：记忆函数](#25-usecallback记忆函数)
  - [2.6 useMemo：记忆值](#26-usememo记忆值)
  - [2.7 自定义 Hooks](#27-自定义-hooks)
  - [2.8 Hooks 规则与原理](#28-hooks-规则与原理)
  - [2.9 闭包陷阱与解决方案](#29-闭包陷阱与解决方案)
  - [2.10 本章小结](#210-本章小结)
- [第三章：React 性能优化](#第三章react-性能优化)
  - [3.1 为什么需要性能优化？](#31-为什么需要性能优化)
  - [3.2 React.memo：避免不必要的重渲染](#32-reactmemo避免不必要的重渲染)
  - [3.3 useMemo 与 useCallback 的正确使用](#33-usememo-与-usecallback-的正确使用)
  - [3.4 虚拟列表：渲染海量数据](#34-虚拟列表渲染海量数据)
  - [3.5 代码分割：React.lazy + Suspense](#35-代码分割reactlazy--suspense)
  - [3.6 项目中的性能优化实例](#36-项目中的性能优化实例)
  - [3.7 性能分析工具](#37-性能分析工具)
  - [3.8 本章小结](#38-本章小结)
- [第四章：React 状态管理](#第四章react-状态管理)
  - [4.1 状态管理的挑战](#41-状态管理的挑战)
  - [4.2 组件内部状态 vs 全局状态](#42-组件内部状态-vs-全局状态)
  - [4.3 Context API：React 内置方案](#43-context-apireact-内置方案)
  - [4.4 外部状态管理库对比](#44-外部状态管理库对比)
  - [4.5 Zustand 深度讲解](#45-zustand-深度讲解)
  - [4.6 项目中的状态管理设计](#46-项目中的状态管理设计)
  - [4.7 状态管理最佳实践](#47-状态管理最佳实践)
  - [4.8 本章小结](#48-本章小结)
- [第五章：React 与 TypeScript](#第五章react-与-typescript)
  - [5.1 为什么要在 React 中使用 TypeScript？](#51-为什么要在-react-中使用-typescript)
  - [5.2 组件类型定义](#52-组件类型定义)
  - [5.3 Hooks 类型标注](#53-hooks-类型标注)
  - [5.4 泛型组件](#54-泛型组件)
  - [5.5 类型推断与类型守卫](#55-类型推断与类型守卫)
  - [5.6 常见类型模式](#56-常见类型模式)
  - [5.7 项目中的 TypeScript React 代码分析](#57-项目中的-typescript-react-代码分析)
  - [5.8 本章小结](#58-本章小结)
- [第六章：CSS 方案与样式管理](#第六章css-方案与样式管理)
  - [6.1 React 中的样式方案概览](#61-react-中的样式方案概览)
  - [6.2 Tailwind CSS 原理与使用](#62-tailwind-css-原理与使用)
  - [6.3 CSS Modules](#63-css-modules)
  - [6.4 响应式设计](#64-响应式设计)
  - [6.5 暗色主题实现](#65-暗色主题实现)
  - [6.6 项目中的样式架构](#66-项目中的样式架构)
  - [6.7 本章小结](#67-本章小结)
- [第七章：React 路由与导航](#第七章react-路由与导航)
  - [7.1 什么是前端路由？](#71-什么是前端路由)
  - [7.2 SPA 路由原理](#72-spa-路由原理)
  - [7.3 React Router 基础](#73-react-router-基础)
  - [7.4 项目中的单页面架构](#74-项目中的单页面架构)
  - [7.5 路由与状态管理的协作](#75-路由与状态管理的协作)
  - [7.6 本章小结](#76-本章小结)
- [第八章：React 测试](#第八章react-测试)
  - [8.1 为什么要写测试？](#81-为什么要写测试)
  - [8.2 测试工具链：Vitest + React Testing Library](#82-测试工具链vitest--react-testing-library)
  - [8.3 组件测试策略](#83-组件测试策略)
  - [8.4 Store 测试](#84-store-测试)
  - [8.5 项目中的测试代码分析](#85-项目中的测试代码分析)
  - [8.6 测试最佳实践](#86-测试最佳实践)
  - [8.7 本章小结](#87-本章小结)

---

# 第一章：React 基础概念

## 1.1 什么是 React？

React 是由 Facebook（现 Meta）开发的 JavaScript 库，用于构建用户界面。它是目前全球最流行的前端框架之一。

### 为什么选择 React？

在 React 之前，前端开发主要使用 jQuery 直接操作 DOM。这种方式在项目变大后会变得非常痛苦：

```mermaid
graph LR
    subgraph "jQuery 时代"
        A[HTML 页面] -->|直接操作| B[DOM 元素]
        B -->|手动修改| C[更新后的页面]
        D[用户事件] -->|手动绑定| B
    end

    subgraph "React 时代"
        E[组件] -->|声明式描述| F[Virtual DOM]
        F -->|自动计算差异| G[真实 DOM]
        G --> H[更新后的页面]
        I[状态变化] -->|自动触发| E
    end
```

| 特性 | jQuery 方式 | React 方式 |
|------|------------|-----------|
| **思维方式** | 命令式（告诉浏览器怎么做） | 声明式（告诉浏览器要什么） |
| **DOM 操作** | 手动查找和修改 DOM | 自动通过 Virtual DOM 更新 |
| **状态管理** | 分散在各处，难以追踪 | 集中在组件状态中，可预测 |
| **代码复用** | 难以复用 UI 逻辑 | 组件化，天然可复用 |
| **大型项目** | 容易变成"面条代码" | 结构清晰，易于维护 |
| **学习曲线** | 入门简单，深入困难 | 入门需要概念，深入较平滑 |

### React 的核心理念

React 的设计哲学可以用三个词概括：**声明式、组件化、一次学习，到处编写**。

```mermaid
mindmap
  root((React 核心理念))
    声明式
      描述"要什么"而非"怎么做"
      UI = f(state)
      自动处理 DOM 更新
    组件化
      将 UI 拆分为独立组件
      组件可复用、可组合
      单一职责原则
    虚拟 DOM
      内存中的 DOM 表示
      Diff 算法计算最小变更
      批量更新真实 DOM
    单向数据流
      数据从上往下流
      事件从下往上冒泡
      状态可预测
```

### React 的版本演进

| 版本 | 年份 | 重要特性 | 说明 |
|------|------|---------|------|
| React 0.3 | 2013 | 首次发布 | Facebook 内部使用后开源 |
| React 15 | 2016 | 稳定版本 | 类组件为主 |
| React 16 | 2017 | Fiber 架构 | 重写核心算法，支持并发 |
| React 16.8 | 2019 | Hooks | 函数组件拥有状态，革命性变化 |
| React 17 | 2020 | 无新特性 | 专注升级体验，渐进式升级 |
| React 18 | 2022 | 并发渲染 | Suspense、自动批处理、Transitions |

> 💡 **初学者提示**：现在学习 React，应该直接从函数组件 + Hooks 开始。类组件是历史遗留，了解即可。

---

## 1.2 组件化思想

### 什么是组件？

组件是 React 的核心概念。你可以把组件想象成一个**独立的、可复用的 UI 积木块**。

```mermaid
graph TD
    subgraph "AI-CLI-Mobile 组件树"
        App["App 根组件"]
        App --> LoginForm["LoginForm<br/>登录表单"]
        App --> StatusBar["StatusBar<br/>状态栏"]
        App --> SessionTabs["SessionTabs<br/>会话标签页"]
        App --> TerminalContainer["TerminalContainer<br/>终端容器"]
        App --> FileExplorer["FileExplorer<br/>文件浏览器"]
        App --> SettingsDrawer["SettingsDrawer<br/>设置抽屉"]
        App --> CodeEditor["CodeEditor<br/>代码编辑器（懒加载）"]
        App --> ErrorBoundary["ErrorBoundary<br/>错误边界"]
    end
```

### 项目中的组件树

AI-CLI-Mobile 的前端就由多个组件组成，每个组件负责一块独立的功能：

```mermaid
graph TB
    subgraph "入口层"
        Main["main.tsx<br/>应用入口"]
        EB["ErrorBoundary<br/>错误边界"]
        App["App.tsx<br/>根组件"]
    end

    subgraph "页面层"
        LF["LoginForm<br/>未登录时显示"]
        LoggedIn["已登录页面"]
    end

    subgraph "布局层"
        SB["StatusBar<br/>顶部状态栏"]
        ST["SessionTabs<br/>会话标签栏"]
        TC["TerminalContainer<br/>终端区域"]
    end

    subgraph "功能层"
        FE["FileExplorer<br/>文件浏览器"]
        SD["SettingsDrawer<br/>设置面板"]
        CE["CodeEditor<br/>代码编辑器"]
        QAP["QuickActionsPanel<br/>快捷操作"]
        CO["ConnectionOverlay<br/>连接遮罩"]
    end

    Main --> EB
    EB --> App
    App -->|未登录| LF
    App -->|已登录| LoggedIn
    LoggedIn --> SB
    SB --> FE
    SB --> SD
    LoggedIn --> ST
    LoggedIn --> TC
    TC --> CO
    TC --> QAP
    App -->|懒加载| CE
```

### 组件的分类

| 分类方式 | 类型 | 说明 | 项目示例 |
|---------|------|------|---------|
| **按功能** | 展示组件 | 只负责显示 UI | `StatusBar`、`SessionTabs` |
| | 容器组件 | 负责业务逻辑 | `TerminalContainer`、`App` |
| **按状态** | 有状态组件 | 拥有自己的 state | `FileExplorer`、`LoginForm` |
| | 无状态组件 | 没有 state，纯展示 | `StatusBar`（使用外部 store） |
| **按定义** | 函数组件 | 现代写法，使用 Hooks | 项目中所有组件 |
| | 类组件 | 传统写法，使用 class | `ErrorBoundary`（必须用类） |

### 为什么要组件化？

```mermaid
graph LR
    subgraph "不组件化"
        A["一个巨大的文件<br/>1000+ 行代码"] --> B["难以理解"]
        B --> C["难以修改"]
        C --> D["难以复用"]
        D --> E["难以测试"]
    end

    subgraph "组件化后"
        F["多个小组件<br/>每个 50-100 行"] --> G["职责清晰"]
        G --> H["独立修改"]
        H --> I["随处复用"]
        I --> J["单独测试"]
    end
```

---

## 1.3 JSX 语法详解

### 什么是 JSX？

JSX 是 JavaScript XML 的缩写，它让你可以在 JavaScript 中写类似 HTML 的代码。

**重要**：JSX 不是 HTML，它最终会被编译成 JavaScript 函数调用。

```typescript
// 你写的 JSX
const element = <h1 className="title">Hello, React!</h1>

// 编译后的 JavaScript（React 17+ 的自动导入模式）
import { jsx as _jsx } from 'react/jsx-runtime'
const element = _jsx('h1', { className: 'title', children: 'Hello, React!' })
```

### JSX 与 HTML 的区别

| 特性 | HTML | JSX | 原因 |
|------|------|-----|------|
| **class 属性** | `class="box"` | `className="box"` | `class` 是 JS 保留字 |
| **for 属性** | `for="input"` | `htmlFor="input"` | `for` 是 JS 保留字 |
| **自闭合标签** | `<br>` `<img>` | `<br />` `<img />` | JSX 要求所有标签闭合 |
| **样式属性** | `style="color:red"` | `style={{ color: 'red' }}` | 接收 JS 对象 |
| **事件绑定** | `onclick="fn()"` | `onClick={fn}` | 驼峰命名 + JS 表达式 |
| **注释** | `<!-- comment -->` | `{/* comment */}` | 在花括号内写 JS 注释 |
| **布尔属性** | `<input disabled>` | `<input disabled={true} />` | 显式传递布尔值 |

### JSX 中嵌入 JavaScript 表达式

JSX 使用花括号 `{}` 来嵌入任何 JavaScript 表达式：

```typescript
function Greeting({ name }: { name: string }) {
  const now = new Date()
  const hour = now.getHours()

  return (
    <div>
      {/* 字符串插值 */}
      <h1>你好，{name}！</h1>

      {/* 三元表达式 */}
      <p>{hour < 12 ? '早上好' : '下午好'}</p>

      {/* 函数调用 */}
      <span>当前时间：{now.toLocaleTimeString()}</span>

      {/* 属性中使用表达式 */}
      <img src={`/avatars/${name}.png`} alt={name} />

      {/* 对象表达式（双花括号） */}
      <div style={{ color: 'white', fontSize: 14 }}>
        样式也是表达式
      </div>
    </div>
  )
}
```

### JSX 的编译过程

```mermaid
graph LR
    A["JSX 源代码<br/><LoginForm />"] -->|Babel/SWC 编译| B["createElement 调用<br/>React.createElement(LoginForm)"]
    B -->|创建| C["React Element<br/>普通 JS 对象"]
    C -->|渲染| D["Virtual DOM"]
    D -->|Diff| E["真实 DOM"]
```

### 项目中的 JSX 实例

让我们看 AI-CLI-Mobile 中 `StatusBar` 组件的 JSX：

```typescript
// apps/web/src/components/StatusBar.tsx（简化版）
export const StatusBar = memo(function StatusBar({
  actionsSlot
}: {
  actionsSlot?: React.ReactNode
}) {
  const { connectionPhase, agentStatus, sessions, activeSessionIndex } = useSessionStore()

  // JSX 中使用三元表达式做条件渲染
  const dotColor =
    connectionPhase === 'CONNECTED'
      ? 'bg-green-500'
      : connectionPhase === 'DISCONNECTED'
        ? 'bg-red-500'
        : 'bg-yellow-500'

  return (
    <div className="flex items-center gap-2 px-3 h-[40px] bg-dark-surface">
      {/* 动态 className */}
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />

      {/* 条件渲染：只有 RUNNING 才显示旋转图标 */}
      <span className={`px-1.5 py-0.5 rounded ${config.className}`}>
        {config.icon === 'spin' && <Loader2 className="w-3 h-3 animate-spin" />}
        {config.label}
      </span>

      {/* 可选渲染：有 session 才显示 label */}
      {sessions[activeSessionIndex] && (
        <span className="text-gray-500 truncate">
          {sessions[activeSessionIndex].label}
        </span>
      )}

      {/* 插槽模式：外部传入的 UI */}
      {actionsSlot}
    </div>
  )
})
```

---

## 1.4 Props：组件的"参数"

### 什么是 Props？

Props（属性）是组件接收的参数，就像函数的参数一样。Props 是**只读的**，组件不能修改自己的 props。

```mermaid
graph LR
    subgraph "父组件 App"
        A["<LoginForm onLogin={login} />"]
    end
    A -->|"props = { onLogin: login }"| B["子组件 LoginForm"]
    B -->|"调用 props.onLogin()"| C["触发父组件的 login 函数"]
```

### Props 的基本用法

```typescript
// 定义组件时声明 props 类型
interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>
}

// 使用解构赋值获取 props
export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await onLogin(username, password)  // 调用父组件传入的函数
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={username} onChange={(e) => setUsername(e.target.value)} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
      <button type="submit">登录</button>
    </form>
  )
}
```

### Props 的类型

| Props 类型 | 说明 | 示例 |
|-----------|------|------|
| **基础类型** | string、number、boolean | `<StatusBar title="Hello" count={5} />` |
| **函数** | 回调函数 | `<LoginForm onLogin={login} />` |
| **JSX 元素** | ReactNode、ReactElement | `<StatusBar actionsSlot={<Button />} />` |
| **对象** | 复杂数据结构 | `<Terminal config={{ fontSize: 14 }} />` |
| **数组** | 列表数据 | `<SessionTabs sessions={[...]} />` |
| **可选** | 带默认值 | `{ actionsSlot?: React.ReactNode }` |

### Props 的传递模式

```mermaid
graph TD
    subgraph "Props 传递模式"
        direction TB
        P1["直接传递"]
        P2["解构传递"]
        P3["展开传递"]
        P4["children 特殊 prop"]
    end

    P1 --> E1["<Comp name='hello' />"]
    P2 --> E2["function Comp({ name }) { ... }"]
    P3 --> E3["<Comp {...props} />"]
    P4 --> E4["<Comp><Child /></Comp>"]
```

### 项目实例：StatusBar 的 actionsSlot

```typescript
// 父组件 App.tsx 中传递 props
<StatusBar
  actionsSlot={
    <>
      <FileExplorer onFileSelect={(path, content, language) =>
        setEditorFile({ path, content, language })
      } />
      <SettingsDrawer trigger={
        <button className="ml-1 p-1 text-gray-400">
          <Settings className="w-4 h-4" />
        </button>
      } />
    </>
  }
/>

// 子组件 StatusBar.tsx 中使用 props
export const StatusBar = memo(function StatusBar({
  actionsSlot
}: {
  actionsSlot?: React.ReactNode  // 可选的 JSX 元素
}) {
  return (
    <div className="flex items-center">
      {/* ... 其他内容 ... */}
      {actionsSlot}  {/* 渲染外部传入的 UI */}
    </div>
  )
})
```

> 💡 **关键理解**：`actionsSlot` 是一个"插槽"模式——父组件决定要放什么内容，子组件决定放在哪里。这是 React 组合模式的核心。

---

## 1.5 State：组件的"记忆"

### 什么是 State？

State 是组件内部的可变数据。当 state 变化时，React 会自动重新渲染组件。

```mermaid
graph LR
    subgraph "State 驱动渲染"
        A["初始 State<br/>{ count: 0 }"] -->|"渲染"| B["UI: 显示 0"]
        C["用户点击按钮"] -->|"setState(1)"| D["新 State<br/>{ count: 1 }"]
        D -->|"重新渲染"| E["UI: 显示 1"]
    end
```

### State 与 Props 的区别

| 特性 | State（状态） | Props（属性） |
|------|-------------|-------------|
| **谁控制** | 组件自己 | 父组件传入 |
| **可变性** | 可以通过 setState 修改 | 只读，不能修改 |
| **来源** | 组件内部定义 | 从父组件接收 |
| **用途** | 存储组件的内部数据 | 配置组件、传递数据 |
| **变化时** | 组件重新渲染 | 组件重新渲染 |

### 使用 useState Hook

```typescript
import { useState } from 'react'

function Counter() {
  // useState 返回 [当前值, 修改函数]
  const [count, setCount] = useState(0)  // 初始值为 0

  return (
    <div>
      <p>你点击了 {count} 次</p>
      <button onClick={() => setCount(count + 1)}>
        点击 +1
      </button>
      <button onClick={() => setCount(prev => prev - 1)}>
        点击 -1（函数式更新）
      </button>
    </div>
  )
}
```

### State 更新的规则

```typescript
// ❌ 错误：直接修改 state
count = count + 1  // 不会触发重新渲染！

// ❌ 错误：修改对象 state 的属性
user.name = 'new name'  // 不会触发重新渲染！

// ✅ 正确：使用 setState 函数
setCount(count + 1)

// ✅ 正确：函数式更新（推荐，避免闭包问题）
setCount(prev => prev + 1)

// ✅ 正确：创建新对象
setUser({ ...user, name: 'new name' })

// ✅ 正确：创建新数组
setItems([...items, newItem])
```

### 项目实例：LoginForm 的 State

```typescript
// apps/web/src/components/LoginForm.tsx
export const LoginForm = memo(function LoginForm({
  onLogin
}: {
  onLogin: (username: string, password: string) => Promise<void>
}) {
  // 四个独立的 state
  const [username, setUsername] = useState('')     // 用户名
  const [password, setPassword] = useState('')     // 密码
  const [error, setError] = useState('')           // 错误信息
  const [loading, setLoading] = useState(false)    // 加载状态

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    // 客户端验证
    if (password.length < 6) {
      setError('密码长度不能少于 6 位')
      return
    }

    setLoading(true)  // 开始加载
    try {
      await onLogin(username, password)  // 调用父组件传入的登录函数
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)  // 无论成功失败都停止加载
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-400">{error}</p>}
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        placeholder="密码"
      />
      <button disabled={loading || !username || !password}>
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  )
})
```

---

## 1.6 生命周期：组件的一生

### 什么是生命周期？

组件从创建到销毁会经历一系列阶段，这就是组件的生命周期。

```mermaid
graph TD
    subgraph "组件生命周期"
        A["创建阶段<br/>Mounting"] -->|"组件插入 DOM"| B["更新阶段<br/>Updating"]
        B -->|"状态或属性变化"| B
        B -->|"组件移除"| C["卸载阶段<br/>Unmounting"]
    end

    A --> A1["constructor / 初始化"]
    A1 --> A2["render"]
    A2 --> A3["componentDidMount / useEffect"]

    B --> B1["render（重新渲染）"]
    B1 --> B2["componentDidUpdate / useEffect"]

    C --> C1["componentWillUnmount / useEffect cleanup"]
```

### 函数组件的生命周期：useEffect

在函数组件中，`useEffect` 统一处理了所有生命周期相关的逻辑：

```typescript
import { useEffect } from 'react'

function MyComponent() {
  // 🔵 挂载时执行（componentDidMount）
  useEffect(() => {
    console.log('组件挂载了')

    // 🔴 卸载时执行（componentWillUnmount）
    return () => {
      console.log('组件卸载了')
    }
  }, [])  // 空依赖数组 = 只在挂载和卸载时执行

  // 🟡 每次 count 变化时执行（componentDidUpdate）
  useEffect(() => {
    console.log('count 变化了:', count)
  }, [count])  // 依赖数组包含 count

  // 🟠 每次渲染后执行（没有依赖数组）
  useEffect(() => {
    console.log('每次渲染都会执行')
  })

  return <div>Hello</div>
}
```

### useEffect 的依赖数组

| 依赖数组 | 执行时机 | 等价生命周期 | 使用场景 |
|---------|---------|-------------|---------|
| `[]` | 挂载时 + 卸载清理 | componentDidMount + componentWillUnmount | 初始化、订阅、定时器 |
| `[a, b]` | a 或 b 变化时 | componentDidUpdate（特定值） | 响应特定数据变化 |
| 不传 | 每次渲染后 | componentDidUpdate（每次） | ⚠️ 很少使用，可能死循环 |

### 类组件 vs 函数组件生命周期对照

| 类组件生命周期 | 函数组件等价写法 |
|-------------|---------------|
| `constructor` | `useState` 初始值 |
| `componentDidMount` | `useEffect(() => {}, [])` |
| `componentDidUpdate` | `useEffect(() => {}, [deps])` |
| `componentWillUnmount` | `useEffect(() => { return cleanup }, [])` |
| `shouldComponentUpdate` | `React.memo` |
| `getDerivedStateFromError` | 无直接等价（用 ErrorBoundary 类组件） |
| `componentDidCatch` | 无直接等价（用 ErrorBoundary 类组件） |

### 项目实例：TerminalContainer 的 useEffect

```typescript
// apps/web/src/components/TerminalContainer.tsx
export function TerminalContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)

  // 📌 挂载时初始化终端
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: getXtermTheme(theme),
      fontSize,
      cursorBlink: true,
      scrollback: 5000,
    })

    term.open(containerRef.current)
    termRef.current = term

    // 📌 卸载时清理
    return () => {
      if (term.element && term.element.parentNode) {
        term.element.parentNode.removeChild(term.element)
      }
    }
  }, [])  // 空依赖 = 只执行一次

  // 📌 fontSize 变化时同步到终端
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize
      fitAddonRef.current?.fit()
    }
  }, [fontSize])  // 依赖 fontSize

  // 📌 主题变化时同步
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getXtermTheme(theme)
    }
  }, [theme])  // 依赖 theme

  // 📌 窗口大小变化时重新适配
  useEffect(() => {
    function handleResize() {
      fitAddonRef.current?.fit()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])  // 空依赖 = 只绑定一次

  return <div ref={containerRef} className="w-full h-full" />
}
```

---

## 1.7 事件处理

### React 事件系统

React 使用**合成事件（SyntheticEvent）**系统，它是浏览器原生事件的包装层：

```mermaid
graph TD
    A["用户点击按钮"] -->|原生 DOM 事件| B["React 事件系统"]
    B -->|合成事件| C["你的事件处理函数"]
    C -->|"访问 event.target 等"| D["与原生事件相同的 API"]
```

### 常见事件类型

| 事件类型 | React 写法 | HTML 写法 | 用途 |
|---------|-----------|----------|------|
| 点击 | `onClick` | `onclick` | 按钮点击 |
| 输入 | `onChange` | `onchange` | 输入框变化 |
| 提交 | `onSubmit` | `onsubmit` | 表单提交 |
| 聚焦 | `onFocus` | `onfocus` | 输入框获得焦点 |
| 失焦 | `onBlur` | `onblur` | 输入框失去焦点 |
| 键盘 | `onKeyDown` | `onkeydown` | 按键按下 |
| 鼠标进入 | `onMouseEnter` | `onmouseenter` | 鼠标悬停 |
| 触摸开始 | `onTouchStart` | `ontouchstart` | 手机触摸 |

### 事件处理的写法

```typescript
function MyComponent() {
  // 方式 1：内联箭头函数（简单场景）
  return <button onClick={() => console.log('clicked')}>Click</button>

  // 方式 2：定义处理函数（推荐，可读性好）
  function handleClick() {
    console.log('clicked')
  }
  return <button onClick={handleClick}>Click</button>

  // 方式 3：需要传参时
  function handleDelete(id: string) {
    console.log('deleting', id)
  }
  return <button onClick={() => handleDelete(item.id)}>Delete</button>
}

// 方式 4：使用 useCallback 避免不必要的重渲染
const handleClick = useCallback(() => {
  doSomething()
}, [])
return <button onClick={handleClick}>Click</button>
```

### 项目实例：SessionTabs 的事件处理

```typescript
// apps/web/src/components/SessionTabs.tsx
export const SessionTabs = memo(function SessionTabs() {
  const switchSession = useSessionStore((s) => s.switchSession)
  const removeSession = useSessionStore((s) => s.removeSession)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 点击标签 → 切换会话
  const handleTabPress = useCallback((index: number) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    switchSession(index)
  }, [switchSession])

  // 长按标签 → 删除会话（600ms 触发）
  const handleTabLongPressStart = useCallback((index: number) => {
    longPressTimerRef.current = setTimeout(() => {
      removeSession(index)
    }, 600)
  }, [removeSession])

  // 手指松开 → 取消长按
  const handleTabLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }
  }, [])

  return (
    <div className="flex gap-1 px-2 py-1.5">
      {sessions.map((session, index) => (
        <button
          key={session.id}
          onClick={() => handleTabPress(index)}
          // 同时支持鼠标和触摸的长按
          onMouseDown={() => handleTabLongPressStart(index)}
          onMouseUp={handleTabLongPressEnd}
          onMouseLeave={handleTabLongPressEnd}
          onTouchStart={() => handleTabLongPressStart(index)}
          onTouchEnd={handleTabLongPressEnd}
        >
          {session.id.slice(0, 8)}
        </button>
      ))}
    </div>
  )
})
```

---

## 1.8 条件渲染与列表渲染

### 条件渲染的方式

```typescript
// 方式 1：三元表达式
{isLoggedIn ? <Dashboard /> : <LoginForm />}

// 方式 2：逻辑与（只在条件为 true 时渲染）
{error && <p className="error">{error}</p>}
{config.icon === 'spin' && <Loader2 className="animate-spin" />}

// 方式 3：提前 return（在 JSX 之前）
if (!isAuthenticated) {
  return <LoginForm onLogin={login} />
}
// 下面是已登录的 UI...

// 方式 4：变量存储 JSX
let content
if (loading) {
  content = <Spinner />
} else if (error) {
  content = <ErrorMessage />
} else {
  content = <DataView />
}
return <div>{content}</div>
```

### 列表渲染

```typescript
function SessionTabs({ sessions }: { sessions: SessionEntry[] }) {
  return (
    <div>
      {sessions.map((session) => (
        // ⚠️ key 是必须的！帮助 React 识别哪些元素变化了
        <button key={session.id}>
          {session.label}
        </button>
      ))}
    </div>
  )
}
```

### key 的重要性

| key 的选择 | 好坏 | 原因 |
|-----------|------|------|
| `key={item.id}` | ✅ 好 | 稳定唯一标识 |
| `key={index}` | ⚠️ 不推荐 | 列表重排时会导致不必要的重渲染 |
| 没有 key | ❌ 错误 | React 会警告，性能差 |

### 项目实例：SessionTabs 的列表渲染

```typescript
// apps/web/src/components/SessionTabs.tsx
const STATUS_COLORS: Record<AgentStatus, string> = {
  IDLE: 'bg-gray-400',
  RUNNING: 'bg-green-400 animate-pulse',
  WAITING_APPROVAL: 'bg-yellow-400 animate-pulse',
  ERROR: 'bg-red-400',
}

export const SessionTabs = memo(function SessionTabs() {
  const sessions = useSessionStore((s) => s.sessions)

  // 条件渲染：只有一个 session 时不显示标签栏
  if (sessions.length <= 1) return null

  return (
    <div className="flex items-center gap-1 px-2">
      {/* 列表渲染 */}
      {sessions.map((session, index) => (
        <button
          key={session.id}  // 使用 session.id 作为 key
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded ${
            index === activeSessionIndex
              ? 'bg-dark-border text-gray-100'      // 激活样式
              : 'text-gray-400 hover:text-gray-200'  // 非激活样式
          }`}
        >
          {/* 状态指示灯（条件渲染 + 动态样式） */}
          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[session.status]}`} />
          <span>{session.id.slice(0, 8)}</span>
        </button>
      ))}

      {/* 添加按钮 */}
      <button onClick={() => addSession()}>
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
})
```

---

## 1.9 本章小结

```mermaid
graph TD
    subgraph "第一章核心概念"
        A["React 是什么"] --> B["组件化思想"]
        B --> C["JSX 语法"]
        C --> D["Props 传递数据"]
        D --> E["State 管理状态"]
        E --> F["生命周期管理"]
        F --> G["事件处理"]
        G --> H["条件/列表渲染"]
    end
```

| 概念 | 一句话总结 | 关键代码 |
|------|----------|---------|
| **组件** | UI 的积木块 | `function MyComp() { return <div /> }` |
| **JSX** | JavaScript + XML 的混合语法 | `<div className="box">{name}</div>` |
| **Props** | 父组件传给子组件的参数 | `<Comp name="hello" />` |
| **State** | 组件内部的可变数据 | `const [count, setCount] = useState(0)` |
| **useEffect** | 处理副作用和生命周期 | `useEffect(() => { ... }, [deps])` |
| **事件** | 响应用户交互 | `<button onClick={handler} />` |
| **条件渲染** | 根据条件显示不同 UI | `{isTrue && <Comp />}` |
| **列表渲染** | 将数组映射为 UI | `{items.map(i => <Item key={i.id} />)}` |

---

# 第二章：React Hooks 深度解析

## 2.1 什么是 Hooks？

Hooks 是 React 16.8 引入的特性，它让函数组件也能拥有状态和生命周期等能力。

### Hooks 出现之前的问题

```mermaid
graph TD
    subgraph "类组件的问题"
        A["逻辑分散在不同生命周期"] --> B["componentDidMount<br/>设置订阅"]
        A --> C["componentDidUpdate<br/>更新订阅"]
        A --> D["componentWillUnmount<br/>取消订阅"]
        B --> E["相关逻辑被拆散<br/>难以理解"]
        C --> E
        D --> E

        F["难以复用状态逻辑"] --> G["需要 HOC 或 Render Props"]
        G --> H["嵌套地狱<br/>Wrapper Hell"]
    end

    subgraph "Hooks 的解决方案"
        I["相关逻辑集中在一个 useEffect"] --> J["代码更清晰"]
        K["自定义 Hook 复用逻辑"] --> L["无嵌套，直接调用"]
    end
```

### Hooks 的优势

| 特性 | 类组件 | 函数组件 + Hooks |
|------|--------|-----------------|
| **代码量** | 较多（constructor、this 绑定等） | 较少 |
| **逻辑复用** | HOC / Render Props（复杂） | 自定义 Hook（简单） |
| **逻辑组织** | 分散在各生命周期 | 按功能组织在一起 |
| **this 问题** | 需要 bind this | 没有 this |
| **TypeScript** | 类型推断较弱 | 类型推断更好 |
| **测试** | 需要实例化类 | 普通函数调用 |

---

## 2.2 useState：让函数组件拥有状态

### 基本用法

```typescript
const [state, setState] = useState(initialValue)
```

### 不同类型的 State

```typescript
// 1. 基础类型
const [count, setCount] = useState(0)
const [name, setName] = useState('')
const [isOpen, setIsOpen] = useState(false)

// 2. 对象类型（必须创建新对象！）
const [user, setUser] = useState({ name: '', age: 0 })
setUser({ ...user, name: 'Alice' })  // ✅ 创建新对象
// setUser({ name: 'Alice', age: user.age })  // 等价写法

// 3. 数组类型（必须创建新数组！）
const [items, setItems] = useState<string[]>([])
setItems([...items, 'new item'])  // ✅ 添加
setItems(items.filter(i => i !== 'old'))  // ✅ 删除

// 4. 惰性初始化（初始值计算成本高时）
const [data, setData] = useState(() => {
  return JSON.parse(localStorage.getItem('data') || '{}')
})
```

### 函数式更新

```typescript
// ❌ 问题：可能读到旧的 count（闭包问题）
setCount(count + 1)
setCount(count + 1)  // 两次调用，但只加了 1

// ✅ 解决：函数式更新，始终基于最新值
setCount(prev => prev + 1)
setCount(prev => prev + 1)  // 两次调用，正确加了 2
```

### 项目实例：LoginForm 多个 useState

```typescript
// apps/web/src/components/LoginForm.tsx
export const LoginForm = memo(function LoginForm({ onLogin }) {
  // 每个独立的 UI 状态用独立的 useState
  const [username, setUsername] = useState('')    // 输入框的值
  const [password, setPassword] = useState('')    // 输入框的值
  const [error, setError] = useState('')          // 错误信息
  const [loading, setLoading] = useState(false)   // 是否正在提交

  // ...
})
```

### 什么时候合并 State？

```typescript
// ✅ 状态之间有关联时，合并为对象
const [position, setPosition] = useState({ x: 0, y: 0 })
// 移动时需要同时更新 x 和 y
setPosition({ x: 10, y: 20 })

// ✅ 状态之间独立时，分开定义
const [username, setUsername] = useState('')
const [password, setPassword] = useState('')
// 用户名和密码是独立的
```

---

## 2.3 useEffect：副作用处理

### 什么是副作用？

副作用是指组件渲染之外的操作：

```mermaid
graph LR
    subgraph "纯操作（不是副作用）"
        A["计算值"]
        B["格式化数据"]
        C["返回 JSX"]
    end

    subgraph "副作用"
        D["网络请求"]
        E["操作 DOM"]
        F["设置定时器"]
        G["订阅事件"]
        H["写入 localStorage"]
        I["WebSocket 连接"]
    end
```

### useEffect 的三种模式

```typescript
// 模式 1：只在挂载时执行（空依赖数组）
useEffect(() => {
  // 初始化操作
  const timer = setInterval(() => {}, 1000)

  // 清理函数：卸载时执行
  return () => clearInterval(timer)
}, [])

// 模式 2：依赖变化时执行
useEffect(() => {
  // 当 userId 变化时重新获取数据
  fetchUser(userId)

  // 清理上一次的请求（避免竞态条件）
  return () => abortController.abort()
}, [userId])

// 模式 3：每次渲染后执行（无依赖数组）
useEffect(() => {
  console.log('rendered')
  // ⚠️ 小心：可能造成性能问题
})
```

### 清理函数的重要性

```typescript
// ✅ 正确：设置定时器 + 清理
useEffect(() => {
  const timer = setInterval(() => {
    console.log('tick')
  }, 1000)

  return () => clearInterval(timer)  // 组件卸载时清理
}, [])

// ✅ 正确：事件监听 + 清理
useEffect(() => {
  function handleResize() {
    console.log('window resized')
  }
  window.addEventListener('resize', handleResize)

  return () => window.removeEventListener('resize', handleResize)
}, [])

// ✅ 正确：WebSocket + 清理
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080')
  ws.onmessage = handleMessage

  return () => ws.close()
}, [])
```

### 项目实例：TerminalContainer 的多个 useEffect

```typescript
// apps/web/src/components/TerminalContainer.tsx

// useEffect 1：初始化终端实例（挂载时）
useEffect(() => {
  const term = new Terminal({ fontSize, theme: getXtermTheme(theme) })
  term.open(containerRef.current)
  termRef.current = term

  // 清理：移除 DOM 元素（但不 dispose，遵循 ADR-011）
  return () => {
    if (term.element && term.element.parentNode) {
      term.element.parentNode.removeChild(term.element)
    }
  }
}, [])  // 空依赖 → 只执行一次

// useEffect 2：fontSize 变化时同步
useEffect(() => {
  if (termRef.current) {
    termRef.current.options.fontSize = fontSize
    fitAddonRef.current?.fit()
  }
}, [fontSize])  // fontSize 变化时执行

// useEffect 3：窗口 resize 事件
useEffect(() => {
  function handleResize() {
    fitAddonRef.current?.fit()
  }
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])

// useEffect 4：连接 WebSocket
useEffect(() => {
  if (!termRef.current || !accessToken || !sessionId) return
  if (!isConnected && connectionPhase === 'DISCONNECTED') {
    const { cols, rows } = termRef.current
    connect(sessionId, cols, rows, termRef.current)
  }
}, [sessionId, isConnected, connectionPhase, connect])

// useEffect 5：visibilitychange 事件
useEffect(() => {
  function handleVisibilityChange() {
    const term = termRef.current
    if (!term || !term.element) return

    if (document.hidden) {
      // 页面隐藏时：从 DOM 移除但保留实例
      if (term.element.parentNode) {
        term.element.parentNode.removeChild(term.element)
      }
    } else {
      // 页面显示时：重新挂载到 DOM
      if (containerRef.current && !term.element.parentNode) {
        containerRef.current.appendChild(term.element)
        fitAddonRef.current?.fit()
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])
```

---

## 2.4 useRef：可变引用容器

### useRef 的两种用途

```mermaid
graph TD
    subgraph "useRef 的用途"
        A["useRef"] --> B["访问 DOM 元素"]
        A --> C["存储可变值<br/>（不触发重渲染）"]
    end

    B --> B1["inputRef.current.focus()"]
    B --> B2["containerRef.current.getBoundingClientRect()"]

    C --> C1["timerRef.current = setTimeout()"]
    C --> C2["prevValueRef.current = value"]
    C --> C3["wsRef.current = new WebSocket()"]
```

### useRef vs useState

| 特性 | useRef | useState |
|------|--------|----------|
| **变化时** | 不触发重渲染 | 触发重渲染 |
| **访问方式** | `.current` 属性 | 直接访问 |
| **修改方式** | `.current = newValue` | `setState(newValue)` |
| **使用场景** | DOM 引用、定时器、上一次的值 | 需要反映在 UI 上的数据 |

```typescript
// useRef：存储定时器 ID（不需要显示在 UI 上）
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
timerRef.current = setTimeout(() => {}, 1000)
// 修改 timerRef.current 不会触发重渲染

// useState：存储倒计时数值（需要显示在 UI 上）
const [countdown, setCountdown] = useState(10)
setCountdown(prev => prev - 1)
// 修改 countdown 会触发重渲染，UI 更新显示
```

### 项目实例：useRef 的多种用法

```typescript
// apps/web/src/hooks/useAuth.ts

// 用途 1：存储定时器引用（清理用）
const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// 用途 2：存储函数引用（避免闭包过期）
const doRefreshTokenRef = useRef<() => Promise<string>>()
doRefreshTokenRef.current = async () => {
  // 始终读取最新的 refreshToken
  const currentRefresh = useSessionStore.getState().refreshToken
  if (!currentRefresh) throw new Error('No refresh token')
  // ...刷新逻辑
}

// 清理定时器
useEffect(() => {
  return () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }
  }
}, [])
```

```typescript
// apps/web/src/components/TerminalContainer.tsx

// 用途 3：DOM 元素引用
const containerRef = useRef<HTMLDivElement>(null)
// 使用：containerRef.current 指向真实的 DOM 元素

// 用途 4：存储 WebSocket 实例
const termWsRef = useRef<WebSocket | null>(null)

// 用途 5：追踪上一次的值
const accessTokenRef = useRef(accessToken)
useEffect(() => { accessTokenRef.current = accessToken }, [accessToken])

// 用途 6：防止重复连接
const isConnectingRef = useRef(false)
```

---

## 2.5 useCallback：记忆函数

### 什么是 useCallback？

`useCallback` 缓存一个函数引用，只有当依赖变化时才创建新的函数。

```typescript
// 没有 useCallback：每次渲染都创建新函数
function handleClick() {
  console.log(count)
}

// 有 useCallback：缓存函数引用
const handleClick = useCallback(() => {
  console.log(count)
}, [count])  // 只有 count 变化时才创建新函数
```

### 为什么需要 useCallback？

```mermaid
graph TD
    subgraph "没有 useCallback"
        A["父组件重渲染"] --> B["每次创建新的 handleClick"]
        B --> C["子组件收到新的函数引用"]
        C --> D["子组件认为 props 变了"]
        D --> E["子组件不必要的重渲染 ❌"]
    end

    subgraph "有 useCallback"
        F["父组件重渲染"] --> G["返回缓存的 handleClick"]
        G --> H["子组件收到相同的函数引用"]
        H --> I["子组件认为 props 没变"]
        I --> J["子组件跳过渲染 ✅"]
    end
```

### 使用场景

| 场景 | 是否需要 useCallback | 原因 |
|------|---------------------|------|
| 传递给 `React.memo` 子组件 | ✅ 需要 | 否则 memo 失效 |
| 作为 `useEffect` 依赖 | ✅ 需要 | 否则 effect 频繁执行 |
| 传递给普通子组件 | ⚠️ 可选 | 通常不需要 |
| 事件处理器（简单） | ❌ 不需要 | 过度优化 |

### 项目实例

```typescript
// apps/web/src/hooks/useDualChannelWS.ts

// useCallback 缓存 WebSocket 操作函数
const connect = useCallback((
  sessionId: string,
  cols: number,
  rows: number,
  term: Terminal
) => {
  reconnectDelayRef.current = INITIAL_RECONNECT_DELAY
  closeSockets()
  clearAllTimers()
  isConnectingRef.current = false
  connectInternal(sessionId, cols, rows, term)
}, [])  // 空依赖 → 函数引用永远不变

const disconnect = useCallback(() => {
  sessionRef.current = null
  termRef.current = null
  closeSockets()
  clearAllTimers()
  isConnectingRef.current = false
  store.getState().setDisconnected()
}, [])

const sendInput = useCallback((data: string | Uint8Array) => {
  const ws = termWsRef.current
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(data)
  } else {
    offlineCacheRef.current?.queueInput(data)
  }
}, [])

// 返回的函数引用稳定，不会导致下游组件重渲染
return {
  connect,      // ✅ 稳定引用
  disconnect,   // ✅ 稳定引用
  sendInput,    // ✅ 稳定引用
  sendResize,   // ✅ 稳定引用
  sendQuickAction,
  sendInjectCode,
  reconnectCount,
}
```

---

## 2.6 useMemo：记忆值

### 什么是 useMemo？

`useMemo` 缓存一个计算结果，只有当依赖变化时才重新计算。

```typescript
// 没有 useMemo：每次渲染都重新计算
const expensiveResult = heavyComputation(data)

// 有 useMemo：缓存计算结果
const expensiveResult = useMemo(() => heavyComputation(data), [data])
```

### useMemo vs useCallback

| 特性 | useMemo | useCallback |
|------|---------|------------|
| **缓存什么** | 计算结果（值） | 函数引用 |
| **返回值** | 值本身 | 函数本身 |
| **等价写法** | `useMemo(() => value, [deps])` | `useMemo(() => fn, [deps])` |
| **使用场景** | 昂贵的计算、复杂对象创建 | 回调函数 |

```typescript
// useCallback(fn, deps) 等价于 useMemo(() => fn, deps)
const handleClick = useCallback(() => doSomething(), [dep])
const handleClick = useMemo(() => () => doSomething(), [dep])
// 两者完全等价
```

### 使用场景

```typescript
// 场景 1：昂贵的计算
const filteredList = useMemo(() => {
  return items.filter(item =>
    item.name.includes(search) &&
    item.category === selectedCategory
  )
}, [items, search, selectedCategory])

// 场景 2：创建复杂对象（避免子组件重渲染）
const theme = useMemo(() => ({
  colors: { bg: '#1a1b26', fg: '#c0caf5' },
  fontSize: size,
}), [size])

// 场景 3：作为其他 Hook 的依赖
const stableConfig = useMemo(() => ({ wsUrl, timeout }), [wsUrl, timeout])
useEffect(() => {
  const ws = new WebSocket(stableConfig.wsUrl)
  // ...
}, [stableConfig])  // stableConfig 不变就不会重新连接
```

---

## 2.7 自定义 Hooks

### 什么是自定义 Hook？

自定义 Hook 是一个以 `use` 开头的普通函数，它可以调用其他 Hooks，封装可复用的状态逻辑。

```mermaid
graph TD
    subgraph "自定义 Hook 的本质"
        A["自定义 Hook<br/>useMyHook()"] -->|调用| B["useState"]
        A -->|调用| C["useEffect"]
        A -->|调用| D["useRef"]
        A -->|调用| E["useCallback"]
        A -->|返回| F["状态 + 操作函数"]
    end
```

### 项目实例 1：useAuth

```typescript
// apps/web/src/hooks/useAuth.ts
export function useAuth() {
  const { accessToken, setTokens } = useSessionStore()
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doRefreshTokenRef = useRef<() => Promise<string>>()

  // 内部函数：刷新 token
  doRefreshTokenRef.current = async () => {
    const currentRefresh = useSessionStore.getState().refreshToken
    if (!currentRefresh) throw new Error('No refresh token')

    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: currentRefresh }),
    })

    if (!res.ok) throw new Error('Refresh failed')
    const data = await res.json()
    setTokens(data.accessToken, currentRefresh)
    return data.accessToken
  }

  // 内部函数：计划 token 续期
  const scheduleTokenRenewal = useCallback((token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    const expiresAt = parseJwtExp(token)
    const refreshIn = expiresAt - Date.now() - 2 * 60 * 1000  // 提前 2 分钟
    if (refreshIn <= 0) return

    refreshTimerRef.current = setTimeout(async () => {
      try { await doRefreshTokenRef.current?.() }
      catch { /* 静默失败 */ }
    }, refreshIn)
  }, [])

  // 登录函数
  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (!res.ok) throw new Error('Login failed')
    const data = await res.json()
    setTokens(data.accessToken, data.refreshToken)
    scheduleTokenRenewal(data.accessToken)
  }, [setTokens, scheduleTokenRenewal])

  // 从存储加载认证信息
  const loadStoredAuth = useCallback(() => {
    const stored = getStoredTokens()
    if (!stored) return false
    // ... 检查 token 有效期，自动刷新等
  }, [setTokens, scheduleTokenRenewal])

  // 登出函数
  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    setTokens('', '')
    clearStoredTokens()
    useSessionStore.getState().reset()
  }, [setTokens])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [])

  // 返回给使用者的接口
  return {
    accessToken,
    isAuthenticated: !!accessToken,
    login,
    logout,
    loadStoredAuth,
    refreshToken: async () => doRefreshTokenRef.current?.() ?? '',
  }
}
```

### 项目实例 2：useDualChannelWS

```typescript
// apps/web/src/hooks/useDualChannelWS.ts
export function useDualChannelWS(
  getAccessToken: () => string | null,
  getRefreshToken: () => Promise<string>,
  onAuthFailure: () => void,
): UseDualChannelWS {
  const reconnectCountRef = useRef(0)
  const [reconnectCount, setReconnectCount] = useState(0)
  const termWsRef = useRef<WebSocket | null>(null)
  const ctrlWsRef = useRef<WebSocket | null>(null)
  // ... 更多 ref

  // 内部函数：清理定时器
  function clearAllTimers() { /* ... */ }

  // 内部函数：关闭 WebSocket
  function closeSockets() { /* ... */ }

  // 内部函数：计划重连（指数退避 + 抖动）
  function scheduleReconnect() {
    const delay = reconnectDelayRef.current
    const jittered = delay * (0.5 + Math.random() * 0.5)
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY)

    reconnectTimerRef.current = setTimeout(() => {
      // 重新连接...
    }, jittered)
  }

  // 暴露给外部的操作函数
  const connect = useCallback((sessionId, cols, rows, term) => {
    // ...连接逻辑
  }, [])

  const disconnect = useCallback(() => {
    // ...断开逻辑
  }, [])

  const sendInput = useCallback((data: string | Uint8Array) => {
    const ws = termWsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data)
    } else {
      offlineCacheRef.current?.queueInput(data)  // 离线缓存
    }
  }, [])

  return {
    connect,
    disconnect,
    reconnectCount,
    sendInput,
    sendResize,
    sendQuickAction,
    sendInjectCode,
    sendObserveSession,
  }
}
```

### 自定义 Hook 的设计原则

| 原则 | 说明 | 示例 |
|------|------|------|
| **命名以 use 开头** | 让 React 知道这是 Hook | `useAuth`、`useDualChannelWS` |
| **单一职责** | 一个 Hook 做一件事 | `useAuth` 只管认证 |
| **返回操作函数** | 而非暴露内部状态 | `return { login, logout }` |
| **参数做依赖注入** | 提高可测试性 | `useDualChannelWS(getToken, ...)` |

---

## 2.8 Hooks 规则与原理

### 两条铁律

```mermaid
graph TD
    subgraph "Hooks 的两条规则"
        R1["规则 1：只在顶层调用 Hooks"]
        R2["规则 2：只在 React 函数或自定义 Hook 中调用"]

        R1 --> R1A["❌ 不能在条件语句中"]
        R1 --> R1B["❌ 不能在循环中"]
        R1 --> R1C["❌ 不能在嵌套函数中"]
        R1 --> R1D["✅ 只在函数最顶层"]

        R2 --> R2A["❌ 不能在普通函数中"]
        R2 --> R2B["❌ 不能在 class 中"]
        R2 --> R2C["✅ React 函数组件中"]
        R2 --> R2D["✅ 自定义 Hook 中"]
    end
```

### 为什么有这些规则？

Hooks 内部使用**链表**来追踪状态。每次渲染时，Hooks 按调用顺序从链表中取出对应的状态：

```mermaid
graph LR
    subgraph "第一次渲染"
        A1["useState('Alice')"] -->|"位置 0"| B1["'Alice'"]
        A2["useState(25)"] -->|"位置 1"| B2["25"]
        A3["useEffect(fn)"] -->|"位置 2"| B3["fn"]
    end

    subgraph "第二次渲染"
        C1["useState → 位置 0"] --> D1["'Alice'"]
        C2["useState → 位置 1"] --> D2["26"]
        C3["useEffect → 位置 2"] --> D3["fn"]
    end
```

如果在条件语句中调用 Hooks，链表顺序会乱：

```typescript
// ❌ 错误示例
function MyComponent() {
  const [name, setName] = useState('Alice')

  if (isLoggedIn) {
    const [age, setAge] = useState(25)  // 第二次渲染时 isLoggedIn 变了
    // 这个 Hook 的位置会错位！
  }

  const [email, setEmail] = useState('')
}
```

---

## 2.9 闭包陷阱与解决方案

### 什么是闭包陷阱？

闭包陷阱是 Hooks 开发中最常见的 bug：函数"记住"了旧的变量值。

```typescript
function Counter() {
  const [count, setCount] = useState(0)

  function handleClick() {
    // ❌ 这里的 count 是闭包捕获的"快照"
    setTimeout(() => {
      alert(count)  // 总是显示 0（点击时的值）
    }, 3000)
  }

  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={handleClick}>显示当前值</button>
    </div>
  )
}
// 点击 +1 几次，再点"显示当前值"，3秒后弹出的不是最新值！
```

### 解决方案

```typescript
// 方案 1：函数式更新（适用于 setState）
setCount(prev => prev + 1)  // prev 始终是最新值

// 方案 2：useRef 存储最新值
const countRef = useRef(count)
countRef.current = count  // 每次渲染后更新
// 在回调中使用 countRef.current

// 方案 3：从 store 直接读取最新值（Zustand）
const latestToken = useSessionStore.getState().accessToken
```

### 项目中的闭包陷阱解决方案

```typescript
// apps/web/src/hooks/useAuth.ts

// 问题：scheduleTokenRenewal 的回调需要访问 doRefreshToken
// 但 scheduleTokenRenewal 用 useCallback 缓存了，里面的 doRefreshToken 会过期

// 解决：用 useRef 存储最新的函数引用
const doRefreshTokenRef = useRef<() => Promise<string>>()
doRefreshTokenRef.current = async () => {
  // 每次渲染都更新 ref 中的函数
  const currentRefresh = useSessionStore.getState().refreshToken
  // ...
}

const scheduleTokenRenewal = useCallback((token: string) => {
  // 定时器回调中通过 ref 访问最新函数
  refreshTimerRef.current = setTimeout(async () => {
    await doRefreshTokenRef.current?.()  // ✅ 始终是最新版本
  }, refreshIn)
}, [])  // 空依赖，但通过 ref 保证不闭包过期
```

```typescript
// apps/web/src/components/TerminalContainer.tsx

// 问题：connect 的 effect 需要 accessToken，但不想 token 变化就重连
// 解决：用 ref 追踪 accessToken
const accessTokenRef = useRef(accessToken)
useEffect(() => { accessTokenRef.current = accessToken }, [accessToken])

useEffect(() => {
  // 使用 ref 中的值，而不是闭包中的
  if (!termRef.current || !accessTokenRef.current || !sessionId) return
  // ...
}, [sessionId, isConnected, connectionPhase, connect])
// ✅ accessToken 不在依赖数组中，token 刷新不会触发重连
```

---

## 2.10 本章小结

| Hook | 用途 | 一句话总结 |
|------|------|----------|
| `useState` | 管理组件状态 | `const [value, setValue] = useState(init)` |
| `useEffect` | 处理副作用 | `useEffect(() => { ... return cleanup }, [deps])` |
| `useRef` | DOM 引用 / 可变值 | `const ref = useRef(null); ref.current = value` |
| `useCallback` | 缓存函数引用 | `const fn = useCallback(() => {}, [deps])` |
| `useMemo` | 缓存计算结果 | `const val = useMemo(() => compute(), [deps])` |
| `自定义 Hook` | 复用状态逻辑 | `function useXxx() { ... return { ... } }` |

```mermaid
graph TD
    subgraph "Hooks 选择指南"
        A["需要管理状态？"] -->|是| B["useState / useReducer"]
        A -->|否| C["需要访问 DOM？"]
        C -->|是| D["useRef"]
        C -->|否| E["需要副作用？"]
        E -->|是| F["useEffect"]
        E -->|否| G["需要缓存？"]
        G -->|函数| H["useCallback"]
        G -->|值| I["useMemo"]
        G -->|复用逻辑| J["自定义 Hook"]
    end
```

---

# 第三章：React 性能优化

## 3.1 为什么需要性能优化？

### React 的渲染机制

React 默认会在**父组件重渲染时，所有子组件也重渲染**。这在大多数情况下没问题，但当组件树很深或组件很重时，就会造成性能问题。

```mermaid
graph TD
    subgraph "默认行为：不必要的重渲染"
        A["App 重渲染"] --> B["StatusBar 重渲染"]
        A --> C["SessionTabs 重渲染"]
        A --> D["TerminalContainer 重渲染"]
        A --> E["FileExplorer 重渲染"]

        B -->|"props 没变，但还是重渲染了"| B1["浪费！"]
    end

    subgraph "优化后：只渲染需要的"
        F["App 重渲染"] --> G["StatusBar 跳过 ✅"]
        F --> H["SessionTabs 跳过 ✅"]
        F --> I["TerminalContainer 重渲染"]
        F --> J["FileExplorer 跳过 ✅"]
    end
```

### 性能问题的症状

| 症状 | 可能原因 | 检查方法 |
|------|---------|---------|
| 页面卡顿 | 组件重渲染过多 | React DevTools Profiler |
| 输入延迟 | 状态更新触发大量重渲染 | Chrome Performance 面板 |
| 内存泄漏 | useEffect 清理不完整 | Chrome Memory 面板 |
| 首屏加载慢 | 打包体积太大 | Lighthouse / Bundle Analyzer |

---

## 3.2 React.memo：避免不必要的重渲染

### 什么是 React.memo？

`React.memo` 是一个高阶组件，它会对组件的 props 进行浅比较，如果 props 没变，就跳过重渲染。

```typescript
// 普通组件：父组件渲染时，它也会渲染
function StatusBar({ title }: { title: string }) {
  return <div>{title}</div>
}

// 使用 memo 包裹：只有 props 变化时才渲染
export const StatusBar = memo(function StatusBar({
  title
}: {
  title: string
}) {
  return <div>{title}</div>
})
```

### 浅比较 vs 深比较

```mermaid
graph LR
    subgraph "浅比较（React.memo 默认）"
        A["prevProps.a === nextProps.a"] -->|基本类型| B["值相等 ✅"]
        C["prevProps.obj === nextProps.obj"] -->|对象/数组| D["引用相等？"]
        D -->|"同一引用"| E["✅ 相等"]
        D -->|"不同引用（即使内容一样）"| F["❌ 不相等"]
    end
```

```typescript
// ❌ 浅比较会失败：每次渲染都创建新对象
<MemoizedComp config={{ a: 1 }} />

// ✅ 浅比较成功：引用稳定
const config = useMemo(() => ({ a: 1 }), [])
<MemoizedComp config={config} />

// ❌ 浅比较会失败：每次渲染都创建新函数
<MemoizedComp onClick={() => doSomething()} />

// ✅ 浅比较成功：函数引用稳定
const handleClick = useCallback(() => doSomething(), [])
<MemoizedComp onClick={handleClick} />
```

### 项目中的 React.memo 使用

```typescript
// apps/web/src/components/LoginForm.tsx
// 使用 memo 包裹，避免父组件 App 渲染时 LoginForm 不必要的重渲染
export const LoginForm = memo(function LoginForm({
  onLogin
}: {
  onLogin: (username: string, password: string) => Promise<void>
}) {
  // ...
})

// apps/web/src/components/StatusBar.tsx
export const StatusBar = memo(function StatusBar({
  actionsSlot
}: {
  actionsSlot?: React.ReactNode
}) {
  // ...
})

// apps/web/src/components/SessionTabs.tsx
export const SessionTabs = memo(function SessionTabs() {
  // 无 props，只从 store 读取数据
  // memo 仍然有用：防止父组件渲染导致的不必要渲染
  const sessions = useSessionStore((s) => s.sessions)
  // ...
})
```

---

## 3.3 useMemo 与 useCallback 的正确使用

### 配合 React.memo 使用

```typescript
// ❌ 错误：memo 失效
function Parent() {
  const [count, setCount] = useState(0)

  // 每次 Parent 渲染都创建新对象和新函数
  const config = { fontSize: 14 }
  const handleClick = () => console.log('clicked')

  return <MemoizedChild config={config} onClick={handleClick} />
  // MemoizedChild 的 memo 完全失效！
}

// ✅ 正确：配合 useMemo + useCallback
function Parent() {
  const [count, setCount] = useState(0)

  const config = useMemo(() => ({ fontSize: 14 }), [])
  const handleClick = useCallback(() => console.log('clicked'), [])

  return <MemoizedChild config={config} onClick={handleClick} />
  // MemoizedChild 的 memo 生效！
}
```

### 项目实例：TerminalContainer 的优化

```typescript
// apps/web/src/components/TerminalContainer.tsx

// ✅ 用 useCallback 稳定函数引用
const { connect, disconnect, sendInput, sendResize } = useDualChannelWS(
  useCallback(() => useSessionStore.getState().accessToken, []),  // 稳定引用
  refreshTokenFn,
  logout,
)

// ✅ 用 useEffect 精确控制依赖
// fontSize 变化时才同步到终端
useEffect(() => {
  if (termRef.current) {
    termRef.current.options.fontSize = fontSize
    fitAddonRef.current?.fit()
  }
}, [fontSize])  // 只依赖 fontSize

// theme 变化时才同步主题
useEffect(() => {
  if (termRef.current) {
    termRef.current.options.theme = getXtermTheme(theme)
  }
}, [theme])  // 只依赖 theme
```

### 何时不要用 useMemo/useCallback

```typescript
// ❌ 过度优化：简单计算不需要 useMemo
const fullName = useMemo(() => firstName + ' ' + lastName, [firstName, lastName])
// 直接写就行：
const fullName = firstName + ' ' + lastName

// ❌ 过度优化：不传递给子组件的函数不需要 useCallback
const handleClick = useCallback(() => {
  setCount(c => c + 1)
}, [])
// 直接写就行：
function handleClick() { setCount(c => c + 1) }
```

---

## 3.4 虚拟列表：渲染海量数据

### 什么是虚拟列表？

虚拟列表只渲染**可见区域**的元素，不渲染屏幕外的元素。这在渲染成千上万条数据时非常有效。

```mermaid
graph TD
    subgraph "普通列表"
        A["渲染 10000 个 DOM 元素"] --> B["DOM 节点过多"]
        B --> C["内存占用大"]
        C --> D["滚动卡顿"]
    end

    subgraph "虚拟列表"
        E["只渲染可见的 20 个元素"] --> F["DOM 节点少"]
        F --> G["内存占用小"]
        G --> H["滚动流畅"]
    end
```

### 虚拟列表的原理

```mermaid
graph LR
    subgraph "虚拟列表原理"
        A["容器（固定高度）"] -->|"scroll 事件"| B["计算可见范围"]
        B -->|"startIndex, endIndex"| C["只渲染可见元素"]
        C -->|"paddingTop/Bottom"| D["模拟完整滚动条"]
    end
```

### 实现思路

```typescript
function VirtualList({ items, itemHeight, containerHeight }: Props) {
  const [scrollTop, setScrollTop] = useState(0)

  // 计算可见范围
  const startIndex = Math.floor(scrollTop / itemHeight)
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + containerHeight) / itemHeight)
  )

  // 只渲染可见元素
  const visibleItems = items.slice(startIndex, endIndex + 1)

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      {/* 上方占位 */}
      <div style={{ height: startIndex * itemHeight }} />

      {/* 可见元素 */}
      {visibleItems.map((item, i) => (
        <div key={startIndex + i} style={{ height: itemHeight }}>
          {item.name}
        </div>
      ))}

      {/* 下方占位 */}
      <div style={{ height: (items.length - endIndex - 1) * itemHeight }} />
    </div>
  )
}
```

### 常用虚拟列表库

| 库 | 特点 | 适用场景 |
|---|------|---------|
| `react-window` | 轻量、API 简洁 | 通用列表 |
| `react-virtualized` | 功能丰富、表格支持 | 复杂表格 |
| `@tanstack/react-virtual` | Headless、灵活 | 自定义样式 |
| `react-virtuoso` | 自动高度、分组 | 聊天消息列表 |

---

## 3.5 代码分割：React.lazy + Suspense

### 什么是代码分割？

默认情况下，React 应用会把所有代码打包成一个 JS 文件。代码分割将代码拆分成多个小块，按需加载。

```mermaid
graph LR
    subgraph "没有代码分割"
        A["index.js<br/>2MB（全部代码）"] --> B["首次加载：下载 2MB"]
    end

    subgraph "有代码分割"
        C["main.js<br/>200KB（核心代码）"] --> D["首次加载：下载 200KB"]
        E["editor.js<br/>500KB（编辑器代码）"] --> F["需要时才加载"]
    end
```

### React.lazy + Suspense

```typescript
import { lazy, Suspense } from 'react'

// 使用 lazy 动态导入组件
const CodeEditor = lazy(() =>
  import('./components/CodeEditor').then(m => ({ default: m.CodeEditor }))
)

function App() {
  return (
    <div>
      {/* 始终加载的核心组件 */}
      <StatusBar />
      <TerminalContainer />

      {/* 懒加载的组件 */}
      {editorFile && (
        <Suspense fallback={<div>Loading editor...</div>}>
          <CodeEditor
            filePath={editorFile.path}
            content={editorFile.content}
            language={editorFile.language}
            onClose={() => setEditorFile(null)}
          />
        </Suspense>
      )}
    </div>
  )
}
```

### 项目实例：CodeEditor 的懒加载

```typescript
// apps/web/src/App.tsx

// 1. 动态导入 CodeEditor
const CodeEditor = lazy(() =>
  import('./components/CodeEditor').then(m => ({ default: m.CodeEditor }))
)

export default function App() {
  const [editorFile, setEditorFile] = useState<{
    path: string
    content: string
    language: string
  } | null>(null)

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-bg">
      <StatusBar />
      <SessionTabs />
      <div className="flex-1 relative overflow-hidden">
        <TerminalContainer />
      </div>

      {/* CodeEditor 只在用户打开文件时才加载 */}
      {editorFile && (
        <Suspense fallback={
          <div className="fixed inset-0 z-30 bg-[#1a1b26] flex items-center justify-center text-gray-400 text-sm">
            Loading editor...
          </div>
        }>
          <CodeEditor
            filePath={editorFile.path}
            content={editorFile.content}
            language={editorFile.language}
            onClose={() => setEditorFile(null)}
            onInjectCode={(code: string) =>
              useSessionStore.getState().sendInjectCode?.(code)
            }
          />
        </Suspense>
      )}
    </div>
  )
}
```

### 代码分割的时机

| 场景 | 推荐方案 | 原因 |
|------|---------|------|
| 路由级别 | `lazy(() => import('./Page'))` | 每个页面独立加载 |
| 大型组件 | `lazy(() => import('./Editor'))` | 不常用的大组件 |
| 模态框/抽屉 | `lazy(() => import('./Modal'))` | 打开时才加载 |
| 小组件 | 不需要 | 加载开销大于收益 |

---

## 3.6 项目中的性能优化实例

### 优化 1：Zustand 选择器（避免不必要的重渲染）

```typescript
// ❌ 不好的写法：订阅整个 store
function SessionTabs() {
  const state = useSessionStore()  // 任何 state 变化都会重渲染！
  return <div>{state.sessions.length}</div>
}

// ✅ 好的写法：只订阅需要的字段
function SessionTabs() {
  const sessions = useSessionStore((s) => s.sessions)
  const activeSessionIndex = useSessionStore((s) => s.activeSessionIndex)
  const addSession = useSessionStore((s) => s.addSession)
  const removeSession = useSessionStore((s) => s.removeSession)
  const switchSession = useSessionStore((s) => s.switchSession)
  // 只有 sessions/activeSessionIndex 变化时才重渲染
  return <div>...</div>
}
```

### 优化 2：Terminal 实例缓存（ADR-011）

```typescript
// apps/web/src/components/TerminalContainer.tsx

// 模块级别的缓存：Terminal 实例不会因为组件重渲染而重建
const terminalCache = new Map<string, Terminal>()
const fitAddonCache = new Map<string, FitAddon>()

// useEffect 中使用缓存
useEffect(() => {
  const cacheKey = sessionId || '__default'

  // 清理其他 session 的终端
  for (const [key, cachedTerm] of terminalCache.entries()) {
    if (key !== cacheKey) {
      cachedTerm.dispose()
      terminalCache.delete(key)
    }
  }

  // 检查缓存
  const cached = terminalCache.get(cacheKey)
  if (cached) {
    // 复用缓存的终端实例
    term = cached
    container.appendChild(term.element!)
    fitAddon.fit()
  } else {
    // 创建新实例并缓存
    term = new Terminal({ /* ... */ })
    terminalCache.set(cacheKey, term)
  }
}, [])
```

### 优化 3：visibilitychange 优化（页面隐藏时移除 DOM）

```typescript
// apps/web/src/components/TerminalContainer.tsx

useEffect(() => {
  function handleVisibilityChange() {
    const term = termRef.current
    if (!term || !term.element) return

    if (document.hidden) {
      // 页面隐藏：从 DOM 移除（减少 GPU 开销）
      if (term.element.parentNode) {
        term.element.parentNode.removeChild(term.element)
      }
    } else {
      // 页面显示：重新挂载
      if (containerRef.current && !term.element.parentNode) {
        containerRef.current.appendChild(term.element)
        fitAddonRef.current?.fit()
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])
```

### 优化 4：Resize 防抖与节流

```typescript
// apps/web/src/hooks/useDualChannelWS.ts

const RESIZE_DEBOUNCE = 200   // 防抖延迟
const RESIZE_THROTTLE = 1000  // 节流间隔

const sendResize = useCallback((cols: number, rows: number) => {
  // 防抖：等待用户停止调整
  if (resizeDebounceRef.current) {
    clearTimeout(resizeDebounceRef.current)
  }

  resizeDebounceRef.current = setTimeout(() => {
    // 节流：最小间隔 1 秒
    const now = Date.now()
    if (now - lastResizeSentRef.current < RESIZE_THROTTLE) return
    lastResizeSentRef.current = now

    // 发送 resize 消息
    const ws = ctrlWsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg: ControlClientMessage = {
        type: 'RESIZE', sessionId, cols, rows
      }
      ws.send(JSON.stringify(msg))
    }
  }, RESIZE_DEBOUNCE)
}, [])
```

### 优化 5：AbortController 防止竞态条件

```typescript
// apps/web/src/components/FileExplorer.tsx

// 使用 AbortController 取消过期的请求
const abortRef = useRef<AbortController | null>(null)

const fetchTree = useCallback(async (dirPath: string) => {
  // 取消上一个未完成的请求
  if (abortRef.current) {
    abortRef.current.abort()
  }
  const controller = new AbortController()
  abortRef.current = controller

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,  // 传入 signal
    })
    // ...
  } catch (err) {
    // 忽略被 abort 的请求
    if (controller.signal.aborted) return
    // 处理其他错误
  }
}, [])
```

---

## 3.7 性能分析工具

### React DevTools Profiler

```mermaid
graph LR
    subgraph "Profiler 使用流程"
        A["打开 React DevTools"] --> B["切换到 Profiler 标签"]
        B --> C["点击 Record"]
        C --> D["执行操作"]
        D --> E["点击 Stop"]
        E --> F["分析渲染火焰图"]
        F --> G["找出不必要的重渲染"]
    end
```

### Chrome Performance 面板

| 工具 | 用途 | 使用方法 |
|------|------|---------|
| **React DevTools** | 组件渲染分析 | 查看哪些组件重渲染了 |
| **Chrome Performance** | 运行时性能 | 录制操作，分析 JS 执行 |
| **Lighthouse** | 整体性能评分 | 运行审计，获取优化建议 |
| **Bundle Analyzer** | 打包体积分析 | `npx vite-bundle-visualizer` |
| **why-did-you-render** | 重渲染原因 | 安装库，追踪不必要的渲染 |

---

## 3.8 本章小结

```mermaid
graph TD
    subgraph "性能优化策略"
        A["React.memo"] -->|"避免不必要渲染"| B["组件级优化"]
        C["useMemo/useCallback"] -->|"稳定引用"| D["配合 memo 使用"]
        E["虚拟列表"] -->|"只渲染可见部分"| F["大数据优化"]
        G["React.lazy"] -->|"按需加载"| H["首屏优化"]
        I["选择器订阅"] -->|"精确订阅"| J["Store 级优化"]
    end
```

| 优化手段 | 适用场景 | 项目示例 |
|---------|---------|---------|
| `React.memo` | 纯展示组件 | `LoginForm`、`StatusBar` |
| `useCallback` | 传递给子组件的回调 | `sendInput`、`connect` |
| `useMemo` | 昂贵的计算或对象创建 | 依赖注入函数 |
| `lazy + Suspense` | 不常用的大组件 | `CodeEditor` |
| 选择器订阅 | 全局 store 读取 | `useSessionStore(s => s.sessions)` |
| 实例缓存 | 重量级对象 | `terminalCache` |
| 防抖/节流 | 高频事件 | `sendResize` |
| AbortController | 竞态请求 | `FileExplorer` |

---

# 第四章：React 状态管理

## 4.1 状态管理的挑战

### 状态的分类

```mermaid
graph TD
    subgraph "React 应用中的状态"
        A["应用状态"] --> B["服务端状态<br/>来自 API 的数据"]
        A --> C["客户端状态<br/>UI 状态、表单数据"]
        A --> D["URL 状态<br/>路由参数、查询字符串"]
        A --> E["全局状态<br/>跨组件共享的数据"]
        A --> F["局部状态<br/>单个组件内部"]
    end
```

### 状态提升的问题

当多个组件需要共享状态时，React 的默认方案是"状态提升"——把 state 放到最近的公共父组件中：

```mermaid
graph TD
    subgraph "状态提升（Prop Drilling）"
        A["公共父组件<br/>持有 state"] -->|"props"| B["中间组件 1"]
        B -->|"props"| C["中间组件 2"]
        C -->|"props"| D["目标组件<br/>使用 state"]
        D -->|"setState"| C
        C -->|"setState"| B
        B -->|"setState"| A
    end

    subgraph "问题"
        E["中间组件不需要这个 state<br/>但被迫传递"] --> F["Prop Drilling 地狱"]
        F --> G["代码耦合、难以维护"]
    end
```

---

## 4.2 组件内部状态 vs 全局状态

| 特性 | 组件内部状态 | 全局状态 |
|------|------------|---------|
| **存储位置** | `useState` / `useReducer` | 外部 store |
| **共享范围** | 单个组件 | 整个应用 |
| **典型数据** | 表单输入、开关、展开/收起 | 用户认证、主题、会话 |
| **性能影响** | 只影响当前组件 | 可能影响所有订阅者 |
| **调试难度** | 简单 | 需要 devtools |

### 什么应该放在全局状态？

```typescript
// ✅ 适合全局状态
- 用户认证信息（accessToken, refreshToken）
- WebSocket 连接状态（isConnected, connectionPhase）
- 当前会话（sessionId, agentStatus）
- 应用设置（fontSize, theme, activeAdapter）
- 多会话列表（sessions）

// ❌ 不适合全局状态
- 表单输入值（username, password）
- 动画状态（isAnimating）
- 组件展开/收起（isExpanded）
- 临时 UI 状态（hoverIndex）
```

---

## 4.3 Context API：React 内置方案

### 基本用法

```typescript
import { createContext, useContext, useState } from 'react'

// 1. 创建 Context
const ThemeContext = createContext<{
  theme: 'light' | 'dark'
  toggleTheme: () => void
}>({
  theme: 'dark',
  toggleTheme: () => {},
})

// 2. 创建 Provider
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// 3. 在子组件中使用
function ThemedButton() {
  const { theme, toggleTheme } = useContext(ThemeContext)
  return <button onClick={toggleTheme}>当前：{theme}</button>
}
```

### Context 的问题

```mermaid
graph TD
    subgraph "Context 的性能问题"
        A["Provider 的 value 变化"] --> B["所有 Consumer 都重渲染"]
        B --> C["即使 Consumer 只用了部分值"]
        C --> D["不必要的重渲染 ❌"]
    end

    subgraph "解决方案"
        E["拆分 Context"] --> F["每个 Context 只存一个值"]
        G["使用 Zustand"] --> H["选择器订阅，精确更新"]
    end
```

---

## 4.4 外部状态管理库对比

| 特性 | Context API | Redux | Zustand | Jotai | Valtio |
|------|------------|-------|---------|-------|--------|
| **复杂度** | 低 | 高 | 低 | 低 | 低 |
| **样板代码** | 少 | 多 | 极少 | 极少 | 极少 |
| **性能** | 差（全量更新） | 好（选择器） | 好（选择器） | 好（原子） | 好（代理） |
| **学习曲线** | 低 | 陡峭 | 平缓 | 平缓 | 平缓 |
| **TypeScript** | 一般 | 好 | 极好 | 极好 | 好 |
| **中间件** | 无 | 丰富 | 支持 | 支持 | 支持 |
| **DevTools** | React DevTools | Redux DevTools | 自带 | 自带 | 自带 |
| **适用规模** | 小型 | 大型 | 中小型 | 中小型 | 中小型 |
| **Bundle 大小** | 0KB | ~11KB | ~1KB | ~2KB | ~2KB |

---

## 4.5 Zustand 深度讲解

### 什么是 Zustand？

Zustand（德语"状态"）是一个轻量级的状态管理库，API 极简，性能优秀。

### 创建 Store

```typescript
import { create } from 'zustand'

// 定义状态接口
interface CounterState {
  count: number
  increment: () => void
  decrement: () => void
  reset: () => void
}

// 创建 store
const useCounterStore = create<CounterState>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0 }),
}))
```

### 在组件中使用

```typescript
function Counter() {
  // 方式 1：选择器（推荐，精确订阅）
  const count = useCounterStore((state) => state.count)
  const increment = useCounterStore((state) => state.increment)

  // 方式 2：解构（订阅整个 store，任何变化都重渲染）
  const { count, increment, decrement } = useCounterStore()

  return (
    <div>
      <span>{count}</span>
      <button onClick={increment}>+1</button>
      <button onClick={decrement}>-1</button>
    </div>
  )
}
```

### Zustand 的中间件

```typescript
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'

const useStore = create(
  devtools(
    persist(
      (set) => ({
        theme: 'dark',
        setTheme: (theme: string) => set({ theme }),
      }),
      { name: 'app-settings' }  // localStorage key
    )
  )
)
```

| 中间件 | 用途 | 示例 |
|--------|------|------|
| `persist` | 持久化到 localStorage | 用户设置、主题 |
| `devtools` | Redux DevTools 支持 | 调试状态变化 |
| `immer` | 使用 Immer 简化更新 | 嵌套对象更新 |
| `subscribeWithSelector` | 精确订阅 | 性能优化 |

### Zustand vs Context API

```mermaid
graph TD
    subgraph "Context API"
        A["Provider value 变化"] --> B["所有 Consumer 重渲染"]
        B --> C["需要拆分多个 Context"]
        C --> D["代码复杂"]
    end

    subgraph "Zustand"
        E["store 变化"] --> F["只通知订阅的组件"]
        F --> G["选择器精确订阅"]
        G --> H["代码简洁"]
    end
```

---

## 4.6 项目中的状态管理设计

### sessionStore 设计

AI-CLI-Mobile 使用 Zustand 管理全局状态，核心是 `sessionStore`：

```mermaid
graph TD
    subgraph "sessionStore 状态结构"
        A["connectionState"]
        A --> A1["isConnected: boolean"]
        A --> A2["connectionPhase: 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'"]

        B["sessionState"]
        B --> B1["sessionId: string | null"]
        B --> B2["agentStatus: AgentStatus"]
        B --> B3["sessions: SessionEntry[]"]
        B --> B4["activeSessionIndex: number"]

        C["authState"]
        C --> C1["accessToken: string | null"]
        C --> C2["refreshToken: string | null"]

        D["settings"]
        D --> D1["fontSize: number"]
        D --> D2["theme: 'dark' | 'light'"]
        D --> D3["activeAdapter: string"]

        E["refs"]
        E --> E1["sendInjectCode: Function | null"]
    end
```

### 完整的 sessionStore 代码

```typescript
// apps/web/src/store/sessionStore.ts
import { create } from 'zustand'
import { AgentStatus } from '@ai-cli/shared'

interface SessionEntry {
  id: string
  status: AgentStatus
  label: string
}

interface SessionState {
  // 连接状态
  isConnected: boolean
  connectionPhase: 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'

  // 当前会话
  sessionId: string | null
  agentStatus: AgentStatus

  // 多会话
  sessions: SessionEntry[]
  activeSessionIndex: number

  // 认证
  accessToken: string | null
  refreshToken: string | null

  // 终端设置
  fontSize: number
  theme: 'dark' | 'light'
  activeAdapter: string

  // WS 函数引用
  sendInjectCode: ((code: string) => void) | null

  // 操作函数
  setConnected: (phase: SessionState['connectionPhase']) => void
  setDisconnected: () => void
  setSession: (sessionId: string) => void
  setAgentStatus: (status: AgentStatus) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  setFontSize: (size: number) => void
  setTheme: (theme: 'dark' | 'light') => void
  setActiveAdapter: (adapter: string) => void
  addSession: () => void
  removeSession: (index: number) => void
  switchSession: (index: number) => void
  updateSessionStatus: (sessionId: string, status: AgentStatus) => void
  reset: () => void
}

const initialState = {
  isConnected: false,
  connectionPhase: 'DISCONNECTED' as const,
  sessionId: null as string | null,
  agentStatus: 'IDLE' as AgentStatus,
  sessions: [] as SessionEntry[],
  activeSessionIndex: 0,
  accessToken: null as string | null,
  refreshToken: null as string | null,
  fontSize: 14,
  theme: 'dark' as const,
  activeAdapter: 'claude',
  sendInjectCode: null as ((code: string) => void) | null,
}

export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialState,

  // 设置连接状态
  setConnected: (phase) =>
    set({
      isConnected: phase === 'CONNECTED',
      connectionPhase: phase,
    }),

  // 断开连接
  setDisconnected: () =>
    set({
      isConnected: false,
      connectionPhase: 'DISCONNECTED',
    }),

  // 设置会话
  setSession: (sessionId) => {
    const { sessions } = get()
    const existing = sessions.find((s) => s.id === sessionId)
    if (!existing) {
      set({
        sessionId,
        sessions: [...sessions, {
          id: sessionId,
          status: 'IDLE',
          label: sessionId.slice(0, 8)
        }],
        activeSessionIndex: sessions.length,
      })
    } else {
      set({ sessionId })
    }
  },

  // 设置 Agent 状态
  setAgentStatus: (status) => {
    const { sessionId, sessions } = get()
    set({
      agentStatus: status,
      sessions: sessions.map((s) =>
        s.id === sessionId ? { ...s, status } : s
      ),
    })
  },

  // 设置 Token
  setTokens: (accessToken, refreshToken) =>
    set({ accessToken, refreshToken }),

  // 设置字体大小
  setFontSize: (size) => set({ fontSize: size }),

  // 设置主题
  setTheme: (theme) => set({ theme }),

  // 设置适配器（白名单校验）
  setActiveAdapter: (adapter) => {
    const VALID_ADAPTERS = new Set(['claude', 'aider', 'shell'])
    const safe = VALID_ADAPTERS.has(adapter) ? adapter : 'claude'
    set({ activeAdapter: safe })
  },

  // 添加会话（限制最大数量）
  addSession: () => {
    const MAX_SESSIONS = 10
    const { sessions } = get()
    if (sessions.length >= MAX_SESSIONS) return
    const newId = crypto.randomUUID()
    set({
      sessions: [...sessions, {
        id: newId,
        status: 'IDLE',
        label: newId.slice(0, 8)
      }],
    })
  },

  // 移除会话
  removeSession: (index) => {
    const { sessions, activeSessionIndex } = get()
    if (sessions.length <= 1) return
    const newSessions = sessions.filter((_, i) => i !== index)
    let newActiveIndex = activeSessionIndex
    if (index < activeSessionIndex) {
      newActiveIndex = activeSessionIndex - 1
    } else if (index === activeSessionIndex) {
      newActiveIndex = Math.min(activeSessionIndex, newSessions.length - 1)
    }
    set({
      sessions: newSessions,
      activeSessionIndex: newActiveIndex,
      sessionId: newSessions[newActiveIndex]?.id ?? null,
    })
  },

  // 切换会话
  switchSession: (index) => {
    const { sessions } = get()
    if (index >= 0 && index < sessions.length) {
      set({
        activeSessionIndex: index,
        sessionId: sessions[index].id,
        agentStatus: sessions[index].status,
      })
    }
  },

  // 更新会话状态
  updateSessionStatus: (sessionId, status) => {
    const { sessions } = get()
    set({
      sessions: sessions.map((s) =>
        s.id === sessionId ? { ...s, status } : s
      ),
    })
  },

  // 重置所有状态
  reset: () => set({ ...initialState }),
}))
```

### 状态流向图

```mermaid
graph TD
    subgraph "数据流向"
        A["useDualChannelWS<br/>WebSocket 事件"] -->|"STATUS_UPDATE"| B["sessionStore<br/>setAgentStatus"]
        A -->|"AUTH_OK"| C["sessionStore<br/>setConnected"]
        A -->|"TOKEN_RENEWED"| D["sessionStore<br/>setTokens"]

        E["useAuth<br/>登录/登出"] -->|"login()"| D
        E -->|"logout()"| F["sessionStore<br/>reset"]

        G["TerminalContainer<br/>用户操作"] -->|"setFontSize()"| H["sessionStore<br/>fontSize"]
        G -->|"setTheme()"| I["sessionStore<br/>theme"]
    end

    subgraph "UI 订阅"
        B --> J["StatusBar<br/>显示 agent 状态"]
        C --> K["ConnectionOverlay<br/>显示连接状态"]
        H --> L["TerminalContainer<br/>终端字体大小"]
        I --> M["TerminalContainer<br/>终端主题"]
    end
```

---

## 4.7 状态管理最佳实践

### 1. 使用选择器精确订阅

```typescript
// ❌ 订阅整个 store
const store = useSessionStore()

// ✅ 只订阅需要的字段
const fontSize = useSessionStore((s) => s.fontSize)
const theme = useSessionStore((s) => s.theme)
```

### 2. 在组件外访问 store

```typescript
// 在事件处理函数、定时器等非 React 上下文中
const { accessToken } = useSessionStore.getState()

// 在 WebSocket 回调中
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  useSessionStore.getState().setAgentStatus(msg.status)
}
```

### 3. 安全性：输入校验

```typescript
// apps/web/src/store/sessionStore.ts
setActiveAdapter: (adapter) => {
  // 白名单校验，防止注入恶意值
  const VALID_ADAPTERS = new Set(['claude', 'aider', 'shell'])
  const safe = VALID_ADAPTERS.has(adapter) ? adapter : 'claude'
  set({ activeAdapter: safe })
}
```

### 4. 资源限制

```typescript
// 限制最大会话数量，防止资源耗尽
addSession: () => {
  const MAX_SESSIONS = 10
  const { sessions } = get()
  if (sessions.length >= MAX_SESSIONS) return
  // ...
}
```

---

## 4.8 本章小结

```mermaid
graph TD
    subgraph "状态管理选择指南"
        A["状态只在一个组件用？"] -->|是| B["useState"]
        A -->|否| C["需要异步操作？"]
        C -->|是| D["Zustand / Redux"]
        C -->|否| E["组件数量少？"]
        E -->|是| F["Context API"]
        E -->|否| G["Zustand"]
    end
```

| 方案 | 适用场景 | 项目使用 |
|------|---------|---------|
| `useState` | 组件局部状态 | `LoginForm` 的表单数据 |
| `Zustand` | 全局共享状态 | `sessionStore`（核心状态） |
| `Context` | 主题、国际化 | 本项目未使用（被 Zustand 替代） |

---

# 第五章：React 与 TypeScript

## 5.1 为什么要在 React 中使用 TypeScript？

### TypeScript 的价值

```mermaid
graph LR
    subgraph "没有 TypeScript"
        A["props 写错了"] --> B["运行时才发现"]
        B --> C["用户看到错误 💥"]
    end

    subgraph "有 TypeScript"
        D["props 写错了"] --> E["编辑器立刻报错"]
        E --> F["编译时就修复 ✅"]
    end
```

| 特性 | JavaScript | TypeScript |
|------|-----------|-----------|
| **类型检查** | 运行时 | 编译时 |
| **IDE 支持** | 基本补全 | 智能补全、重构 |
| **Props 校验** | PropTypes（运行时） | 类型定义（编译时） |
| **重构安全性** | 低 | 高 |
| **文档作用** | 无 | 类型即文档 |

---

## 5.2 组件类型定义

### Props 类型定义

```typescript
// 方式 1：interface（推荐，可扩展）
interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>
}

export function LoginForm({ onLogin }: LoginFormProps) {
  // ...
}

// 方式 2：type（不可扩展，但更灵活）
type LoginFormProps = {
  onLogin: (username: string, password: string) => Promise<void>
}

// 方式 3：内联定义（简单场景）
export function LoginForm({
  onLogin
}: {
  onLogin: (username: string, password: string) => Promise<void>
}) {
  // ...
}
```

### 项目中的类型定义

```typescript
// apps/web/src/components/LoginForm.tsx
interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>
}

export const LoginForm = memo(function LoginForm({
  onLogin
}: LoginFormProps) {
  // TypeScript 知道 onLogin 的完整类型
  // 编辑器会提供自动补全和类型检查
})

// apps/web/src/components/FileExplorer.tsx
interface FileExplorerProps {
  onFileSelect: (path: string, content: string, language: string) => void
}

interface FileEntry {
  name: string
  path: string
  type: 'directory' | 'file'
  size?: number
  modified: string
}

interface FileExplorerState {
  currentPath: string
  entries: FileEntry[]
  loading: boolean
  error: string | null
}
```

### children 的类型

```typescript
// React.ReactNode：最宽泛的 children 类型
interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

// React.ReactElement：只接受 JSX 元素
interface WrapperProps {
  children: React.ReactElement
}

// 无 children
interface StatusBarProps {
  title: string  // 没有 children
}
```

---

## 5.3 Hooks 类型标注

### useState 类型

```typescript
// 基础类型：自动推断
const [count, setCount] = useState(0)  // 类型是 number
const [name, setName] = useState('')   // 类型是 string

// 复杂类型：需要显式标注
const [user, setUser] = useState<User | null>(null)

// 联合类型
const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

// 对象类型
const [editorFile, setEditorFile] = useState<{
  path: string
  content: string
  language: string
} | null>(null)
```

### useRef 类型

```typescript
// DOM 元素引用
const containerRef = useRef<HTMLDivElement>(null)
const inputRef = useRef<HTMLInputElement>(null)

// 通用引用
const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const wsRef = useRef<WebSocket | null>(null)
const termRef = useRef<Terminal | null>(null)

// 可变值引用
const isConnectingRef = useRef(false)
const countRef = useRef(0)
```

### useEffect 类型

```typescript
// useEffect 的清理函数类型
useEffect(() => {
  const timer = setInterval(() => {}, 1000)

  // 返回清理函数，类型是 () => void
  return () => clearInterval(timer)
}, [])

// AbortController
useEffect(() => {
  const controller = new AbortController()

  fetch(url, { signal: controller.signal })

  return () => controller.abort()
}, [url])
```

---

## 5.4 泛型组件

### 什么是泛型组件？

泛型组件是可以接受不同类型参数的组件，就像一个"模板"：

```typescript
// 泛型列表组件
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => React.ReactNode
  keyExtractor: (item: T) => string
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  )
}

// 使用时，TypeScript 自动推断 T 的类型
<List
  items={sessions}
  renderItem={(session) => <span>{session.label}</span>}
  keyExtractor={(session) => session.id}
/>
```

### 泛型 Hook

```typescript
// 泛型 Hook：类型安全的 localStorage 读写
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  const setStoredValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(prev)
        : newValue
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }, [key])

  return [value, setStoredValue] as const
}

// 使用
const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('theme', 'dark')
const [fontSize, setFontSize] = useLocalStorage<number>('fontSize', 14)
```

---

## 5.5 类型推断与类型守卫

### 类型推断

TypeScript 能自动推断很多类型，不需要到处写类型注解：

```typescript
// 自动推断返回类型
function add(a: number, b: number) {
  return a + b  // 返回类型自动推断为 number
}

// 自动推断 useState 类型
const [count, setCount] = useState(0)  // count: number

// 自动推断 map 返回类型
const labels = sessions.map(s => s.label)  // string[]

// as const 推断字面量类型
const STATUS_COLORS = {
  IDLE: 'bg-gray-400',
  RUNNING: 'bg-green-400',
} as const
// 类型是 { readonly IDLE: "bg-gray-400"; readonly RUNNING: "bg-green-400" }
```

### 类型守卫

```typescript
// 自定义类型守卫函数
function isValidControlMsg(data: unknown): data is { type: string; [key: string]: unknown } {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (typeof obj.type !== 'string') return false
  if (!CONTROL_MSG_TYPES.has(obj.type)) return false
  return true
}

// 使用类型守卫
ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data)
    if (!isValidControlMsg(msg)) {
      console.warn('无效消息类型，已丢弃')
      return
    }
    // 此处 TypeScript 知道 msg 的类型是 { type: string; ... }
    switch (msg.type) {
      case 'STATUS_UPDATE':
        // ...
    }
  } catch {}
}
```

### typeof 和 instanceof 守卫

```typescript
function handleError(err: unknown) {
  if (err instanceof Error) {
    // TypeScript 知道这里是 Error 类型
    console.error(err.message)
  } else if (typeof err === 'string') {
    // TypeScript 知道这里是 string 类型
    console.error(err)
  }
}
```

---

## 5.6 常见类型模式

### 联合类型与字面量类型

```typescript
// 字面量联合类型
type AgentStatus = 'IDLE' | 'RUNNING' | 'WAITING_APPROVAL' | 'ERROR'
type ConnectionPhase = 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'
type Theme = 'dark' | 'light'

// 带数据的联合类型（Discriminated Union）
type WebSocketEvent =
  | { type: 'STATUS_UPDATE'; status: AgentStatus; sessionId: string }
  | { type: 'TOKEN_RENEWED'; accessToken: string }
  | { type: 'ERROR'; message: string }
  | { type: 'PONG' }

// 使用时自动收窄类型
function handleEvent(event: WebSocketEvent) {
  switch (event.type) {
    case 'STATUS_UPDATE':
      // TypeScript 知道这里有 status 和 sessionId
      console.log(event.status, event.sessionId)
      break
    case 'TOKEN_RENEWED':
      // TypeScript 知道这里有 accessToken
      console.log(event.accessToken)
      break
  }
}
```

### Record 和映射类型

```typescript
// Record：键值对映射
const agentStatusConfig: Record<AgentStatus, {
  label: string
  className: string
  icon?: 'spin' | 'blink'
}> = {
  IDLE: { label: 'IDLE', className: 'bg-gray-600 text-gray-300' },
  RUNNING: { label: 'RUNNING', className: 'bg-blue-600 text-blue-100', icon: 'spin' },
  WAITING_APPROVAL: { label: 'APPROVAL', className: 'bg-orange-500', icon: 'blink' },
  ERROR: { label: 'ERROR', className: 'bg-red-600 text-red-100' },
}
```

### Partial 和 Required

```typescript
// Partial：所有属性变为可选
interface Config {
  fontSize: number
  theme: 'dark' | 'light'
  showLineNumbers: boolean
}

function updateConfig(partial: Partial<Config>) {
  // partial.fontSize 可能是 undefined
}

updateConfig({ fontSize: 16 })  // ✅ 只传部分属性

// Required：所有属性变为必填
interface OptionalProps {
  name?: string
  age?: number
}

function renderUser(props: Required<OptionalProps>) {
  // 所有属性都保证有值
}
```

---

## 5.7 项目中的 TypeScript React 代码分析

### 完整组件类型分析

```typescript
// apps/web/src/hooks/useDualChannelWS.ts

// 1. 接口定义
interface UseDualChannelWS {
  connect: (sessionId: string, cols: number, rows: number, term: Terminal) => void
  disconnect: () => void
  termWs: WebSocket | null
  ctrlWs: WebSocket | null
  reconnectCount: number
  sendInput: (data: string | Uint8Array) => void
  sendResize: (cols: number, rows: number) => void
  sendQuickAction: (payload: string) => void
  sendInjectCode: (code: string) => void
  sendObserveSession: (sessionId: string) => void
}

// 2. Hook 函数签名
export function useDualChannelWS(
  getAccessToken: () => string | null,      // 函数类型参数
  getRefreshToken: () => Promise<string>,    // 返回 Promise 的函数
  onAuthFailure: () => void,                 // 回调函数
): UseDualChannelWS {                        // 返回类型
  // ...
}
```

### Store 类型分析

```typescript
// apps/web/src/store/sessionStore.ts

// 1. 复合类型
interface SessionEntry {
  id: string
  status: AgentStatus  // 从 shared 包导入的类型
  label: string
}

// 2. 状态接口
interface SessionState {
  // 基础类型
  isConnected: boolean

  // 字面量联合类型
  connectionPhase: 'DISCONNECTED' | 'CONNECTING_TERM' | 'CONNECTING_CTRL' | 'CONNECTED'

  // 可空类型
  sessionId: string | null
  accessToken: string | null
  refreshToken: string | null

  // 数组类型
  sessions: SessionEntry[]

  // 函数类型
  sendInjectCode: ((code: string) => void) | null

  // 操作函数
  setConnected: (phase: SessionState['connectionPhase']) => void
  // ...
}
```

### 事件处理类型

```typescript
// React 事件类型
function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
}

function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  setValue(e.target.value)
}

function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === 'Enter') {
    submit()
  }
}

// DOM 事件类型
useEffect(() => {
  function handleResize() { /* ... */ }
  function handleVisibilityChange() { /* ... */ }

  window.addEventListener('resize', handleResize)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    window.removeEventListener('resize', handleResize)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}, [])
```

---

## 5.8 本章小结

| TypeScript 特性 | React 中的用途 | 项目示例 |
|-----------------|---------------|---------|
| **接口定义** | Props、State 类型 | `SessionState`、`FileExplorerProps` |
| **联合类型** | 状态枚举 | `AgentStatus`、`ConnectionPhase` |
| **泛型** | 泛型组件、Hook | `create<SessionState>()` |
| **类型守卫** | 运行时类型检查 | `isValidControlMsg()` |
| **字面量类型** | 严格值约束 | `theme: 'dark' \| 'light'` |
| **Record** | 映射表类型 | `agentStatusConfig` |
| **可空类型** | 可选值 | `sessionId: string \| null` |

```mermaid
graph TD
    subgraph "TypeScript + React 工作流"
        A["定义类型接口"] --> B["组件 Props 类型"]
        B --> C["编辑器自动补全"]
        C --> D["编译时类型检查"]
        D --> E["运行时安全保障"]
    end
```

---

# 第六章：CSS 方案与样式管理

## 6.1 React 中的样式方案概览

### 样式方案对比

| 方案 | 原理 | 优点 | 缺点 | 项目使用 |
|------|------|------|------|---------|
| **内联样式** | `style={{}}` | 简单直接 | 无伪类、无媒体查询 | 少量使用 |
| **CSS 文件** | `import './style.css'` | 标准 CSS | 全局作用域、可能冲突 | `index.css` |
| **CSS Modules** | `styles.className` | 局部作用域 | 需要配置 | 未使用 |
| **CSS-in-JS** | styled-components | 动态样式、主题 | 运行时开销 | 未使用 |
| **Tailwind CSS** | 原子类名 | 快速开发、一致性强 | 类名长 | **主要方案** |

---

## 6.2 Tailwind CSS 原理与使用

### 什么是 Tailwind CSS？

Tailwind CSS 是一个**原子化 CSS 框架**，它提供大量预定义的工具类（utility classes），让你直接在 HTML/JSX 中组合使用。

```mermaid
graph LR
    subgraph "传统 CSS"
        A["写 HTML"] --> B["写 CSS 文件"]
        B --> C["定义 .btn-primary"]
        C --> D["维护 CSS"]
    end

    subgraph "Tailwind CSS"
        E["写 HTML/JSX"] --> F["直接用工具类"]
        F --> G["className='bg-blue-600 text-white px-4 py-2'"]
        G --> H["无需维护 CSS"]
    end
```

### 常用 Tailwind 类

```typescript
// 布局
<div className="flex items-center justify-between">
<div className="grid grid-cols-3 gap-4">
<div className="flex-1 overflow-hidden">

// 间距
<div className="px-3 py-2 m-4 gap-2">
// px = padding-left + padding-right
// py = padding-top + padding-bottom
// m = margin
// gap = flex/grid 子元素间距

// 颜色
<span className="text-gray-300 bg-dark-surface">
<span className="text-red-400 bg-red-500/10">
// /10 表示 10% 透明度

// 尺寸
<div className="w-full h-screen w-72 h-[40px]">
// [] 中可以写任意值

// 圆角
<div className="rounded rounded-lg rounded-full">

// 边框
<div className="border border-dark-border">

// 响应式
<div className="hidden md:block lg:flex">
// md: = 768px 以上
// lg: = 1024px 以上

// 状态
<button className="hover:bg-blue-700 focus:outline-none disabled:opacity-50">
<div className="active:bg-white/15">

// 动画
<Loader2 className="w-3 h-3 animate-spin" />
<span className="w-2 h-2 rounded-full animate-pulse" />
```

### 项目实例：LoginForm 的 Tailwind 样式

```typescript
// apps/web/src/components/LoginForm.tsx
return (
  <div className="flex items-center justify-center h-full">
    {/* flex 布局居中，h-full 占满父容器高度 */}
    <form onSubmit={handleSubmit} className="w-72 space-y-4">
      {/* w-72 固定宽度，space-y-4 子元素垂直间距 */}

      <h1 className="text-xl font-semibold text-gray-100 text-center">
        {/* text-xl 大字，font-semibold 半粗体，text-gray-100 浅灰色 */}
        AI CLI Mobile
      </h1>

      {error && (
        <p className="text-red-400 text-xs text-center">{error}</p>
      )}

      <input
        type="text"
        placeholder="用户名"
        className="w-full px-3 py-2 rounded bg-dark-surface border border-dark-border
                   text-gray-100 text-sm focus:outline-none focus:border-blue-500"
        {/* 全宽，内边距，圆角，深色背景，边框，聚焦时蓝色边框 */}
      />

      <button
        type="submit"
        disabled={loading || !username || !password}
        className="w-full py-2 rounded bg-blue-600 text-white text-sm font-medium
                   disabled:opacity-50 disabled:cursor-not-allowed"
        {/* 禁用时半透明 + 禁止点击光标 */}
      >
        {loading ? '登录中...' : '登录'}
      </button>
    </form>
  </div>
)
```

### Tailwind 类名对照表

| 类名 | CSS 等价 | 说明 |
|------|---------|------|
| `flex` | `display: flex` | 弹性布局 |
| `items-center` | `align-items: center` | 垂直居中 |
| `justify-center` | `justify-content: center` | 水平居中 |
| `gap-2` | `gap: 0.5rem` | 间距 8px |
| `px-3` | `padding: 0 0.75rem` | 左右内边距 12px |
| `py-2` | `padding: 0.5rem 0` | 上下内边距 8px |
| `text-sm` | `font-size: 0.875rem` | 14px |
| `text-gray-300` | `color: #d1d5db` | 浅灰色 |
| `bg-dark-surface` | 自定义背景色 | 项目自定义 |
| `rounded` | `border-radius: 0.25rem` | 小圆角 |
| `w-full` | `width: 100%` | 全宽 |
| `h-screen` | `height: 100vh` | 全屏高度 |
| `overflow-hidden` | `overflow: hidden` | 隐藏溢出 |
| `truncate` | 文字截断 | 溢出显示省略号 |
| `transition-colors` | 颜色过渡动画 | 平滑颜色变化 |

---

## 6.3 CSS Modules

### 基本用法

```typescript
// Button.module.css
.button {
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
}

.primary {
  background: #3b82f6;
  color: white;
}

.secondary {
  background: transparent;
  border: 1px solid #6b7280;
  color: #9ca3af;
}
```

```typescript
// Button.tsx
import styles from './Button.module.css'

function Button({ variant = 'primary', children }) {
  return (
    <button className={`${styles.button} ${styles[variant]}`}>
      {children}
    </button>
  )
}

// 编译后：class="Button_button_x7d2k Button_primary_a3f9s"
// 每个类名都有唯一哈希，不会冲突
```

### CSS Modules vs Tailwind

| 特性 | CSS Modules | Tailwind CSS |
|------|------------|-------------|
| **作用域** | 局部（自动哈希） | 全局（工具类） |
| **复用** | 通过组合类名 | 通过组件抽象 |
| **学习曲线** | 需要学 CSS | 需要学工具类名 |
| **文件数量** | 每个组件一个 CSS 文件 | 无需 CSS 文件 |
| **动态样式** | 有限 | 通过条件拼接 |
| **Bundle 大小** | 只包含使用的样式 | PurgeCSS 移除未使用的 |

---

## 6.4 响应式设计

### 移动优先策略

```mermaid
graph LR
    subgraph "移动端优先"
        A["默认样式<br/>（手机）"] -->|"sm: 640px"| B["小平板"]
        B -->|"md: 768px"| C["平板"]
        C -->|"lg: 1024px"| D["桌面"]
        D -->|"xl: 1280px"| E["大屏"]
    end
```

### AI-CLI-Mobile 的响应式设计

AI-CLI-Mobile 是一个**移动优先**的应用，核心设计就是为手机屏幕优化：

```typescript
// 全屏布局
<div className="h-screen w-screen flex flex-col bg-dark-bg">
  {/* h-screen + w-screen = 始终占满整个屏幕 */}

  {/* 状态栏：固定高度 */}
  <StatusBar />

  {/* 会话标签：自动适应 */}
  <SessionTabs />

  {/* 终端区域：占据剩余空间 */}
  <div className="flex-1 relative overflow-hidden">
    <TerminalContainer />
  </div>
</div>
```

### 常用响应式工具

```typescript
// 媒体查询断点
sm: 640px    // 小屏幕（手机横屏）
md: 768px    // 中等屏幕（平板）
lg: 1024px   // 大屏幕（小桌面）
xl: 1280px   // 超大屏幕（桌面）
2xl: 1536px  // 超超大屏幕

// 使用示例
<div className="text-sm md:text-base lg:text-lg">
  {/* 手机：14px | 平板：16px | 桌面：18px */}
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 手机：1列 | 平板：2列 | 桌面：3列 */}
</div>
```

---

## 6.5 暗色主题实现

### 项目中的主题设计

AI-CLI-Mobile 默认使用暗色主题，通过 `theme.ts` 定义统一的颜色方案：

```typescript
// apps/web/src/lib/theme.ts
export const THEME_COLORS = {
  /** 主背景色 */
  bg: '#1a1b26',
  /** 主前景色 / 光标 */
  foreground: '#c0caf5',
  /** 选区 / 匹配括号高亮 */
  selection: '#33467c',
  /** 行号栏 / 边框 */
  gutterBorder: '#292e42',
  /** 行号文字（暗淡） */
  gutterText: '#565f89',
  /** 次要前景色 */
  textMuted: '#a9b1d6',
} as const
```

### 暗色/亮色终端主题

```typescript
// apps/web/src/components/TerminalContainer.tsx

const XTERM_THEME_DARK = {
  background: '#1a1b26',      // 深蓝黑色背景
  foreground: '#c0caf5',      // 浅蓝白色前景
  cursor: '#c0caf5',          // 光标颜色
  selectionBackground: '#33467c',  // 选区背景
  black: '#15161e',
  red: '#f7768e',             // 错误/警告
  green: '#9ece6a',           // 成功/提示
  yellow: '#e0af68',          // 警告
  blue: '#7aa2f7',            // 链接/信息
  magenta: '#bb9af7',         // 特殊
  cyan: '#7dcfff',            // 代码
  white: '#a9b1d6',           // 普通文字
}

const XTERM_THEME_LIGHT = {
  background: '#fafafa',      // 浅灰白色背景
  foreground: '#383a42',      // 深灰黑色前景
  cursor: '#526fff',          // 蓝色光标
  selectionBackground: '#bfceff',  // 浅蓝选区
  // ... 亮色配色
}

// 根据主题选择配色
function getXtermTheme(theme: 'dark' | 'light') {
  return theme === 'light' ? XTERM_THEME_LIGHT : XTERM_THEME_DARK
}
```

### 主题切换的实现

```typescript
// 1. Zustand store 中存储主题
const useSessionStore = create((set) => ({
  theme: 'dark' as 'dark' | 'light',
  setTheme: (theme: 'dark' | 'light') => set({ theme }),
}))

// 2. 组件中使用主题
function TerminalContainer() {
  const theme = useSessionStore((s) => s.theme)

  // 主题变化时同步到终端
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = getXtermTheme(theme)
    }
  }, [theme])

  return (
    <div style={{ backgroundColor: getXtermTheme(theme).background }}>
      {/* ... */}
    </div>
  )
}
```

---

## 6.6 项目中的样式架构

### Tailwind 自定义配置

```typescript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // 自定义暗色主题颜色
        'dark-bg': '#1a1b26',
        'dark-surface': '#24283b',
        'dark-border': '#292e42',
      },
    },
  },
}
```

### 样式组织方式

```mermaid
graph TD
    subgraph "项目样式架构"
        A["Tailwind CSS<br/>主要样式方案"]
        B["theme.ts<br/>终端/编辑器配色"]
        C["index.css<br/>全局基础样式"]
        D["Tailwind 自定义配置<br/>项目特定颜色"]

        A --> E["组件 JSX 中的 className"]
        B --> F["TerminalContainer<br/>CodeEditor"]
        C --> G["reset / 基础样式"]
        D --> H["bg-dark-surface<br/>border-dark-border"]
    end
```

---

## 6.7 本章小结

| 样式方案 | 项目中的用途 | 优势 |
|---------|------------|------|
| **Tailwind CSS** | 组件样式 | 快速开发、一致性 |
| **theme.ts** | 终端/编辑器配色 | 集中管理、易于切换 |
| **自定义配置** | 项目特定颜色 | 品牌一致性 |
| **内联 style** | 动态样式 | 运行时计算的值 |

---

# 第七章：React 路由与导航

## 7.1 什么是前端路由？

### 传统 Web 路由 vs 前端路由

```mermaid
graph LR
    subgraph "传统 Web 路由"
        A["浏览器"] -->|请求 /about| B["服务器"]
        B -->|返回新 HTML| A
        A -->|页面刷新| C["显示新页面"]
    end

    subgraph "前端路由 (SPA)"
        D["浏览器"] -->|点击链接| E["前端 JS"]
        E -->|修改 URL| F["history.pushState"]
        F -->|不刷新页面| G["渲染新组件"]
    end
```

| 特性 | 传统路由 | 前端路由 (SPA) |
|------|---------|--------------|
| **页面刷新** | 每次都刷新 | 不刷新 |
| **加载速度** | 每次重新加载所有资源 | 只加载需要的组件 |
| **用户体验** | 有白屏闪烁 | 无缝切换 |
| **SEO** | 好 | 需要额外处理 |
| **首屏加载** | 快（服务端渲染） | 可能慢（需要下载 JS） |

---

## 7.2 SPA 路由原理

### 浏览器 History API

```typescript
// 推入新历史记录（改变 URL 但不刷新页面）
history.pushState({}, '', '/about')

// 替换当前历史记录
history.replaceState({}, '', '/login')

// 监听浏览器前进/后退
window.addEventListener('popstate', () => {
  console.log('URL changed to:', window.location.pathname)
})
```

### 路由的工作流程

```mermaid
graph TD
    A["用户点击链接"] -->|"pushState"| B["URL 变化"]
    B -->|"路由库匹配"| C["找到对应组件"]
    C -->|"React 渲染"| D["显示新页面"]

    E["用户点击后退"] -->|"popstate 事件"| F["URL 变化"]
    F -->|"路由库匹配"| G["找到对应组件"]
    G -->|"React 渲染"| H["显示旧页面"]
```

---

## 7.3 React Router 基础

### React Router v6 基本用法

```typescript
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/">首页</Link>
        <Link to="/about">关于</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/user/:id" element={<User />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

// 使用导航
function LoginPage() {
  const navigate = useNavigate()

  async function handleLogin() {
    await login(username, password)
    navigate('/dashboard')  // 登录后跳转
  }
}

// 获取 URL 参数
function UserPage() {
  const { id } = useParams()  // 获取 /user/:id 中的 id
  return <div>User ID: {id}</div>
}
```

### 路由配置表

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `Home` | 首页 |
| `/about` | `About` | 关于页面 |
| `/user/:id` | `User` | 动态路由 |
| `/settings` | `Settings` | 设置页面 |
| `*` | `NotFound` | 404 页面 |

---

## 7.4 项目中的单页面架构

### AI-CLI-Mobile 的路由设计

AI-CLI-Mobile 是一个**单页面应用（SPA）**，但它没有使用 React Router——因为它本质上只有**一个页面**：

```mermaid
graph TD
    subgraph "AI-CLI-Mobile 页面结构"
        A["App.tsx"] -->|未登录| B["LoginForm"]
        A -->|已登录| C["主界面"]
        C --> D["StatusBar"]
        C --> E["SessionTabs"]
        C --> F["TerminalContainer"]
        C --> G["CodeEditor（懒加载）"]
    end
```

### 为什么不需要路由？

| 原因 | 说明 |
|------|------|
| **单页面设计** | 整个应用就是一个终端界面 |
| **认证控制** | 通过 `isAuthenticated` 切换显示登录/主界面 |
| **组件级导航** | 文件浏览器、设置面板通过 Drawer/Modal 实现 |
| **无 URL 状态** | 不需要将应用状态映射到 URL |

### 条件渲染替代路由

```typescript
// apps/web/src/App.tsx

export default function App() {
  const { isAuthenticated, login, loadStoredAuth } = useAuth()

  // 根据认证状态切换显示内容（替代路由）
  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen flex flex-col bg-dark-bg">
        <LoginForm onLogin={login} />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-dark-bg">
      <StatusBar />
      <SessionTabs />
      <TerminalContainer />
    </div>
  )
}
```

### 组件级"路由"：Drawer 和 Modal

```mermaid
graph TD
    subgraph "组件级导航方式"
        A["文件浏览器"] -->|"Drawer（底部抽屉）"| B["FileExplorer"]
        C["设置面板"] -->|"Drawer"| D["SettingsDrawer"]
        E["代码编辑器"] -->|"全屏覆盖"| F["CodeEditor"]
        G["连接状态"] -->|"Overlay（遮罩层）"| H["ConnectionOverlay"]
    end
```

```typescript
// 文件浏览器使用 Drawer 组件（vaul 库）
import { Drawer } from 'vaul'

export function FileExplorer({ onFileSelect }: FileExplorerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} direction="bottom">
      <Drawer.Trigger asChild>
        <button onClick={() => setOpen(true)}>
          <FolderOpen className="w-5 h-5" />
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1b26] rounded-t-xl max-h-[85vh]">
          {/* 文件列表内容 */}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
```

---

## 7.5 路由与状态管理的协作

### URL 状态与应用状态

在使用 React Router 的项目中，URL 也是一种状态：

```typescript
// URL 参数作为状态
/user/123        → userId = '123'
/search?q=react  → query = 'react'
/settings#theme  → section = 'theme'

// 将 URL 状态与应用状态同步
function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''

  function handleSearch(newQuery: string) {
    setSearchParams({ q: newQuery })  // 同时更新 URL 和状态
  }
}
```

### 路由守卫

```typescript
// 保护需要认证的路由
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// 使用
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } />
</Routes>
```

---

## 7.6 本章小结

| 概念 | 说明 | 项目使用 |
|------|------|----------|
| **SPA** | 单页面应用，不刷新页面 | ✅ 核心架构 |
| **前端路由** | 通过 JS 切换页面 | 未使用（单页面设计） |
| **条件渲染** | 根据状态显示不同 UI | ✅ 登录/主界面切换 |
| **Drawer/Modal** | 组件级导航 | ✅ 文件浏览器、设置 |
| **懒加载** | 按需加载组件 | ✅ CodeEditor |

```mermaid
graph TD
    subgraph "路由选择指南"
        A["多页面应用？"] -->|是| B["使用 React Router"]
        A -->|否| C["状态驱动 UI"]
        C --> D["条件渲染 + Drawer/Modal"]
    end
```

---

# 第八章：React 测试

## 8.1 为什么要写测试？

### 测试的价值

```mermaid
graph TD
    subgraph "没有测试"
        A["修改代码"] --> B["手动检查"]
        B --> C["遗漏 bug"]
        C --> D["线上事故 💥"]
    end

    subgraph "有测试"
        E["修改代码"] --> F["运行测试"]
        F --> G["测试通过 ✅"]
        G --> H["安心部署"]
        F --> I["测试失败 ❌"]
        I --> J["立即修复"]
    end
```

### 测试金字塔

```mermaid
graph TD
    subgraph "测试金字塔"
        A["E2E 测试<br/>（少量）<br/>测试完整用户流程"]
        B["集成测试<br/>（适量）<br/>测试组件交互"]
        C["单元测试<br/>（大量）<br/>测试独立函数/组件"]
    end
    C --> B --> A
```

| 测试类型 | 速度 | 成本 | 覆盖范围 | 项目示例 |
|---------|------|------|---------|----------|
| **单元测试** | 快 | 低 | 函数、组件 | `sessionStore.test.ts` |
| **集成测试** | 中 | 中 | 多组件交互 | `LoginForm.test.tsx` |
| **E2E 测试** | 慢 | 高 | 完整流程 | Playwright / Cypress |

---

## 8.2 测试工具链：Vitest + React Testing Library

### 工具介绍

| 工具 | 用途 | 特点 |
|------|------|------|
| **Vitest** | 测试运行器 | 兼容 Jest API，速度快，原生 ESM 支持 |
| **React Testing Library** | 组件测试 | 以用户行为为中心的测试方式 |
| **@testing-library/user-event** | 用户交互模拟 | 模拟点击、输入等真实用户操作 |
| **jsdom** | DOM 模拟 | 在 Node.js 中模拟浏览器环境 |

### Vitest 配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,           // 全局 API（describe, it, expect）
    environment: 'jsdom',    // 模拟浏览器 DOM
    setupFiles: './src/test-setup.ts',  // 测试前的设置
    css: true,               // 支持 CSS 导入
  },
})
```

```typescript
// src/test-setup.ts
import '@testing-library/jest-dom'  // 扩展 expect 匹配器
// 例如：expect(element).toBeInTheDocument()
```

### 测试文件命名

```
src/
  __tests__/
    sessionStore.test.ts      // Store 测试
    LoginForm.test.tsx         // 组件测试
    StatusBar.test.tsx         // 组件测试
    ConnectionOverlay.test.tsx
    ErrorBoundary.test.tsx
    SessionTabs.test.tsx
    offlineCache.test.ts
  components/
    LoginForm.tsx
    StatusBar.tsx
  store/
    sessionStore.ts
```

### 测试命令

```bash
# 运行所有测试
npx vitest run

# 监听模式（文件变化时自动重新运行）
npx vitest

# 运行特定测试文件
npx vitest run src/__tests__/LoginForm.test.tsx

# 查看测试覆盖率
npx vitest run --coverage
```

---

## 8.3 组件测试策略

### React Testing Library 的核心理念

```mermaid
graph TD
    subgraph "RTL 的测试哲学"
        A["不测试实现细节"] --> B["不测试 state 是什么"]
        A --> C["不测试内部方法"]
        A --> D["不测试组件结构"]

        E["测试用户行为"] --> F["用户能看到什么？"]
        E --> G["用户能做什么？"]
        E --> H["点击后会发生什么？"]
    end
```

### 常用 API

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// 1. 渲染组件
render(<LoginForm onLogin={mockFn} />)

// 2. 查找元素（按角色、文本、placeholder 等）
const button = screen.getByRole('button', { name: '登录' })
const input = screen.getByPlaceholderText('用户名')
const heading = screen.getByText('AI CLI Mobile')

// 3. 断言元素存在
expect(button).toBeInTheDocument()
expect(heading).toBeInTheDocument()

// 4. 断言元素状态
expect(button).toBeDisabled()
expect(button).toBeEnabled()

// 5. 模拟用户交互
const user = userEvent.setup()
await user.type(input, 'testuser')
await user.click(button)

// 6. 等待异步结果
expect(await screen.findByText('登录中...')).toBeInTheDocument()
```

### 查找元素的优先级

| 优先级 | 方法 | 适用场景 |
|--------|------|----------|
| 1 | `getByRole` | 按钮、输入框、标题等语义元素 |
| 2 | `getByLabelText` | 有关联 label 的表单元素 |
| 3 | `getByPlaceholderText` | 输入框的 placeholder |
| 4 | `getByText` | 按钮文字、段落文字 |
| 5 | `getByDisplayValue` | 输入框当前值 |
| 6 | `getByTestId` | 最后的手段（`data-testid`） |

---

## 8.4 Store 测试

### Zustand Store 测试

Zustand store 是普通的 JavaScript 对象，可以直接测试，不需要渲染组件：

```typescript
// apps/web/src/__tests__/sessionStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '../store/sessionStore'

describe('useSessionStore', () => {
  // 每个测试前重置状态
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  describe('初始状态', () => {
    it('should have correct initial state', () => {
      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.connectionPhase).toBe('DISCONNECTED')
      expect(state.sessionId).toBeNull()
      expect(state.agentStatus).toBe('IDLE')
      expect(state.sessions).toEqual([])
      expect(state.fontSize).toBe(14)
      expect(state.theme).toBe('dark')
      expect(state.activeAdapter).toBe('claude')
    })
  })

  describe('连接状态管理', () => {
    it('should set connected phase', () => {
      useSessionStore.getState().setConnected('CONNECTING_TERM')
      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.connectionPhase).toBe('CONNECTING_TERM')
    })

    it('should set CONNECTED state', () => {
      useSessionStore.getState().setConnected('CONNECTED')
      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(true)
      expect(state.connectionPhase).toBe('CONNECTED')
    })

    it('should set disconnected', () => {
      useSessionStore.getState().setConnected('CONNECTED')
      useSessionStore.getState().setDisconnected()
      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.connectionPhase).toBe('DISCONNECTED')
    })
  })

  describe('会话管理', () => {
    it('should set session and add to list', () => {
      useSessionStore.getState().setSession('test-session-id')
      const state = useSessionStore.getState()
      expect(state.sessionId).toBe('test-session-id')
      expect(state.sessions).toHaveLength(1)
      expect(state.sessions[0].id).toBe('test-session-id')
      expect(state.sessions[0].status).toBe('IDLE')
      expect(state.sessions[0].label).toBe('test-ses')
    })

    it('should not duplicate existing session', () => {
      useSessionStore.getState().setSession('test-session-id')
      useSessionStore.getState().setSession('test-session-id')
      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })

    it('should limit max sessions to 10', () => {
      for (let i = 0; i < 10; i++) {
        useSessionStore.getState().addSession()
      }
      expect(useSessionStore.getState().sessions).toHaveLength(10)

      // 第 11 个应该被忽略
      useSessionStore.getState().addSession()
      expect(useSessionStore.getState().sessions).toHaveLength(10)
    })

    it('should not remove last remaining session', () => {
      useSessionStore.getState().addSession()
      useSessionStore.getState().addSession()
      useSessionStore.getState().removeSession(0)
      expect(useSessionStore.getState().sessions).toHaveLength(1)
      useSessionStore.getState().removeSession(0)
      expect(useSessionStore.getState().sessions).toHaveLength(1)
    })

    it('should switch session by index', () => {
      useSessionStore.getState().addSession()
      useSessionStore.getState().addSession()
      useSessionStore.getState().switchSession(1)
      expect(useSessionStore.getState().activeSessionIndex).toBe(1)
    })

    it('should ignore invalid session index', () => {
      useSessionStore.getState().addSession()
      const origIndex = useSessionStore.getState().activeSessionIndex
      useSessionStore.getState().switchSession(99)
      expect(useSessionStore.getState().activeSessionIndex).toBe(origIndex)
    })
  })

  describe('安全校验', () => {
    it('should validate adapter against whitelist', () => {
      useSessionStore.getState().setActiveAdapter('aider')
      expect(useSessionStore.getState().activeAdapter).toBe('aider')
    })

    it('should reject invalid adapter', () => {
      useSessionStore.getState().setActiveAdapter('malicious')
      expect(useSessionStore.getState().activeAdapter).toBe('claude')
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      useSessionStore.getState().setTokens('a', 'b')
      useSessionStore.getState().setConnected('CONNECTED')
      useSessionStore.getState().setFontSize(20)

      useSessionStore.getState().reset()

      const state = useSessionStore.getState()
      expect(state.isConnected).toBe(false)
      expect(state.accessToken).toBeNull()
      expect(state.fontSize).toBe(14)
    })
  })
})
```

### 测试覆盖率分析

```mermaid
pie title sessionStore 测试覆盖
    "连接状态管理" : 3
    "会话管理" : 7
    "Agent 状态" : 2
    "Token 管理" : 1
    "设置管理" : 4
    "Reset" : 1
```

---

## 8.5 项目中的测试代码分析

### LoginForm 测试

```typescript
// apps/web/src/__tests__/LoginForm.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../components/LoginForm'

describe('LoginForm', () => {
  // 测试 1：渲染检查
  it('应渲染登录表单', () => {
    const onLogin = vi.fn()
    render(<LoginForm onLogin={onLogin} />)

    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
    expect(screen.getByText('AI CLI Mobile')).toBeInTheDocument()
  })

  // 测试 2：按钮状态
  it('空用户名/密码时提交按钮禁用', () => {
    const onLogin = vi.fn()
    render(<LoginForm onLogin={onLogin} />)

    const submitBtn = screen.getByRole('button', { name: '登录' })
    expect(submitBtn).toBeDisabled()
  })

  // 测试 3：输入后按钮可用
  it('输入用户名和密码后提交按钮可用', async () => {
    const onLogin = vi.fn()
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')

    const submitBtn = screen.getByRole('button', { name: '登录' })
    expect(submitBtn).toBeEnabled()
  })

  // 测试 4：客户端验证
  it('密码不足6位时显示错误提示', async () => {
    const onLogin = vi.fn()
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), '12345')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(screen.getByText(/密码长度不能少于 6 位/)).toBeInTheDocument()
    expect(onLogin).not.toHaveBeenCalled()
  })

  // 测试 5：正常提交
  it('有效输入提交时调用 onLogin', async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined)
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(onLogin).toHaveBeenCalledWith('testuser', 'password123')
  })

  // 测试 6：错误处理
  it('onLogin 抛出错误时显示错误消息', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument()
  })

  // 测试 7：加载状态
  it('提交中时按钮显示加载状态', async () => {
    let resolveLogin: () => void = () => {}
    const onLogin = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveLogin = resolve })
    )
    render(<LoginForm onLogin={onLogin} />)

    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
    await user.type(screen.getByPlaceholderText('密码'), 'password123')
    await user.click(screen.getByRole('button', { name: '登录' }))

    expect(screen.getByText('登录中...')).toBeInTheDocument()
    resolveLogin()
  })
})
```

### StatusBar 测试

```typescript
// apps/web/src/__tests__/StatusBar.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBar } from '../components/StatusBar'
import { useSessionStore } from '../store/sessionStore'

describe('StatusBar', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })

  it('断开连接时显示红色指示灯', () => {
    render(<StatusBar />)
    const dot = document.querySelector('.bg-red-500')
    expect(dot).toBeInTheDocument()
  })

  it('已连接时显示绿色指示灯', () => {
    useSessionStore.getState().setConnected('CONNECTED')
    render(<StatusBar />)
    const dot = document.querySelector('.bg-green-500')
    expect(dot).toBeInTheDocument()
  })

  it('连接中时显示黄色指示灯', () => {
    useSessionStore.getState().setConnected('CONNECTING_TERM')
    render(<StatusBar />)
    const dot = document.querySelector('.bg-yellow-500')
    expect(dot).toBeInTheDocument()
  })

  it('显示 IDLE 状态标签', () => {
    render(<StatusBar />)
    expect(screen.getByText('IDLE')).toBeInTheDocument()
  })

  it('显示 RUNNING 状态标签', () => {
    useSessionStore.getState().setAgentStatus('RUNNING')
    render(<StatusBar />)
    expect(screen.getByText('RUNNING')).toBeInTheDocument()
  })

  it('显示 WAITING_APPROVAL 状态', () => {
    useSessionStore.getState().setAgentStatus('WAITING_APPROVAL')
    render(<StatusBar />)
    expect(screen.getByText('APPROVAL')).toBeInTheDocument()
  })

  it('显示当前活跃 session 的 label', () => {
    useSessionStore.getState().setSession('my-session-123')
    render(<StatusBar />)
    expect(screen.getByText('my-sess')).toBeInTheDocument()
  })

  it('渲染 actionsSlot 插槽', () => {
    render(<StatusBar actionsSlot={<button>自定义按钮</button>} />)
    expect(screen.getByText('自定义按钮')).toBeInTheDocument()
  })
})
```

### ErrorBoundary 测试

```typescript
// apps/web/src/__tests__/ErrorBoundary.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '../components/ErrorBoundary'

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('正常渲染子组件', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('捕获错误并显示错误 UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('应用发生了错误')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
  })

  it('点击重试按钮恢复', async () => {
    let shouldThrow = true
    function DynamicComponent() {
      if (shouldThrow) throw new Error('Test error')
      return <div>Recovered</div>
    }

    render(
      <ErrorBoundary>
        <DynamicComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('应用发生了错误')).toBeInTheDocument()

    shouldThrow = false
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '重试' }))

    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })

  it('多次失败后显示刷新按钮', async () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    const user = userEvent.setup()
    for (let i = 0; i < 3; i++) {
      const retryBtn = screen.queryByRole('button', { name: '重试' })
      if (retryBtn) await user.click(retryBtn)
    }

    expect(screen.getByText('多次重试失败，请刷新页面')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '刷新页面' })).toBeInTheDocument()
  })
})
```

---

## 8.6 测试最佳实践

### 1. 测试用户行为，不测试实现细节

```typescript
// ❌ 错误：测试内部 state
it('should update state', () => {
  render(<LoginForm />)
  expect(component.state.username).toBe('')
})

// ✅ 正确：测试用户看到的结果
it('输入后显示用户名', async () => {
  render(<LoginForm onLogin={vi.fn()} />)
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('用户名'), 'testuser')
  expect(screen.getByPlaceholderText('用户名')).toHaveValue('testuser')
})
```

### 2. 测试边界情况

```typescript
describe('sessionStore', () => {
  it('should limit max sessions to 10', () => { /* ... */ })
  it('should not remove last remaining session', () => { /* ... */ })
  it('should ignore invalid session index', () => { /* ... */ })
  it('should reject invalid adapter', () => { /* ... */ })
})
```

### 3. 使用 beforeEach 清理状态

```typescript
describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().reset()
  })
  // 每个测试从干净的状态开始
})
```

### 4. Mock 外部依赖

```typescript
// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ accessToken: 'test' }),
})

// Mock WebSocket
class MockWebSocket {
  send = vi.fn()
  close = vi.fn()
}
global.WebSocket = MockWebSocket as any
```

### 5. 测试命名规范

```typescript
describe('LoginForm', () => {
  // describe = 被测试的模块/组件
  it('应渲染登录表单', () => { /* ... */ })
  // it = 具体的行为描述
  it('空用户名/密码时提交按钮禁用', () => { /* ... */ })
  // 描述条件 + 预期行为
  it('密码不足6位时显示错误提示', () => { /* ... */ })
  // 描述异常场景
})
```

---

## 8.7 本章小结

| 测试概念 | 说明 | 项目示例 |
|---------|------|----------|
| **单元测试** | 测试独立的函数/Store | `sessionStore.test.ts` |
| **组件测试** | 测试组件的渲染和交互 | `LoginForm.test.tsx` |
| **边界测试** | 测试异常和极端情况 | 会话数量限制、无效输入 |
| **Mock** | 模拟外部依赖 | `vi.fn()`、`mockResolvedValue` |
| **行为驱动** | 测试用户视角的行为 | `getByRole`、`userEvent` |

```mermaid
graph TD
    subgraph "React 测试流程"
        A["编写测试"] --> B["运行 vitest"]
        B --> C{"全部通过？"}
        C -->|是| D["提交代码 ✅"]
        C -->|否| E["修复 bug"]
        E --> A
    end
```

---

# 附录 A：React 核心 API 速查表

## Hooks 速查

```typescript
// useState - 状态管理
const [value, setValue] = useState(initialValue)
setValue(newValue)              // 直接设置
setValue(prev => prev + 1)     // 函数式更新

// useEffect - 副作用
useEffect(() => {
  // 副作用代码
  return () => { /* 清理 */ }
}, [dependencies])

// useRef - 可变引用
const ref = useRef(initialValue)
ref.current = newValue         // 修改不触发渲染

// useCallback - 缓存函数
const fn = useCallback(() => { /* ... */ }, [deps])

// useMemo - 缓存值
const value = useMemo(() => compute(), [deps])

// useContext - 读取 Context
const value = useContext(MyContext)

// useReducer - 复杂状态
const [state, dispatch] = useReducer(reducer, initialState)

// 自定义 Hook
function useCustomHook() {
  const [value, setValue] = useState()
  useEffect(() => { /* ... */ }, [])
  return { value, setValue }
}
```

## 常用类型

```typescript
// 事件类型
React.FormEvent                    // 表单提交
React.ChangeEvent<HTMLInputElement> // 输入变化
React.KeyboardEvent<HTMLInputElement> // 键盘事件
React.MouseEvent<HTMLButtonElement>   // 鼠标事件

// 元素类型
React.ReactNode     // 任何可渲染的内容
React.ReactElement  // JSX 元素
React.CSSProperties // 内联样式对象

// Hook 类型
useRef<HTMLDivElement>(null)         // DOM 引用
useState<string>('')                 // 指定 state 类型
useCallback(() => {}, [])           // 函数类型推断
```

---

# 附录 B：常见错误与解决方案

## 错误 1：闭包陷阱

```typescript
// ❌ 错误
function Counter() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(count + 1)  // count 永远是 0
    }, 1000)
    return () => clearInterval(timer)
  }, [])
}

// ✅ 正确
function Counter() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(prev => prev + 1)  // 函数式更新
    }, 1000)
    return () => clearInterval(timer)
  }, [])
}
```

## 错误 2：忘记清理副作用

```typescript
// ❌ 错误：内存泄漏
useEffect(() => {
  window.addEventListener('resize', handler)
  // 没有清理！
}, [])

// ✅ 正确
useEffect(() => {
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)
}, [])
```

## 错误 3：对象/数组作为依赖

```typescript
// ❌ 错误：每次渲染都创建新对象
const config = { url: 'ws://localhost' }
useEffect(() => {
  const ws = new WebSocket(config.url)
}, [config])

// ✅ 正确：使用 useMemo 缓存
const config = useMemo(() => ({ url: 'ws://localhost' }), [])
useEffect(() => {
  const ws = new WebSocket(config.url)
}, [config])
```

## 错误 4：在循环/条件中使用 Hooks

```typescript
// ❌ 错误
if (isLoggedIn) {
  const [user, setUser] = useState(null)  // 条件中使用
}

// ✅ 正确
const [user, setUser] = useState(null)  // 始终在顶层
if (isLoggedIn) {
  // 使用 user
}
```

## 错误 5：直接修改 state

```typescript
// ❌ 错误
const [items, setItems] = useState([1, 2, 3])
items.push(4)           // 直接修改数组
setItems(items)         // 引用没变，不触发渲染

// ✅ 正确
setItems([...items, 4])  // 创建新数组
setItems(prev => [...prev, 4])  // 函数式更新
```

---

# 附录 C：项目文件结构与组件关系

## 完整文件结构

```
apps/web/src/
├── App.tsx                    # 根组件
├── main.tsx                   # 应用入口
├── index.css                  # 全局样式
├── vite-env.d.ts              # Vite 类型声明
├──
├── components/                # UI 组件
│   ├── CodeEditor.tsx         # 代码编辑器（懒加载）
│   ├── ConnectionOverlay.tsx  # 连接状态遮罩
│   ├── ErrorBoundary.tsx      # 错误边界
│   ├── FileExplorer.tsx       # 文件浏览器（Drawer）
│   ├── LoginForm.tsx          # 登录表单
│   ├── QuickActionsPanel.tsx  # 快捷操作面板
│   ├── SessionTabs.tsx        # 多会话标签栏
│   ├── SettingsDrawer.tsx     # 设置抽屉
│   ├── StatusBar.tsx          # 顶部状态栏
│   └── TerminalContainer.tsx  # 终端容器（核心）
├──
├── hooks/                     # 自定义 Hooks
│   ├── useAuth.ts             # 认证 Hook
│   └── useDualChannelWS.ts   # 双通道 WebSocket Hook
├──
├── store/                     # 状态管理
│   └── sessionStore.ts        # Zustand store
├──
├── lib/                       # 工具库
│   ├── theme.ts               # 主题配色
│   ├── notifications.ts       # 浏览器通知
│   ├── offlineCache.ts        # 离线缓存
│   └── GestureHandler.ts      # 手势处理
├──
├── adapters/                  # 适配器
│   └── MobileKeyboardAdapter.ts  # 移动端键盘适配
└──
└── __tests__/                 # 测试文件
    ├── sessionStore.test.ts
    ├── LoginForm.test.tsx
    ├── StatusBar.test.tsx
    ├── ConnectionOverlay.test.tsx
    ├── ErrorBoundary.test.tsx
    ├── SessionTabs.test.tsx
    └── offlineCache.test.ts
```

## 组件依赖关系图

```mermaid
graph TD
    subgraph "入口"
        Main["main.tsx"] --> EB["ErrorBoundary"]
        EB --> App["App.tsx"]
    end

    subgraph "认证层"
        App --> LF["LoginForm"]
        App --> Auth["useAuth hook"]
    end

    subgraph "主界面"
        App --> SB["StatusBar"]
        App --> ST["SessionTabs"]
        App --> TC["TerminalContainer"]
    end

    subgraph "功能组件"
        SB --> FE["FileExplorer"]
        SB --> SD["SettingsDrawer"]
        TC --> CO["ConnectionOverlay"]
        TC --> QAP["QuickActionsPanel"]
        App -.->|"懒加载"| CE["CodeEditor"]
    end

    subgraph "Hooks"
        TC --> DCWS["useDualChannelWS"]
        TC --> Auth
        App --> Auth
    end

    subgraph "Store"
        Auth --> SS["sessionStore"]
        DCWS --> SS
        TC --> SS
        ST --> SS
        SB --> SS
    end
```

## 数据流图

```mermaid
graph LR
    subgraph "用户操作"
        A["登录"] --> B["useAuth.login()"]
        C["输入命令"] --> D["sendInput()"]
        E["切换会话"] --> F["switchSession()"]
    end

    subgraph "状态更新"
        B --> G["sessionStore.setTokens()"]
        D --> H["WebSocket.send()"]
        F --> I["sessionStore.switchSession()"]
    end

    subgraph "UI 响应"
        G --> J["App 重新渲染"]
        H --> K["终端显示输出"]
        I --> L["标签栏更新"]
    end
```

---

# 附录 D：学习路线图

## 初学者路线

```mermaid
graph TD
    A["第 1 步：JavaScript 基础"] --> B["第 2 步：React 基础概念"]
    B --> C["第 3 步：组件与 JSX"]
    C --> D["第 4 步：Props 与 State"]
    D --> E["第 5 步：useEffect"]
    E --> F["第 6 步：自定义 Hooks"]
    F --> G["第 7 步：状态管理"]
    G --> H["第 8 步：TypeScript"]
    H --> I["第 9 步：测试"]
    I --> J["第 10 步：性能优化"]
```

## 每步推荐资源

| 步骤 | 学习内容 | 推荐资源 | 预计时间 |
|------|---------|----------|----------|
| 1 | JavaScript | MDN、JavaScript.info | 2-4 周 |
| 2 | React 基础 | React 官方教程 | 1-2 周 |
| 3 | 组件与 JSX | 本篇第一章 | 1 周 |
| 4 | Props 与 State | 本篇第一章 | 1 周 |
| 5 | useEffect | 本篇第二章 | 1 周 |
| 6 | 自定义 Hooks | 本篇第二章 | 1 周 |
| 7 | 状态管理 | 本篇第四章 | 1 周 |
| 8 | TypeScript | 本篇第五章 | 2 周 |
| 9 | 测试 | 本篇第八章 | 1 周 |
| 10 | 性能优化 | 本篇第三章 | 1 周 |

---

# 附录 E：术语表

| 术语 | 英文 | 解释 |
|------|------|------|
| 组件 | Component | React 的基本构建块 |
| 属性 | Props | 父组件传递给子组件的数据 |
| 状态 | State | 组件内部的可变数据 |
| 钩子 | Hook | 在函数组件中使用 React 特性的函数 |
| 虚拟 DOM | Virtual DOM | 内存中的 DOM 表示 |
| 渲染 | Render | 将组件转换为 DOM 元素 |
| 重渲染 | Re-render | State 或 Props 变化后重新渲染 |
| 副作用 | Side Effect | 渲染之外的操作（网络请求、DOM 操作等） |
| 闭包 | Closure | 函数捕获外部变量的机制 |
| 选择器 | Selector | 从 Store 中选取特定数据的函数 |
| 高阶组件 | HOC | 接收组件返回新组件的函数 |
| 插槽 | Slot | 父组件传入的 JSX 内容 |
| 懒加载 | Lazy Loading | 按需加载组件 |
| 代码分割 | Code Splitting | 将代码拆分成多个小块 |
| 提升 | Lifting State Up | 将 State 移到公共父组件 |
| 钻透 | Prop Drilling | Props 通过多层中间组件传递 |

---

> 📖 **本篇总结**
>
> 本篇从 React 的基础概念出发，深入讲解了 Hooks、性能优化、状态管理、TypeScript 集成、样式方案、路由系统和测试策略。所有示例均来自 AI-CLI-Mobile 项目的真实代码，帮助你在理解理论的同时掌握实战技能。
>
> **关键要点：**
> 1. **组件化**是 React 的核心思想——将 UI 拆分为独立、可复用的积木块
> 2. **Hooks**是现代 React 的基础——`useState`、`useEffect`、`useRef`、`useCallback`、`useMemo`
> 3. **自定义 Hooks**封装可复用逻辑——`useAuth`、`useDualChannelWS`
> 4. **Zustand**是轻量级状态管理的优选——简单 API、优秀性能
> 5. **TypeScript** 提供编译时类型安全——减少运行时错误
> 6. **Tailwind CSS** 是高效的样式方案——原子类名、快速开发
> 7. **Vitest + React Testing Library**是测试标配——以用户行为为中心
>
> 学完本篇，你应该能够读懂 AI-CLI-Mobile 的前端代码，并具备独立开发 React 应用的能力。

---

# 附录 F：React 核心原理深入

## F.1 Virtual DOM 的工作原理

### 什么是 Virtual DOM？

Virtual DOM 是 React 在内存中维护的一棵轻量级 DOM 树。当状态变化时，React 会：

1. 创建一棵新的 Virtual DOM 树
2. 与旧的 Virtual DOM 树进行比较（Diff 算法）
3. 计算出最小的 DOM 操作
4. 批量应用到真实 DOM

```mermaid
graph TD
    subgraph "Virtual DOM 工作流程"
        A["State 变化"] --> B["调用 render()"]
        B --> C["生成新的 Virtual DOM 树"]
        C --> D["Diff 算法比较新旧树"]
        D --> E["计算最小 DOM 操作"]
        E --> F["批量更新真实 DOM"]
        F --> G["页面更新"]
    end
```

### 为什么需要 Virtual DOM？

直接操作 DOM 是昂贵的。Virtual DOM 的价值在于：

| 操作 | 直接 DOM | Virtual DOM |
|------|---------|-------------|
| **单次更新** | 快 | 稍慢（多了 Diff） |
| **批量更新** | 慢（每次都触发重排） | 快（合并为一次更新） |
| **跨平台** | 只能在浏览器 | 可以渲染到任何地方（React Native） |
| **声明式** | 命令式操作 | 声明式描述 |

### Diff 算法的策略

React 的 Diff 算法有三个关键假设：

```mermaid
graph TD
    subgraph "Diff 算法三大策略"
        A["策略 1：不同类型的元素产生不同的树"]
        B["策略 2：通过 key 标识同一层级的元素"]
        C["策略 3：只比较同一层级的元素"]
    end
```

```typescript
// 策略 1：类型不同 → 整棵子树替换
// 旧：<div><Counter /></div>
// 新：<span><Counter /></span>
// 结果：整个 div 被替换，Counter 也被重新创建

// 策略 2：使用 key 标识元素
// 旧：[<li key="a">A</li>, <li key="b">B</li>]
// 新：[<li key="b">B</li>, <li key="a">A</li>]
// 结果：只是移动了 li 元素，而不是重新创建

// 策略 3：只比较同层节点
// 不会尝试跨层级移动元素
```

## F.2 Fiber 架构

### 什么是 Fiber？

Fiber 是 React 16 引入的新的协调引擎。它解决了旧架构的一个关键问题：**长时间的同步渲染会阻塞主线程**。

```mermaid
graph LR
    subgraph "旧架构（Stack Reconciler）"
        A["开始渲染"] --> B["递归处理整个组件树"]
        B --> C["期间无法中断"]
        C --> D["主线程被阻塞"]
        D --> E["用户交互卡顿"]
    end

    subgraph "新架构（Fiber Reconciler）"
        F["开始渲染"] --> G["处理一个 Fiber 节点"]
        G --> H{"还有时间？"}
        H -->|是| I["处理下一个节点"]
        H -->|否| J["让出主线程"]
        J --> K["处理用户交互"]
        K --> G
        I --> H
    end
```

### Fiber 节点的结构

每个 React 元素都被转换为一个 Fiber 节点：

```typescript
interface Fiber {
  tag: number              // 节点类型（函数组件、类组件、DOM 元素等）
  type: any                // 组件类型（函数、类、字符串标签名）
  key: string | null       // key 属性
  stateNode: any           // DOM 节点或组件实例

  // 树结构
  return: Fiber | null     // 父 Fiber
  child: Fiber | null      // 第一个子 Fiber
  sibling: Fiber | null    // 下一个兄弟 Fiber

  // 状态
  pendingProps: any        // 新的 props
  memoizedProps: any       // 上次渲染的 props
  memoizedState: any       // 上次渲染的 state

  // 副作用
  flags: number            // 需要执行的操作（插入、更新、删除）
  updateQueue: any         // 更新队列
}
```

### 双缓存机制

React 使用"双缓存"技术来实现高效的 UI 更新：

```mermaid
graph TD
    subgraph "双缓存机制"
        A["current 树<br/>（屏幕上的 UI）"] -->|"commit 阶段"| B["workInProgress 树<br/>（正在构建的 UI）"]
        B -->|"完成"| A
    end

    subgraph "渲染过程"
        C["触发更新"] --> D["基于 current 创建 workInProgress"]
        D --> E["遍历 workInProgress，计算变更"]
        E --> F["commit 阶段：将变更应用到 DOM"]
        F --> G["workInProgress 变成新的 current"]
    end
```

## F.3 调度与优先级

### 更新优先级

React 为不同类型的更新分配不同的优先级：

```mermaid
graph TD
    subgraph "更新优先级（从高到低）"
        A["Immediate<br/>立即执行"] --> B["UserBlocking<br/>用户交互（点击、输入）"]
        B --> C["Normal<br/>普通更新（网络请求）"]
        C --> D["Low<br/>低优先级更新"]
        D --> E["Idle<br/>空闲时执行"]
    end
```

### Concurrent Mode 的价值

```typescript
// 使用 startTransition 标记低优先级更新
import { startTransition } from 'react'

function SearchResults({ query }: { query: string }) {
  const [results, setResults] = useState([])

  function handleSearch(newQuery: string) {
    // 高优先级：立即更新输入框
    setQuery(newQuery)

    // 低优先级：可以被中断的搜索结果更新
    startTransition(() => {
      setResults(filterLargeList(newQuery))
    })
  }
}
```

---

# 附录 G：React 设计模式

## G.1 组合模式（Composition）

### 插槽模式

```typescript
// 项目实例：StatusBar 的 actionsSlot
interface LayoutProps {
  header: React.ReactNode
  sidebar: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
}

function Layout({ header, sidebar, children, footer }: LayoutProps) {
  return (
    <div className="layout">
      <header>{header}</header>
      <div className="main">
        <aside>{sidebar}</aside>
        <main>{children}</main>
      </div>
      <footer>{footer}</footer>
    </div>
  )
}

// 使用
<Layout
  header={<NavBar />}
  sidebar={<Sidebar />}
  footer={<Footer />}
>
  <Content />
</Layout>
```

### 特殊化模式

```typescript
// 基础组件
function Dialog({ title, children, onClose }: DialogProps) {
  return (
    <div className="dialog">
      <div className="dialog-header">
        <h2>{title}</h2>
        <button onClick={onClose}>×</button>
      </div>
      <div className="dialog-body">{children}</div>
    </div>
  )
}

// 特殊化组件
function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog title="确认" onClose={onCancel}>
      <p>{message}</p>
      <button onClick={onConfirm}>确认</button>
      <button onClick={onCancel}>取消</button>
    </Dialog>
  )
}

function AlertDialog({ message, onClose }: AlertDialogProps) {
  return (
    <Dialog title="提示" onClose={onClose}>
      <p>{message}</p>
      <button onClick={onClose}>确定</button>
    </Dialog>
  )
}
```

## G.2 容器/展示模式（Container/Presenter）

```mermaid
graph TD
    subgraph "容器组件（Container）"
        A["获取数据"] --> B["处理业务逻辑"]
        B --> C["管理状态"]
    end

    subgraph "展示组件（Presenter）"
        D["接收 props"] --> E["渲染 UI"]
        E --> F["触发事件回调"]
    end

    C -->|"传递 props"| D
    F -->|"调用回调"| B
```

```typescript
// 容器组件：负责数据和逻辑
function UserListContainer() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchUsers().then(data => {
      setUsers(data)
      setLoading(false)
    })
  }, [])

  const handleDelete = useCallback(async (id: string) => {
    await deleteUser(id)
    setUsers(prev => prev.filter(u => u.id !== id))
  }, [])

  return (
    <UserList
      users={users}
      loading={loading}
      onDelete={handleDelete}
    />
  )
}

// 展示组件：负责 UI
function UserList({ users, loading, onDelete }: UserListProps) {
  if (loading) return <Spinner />

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>
          {user.name}
          <button onClick={() => onDelete(user.id)}>删除</button>
        </li>
      ))}
    </ul>
  )
}
```

## G.3 自定义 Hook 模式

### 数据获取 Hook

```typescript
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchData() {
      try {
        setLoading(true)
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        setData(json)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setError(err)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    return () => controller.abort()
  }, [url])

  return { data, loading, error }
}

// 使用
function UserProfile({ userId }: { userId: string }) {
  const { data: user, loading, error } = useFetch<User>(`/api/users/${userId}`)

  if (loading) return <Spinner />
  if (error) return <ErrorMessage error={error} />
  return <div>{user?.name}</div>
}
```

### 表单 Hook

```typescript
function useForm<T extends Record<string, string>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues)
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({})
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  function handleChange(name: keyof T, value: string) {
    setValues(prev => ({ ...prev, [name]: value }))
  }

  function handleBlur(name: keyof T) {
    setTouched(prev => ({ ...prev, [name]: true }))
  }

  function validate(validator: (values: T) => Partial<Record<keyof T, string>>) {
    const newErrors = validator(values)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function reset() {
    setValues(initialValues)
    setErrors({})
    setTouched({})
  }

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validate,
    reset,
  }
}

// 使用
function SignupForm() {
  const form = useForm({ username: '', email: '', password: '' })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const isValid = form.validate(values => {
      const errors: Record<string, string> = {}
      if (!values.username) errors.username = '用户名不能为空'
      if (!values.email.includes('@')) errors.email = '邮箱格式不正确'
      if (values.password.length < 6) errors.password = '密码至少 6 位'
      return errors
    })
    if (isValid) {
      // 提交表单
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={form.values.username}
        onChange={e => form.handleChange('username', e.target.value)}
        onBlur={() => form.handleBlur('username')}
      />
      {form.touched.username && form.errors.username && (
        <span className="error">{form.errors.username}</span>
      )}
      {/* ... */}
    </form>
  )
}
```

### 防抖 Hook

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// 使用
function SearchInput() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery) {
      search(debouncedQuery)
    }
  }, [debouncedQuery])

  return <input value={query} onChange={e => setQuery(e.target.value)} />
}
```

### 媒体查询 Hook

```typescript
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches
    }
    return false
  })

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [query])

  return matches
}

// 使用
function ResponsiveLayout() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')

  if (isMobile) return <MobileLayout />
  if (isTablet) return <TabletLayout />
  return <DesktopLayout />
}
```

---

# 附录 H：React 生态系统

## H.1 常用库推荐

### UI 组件库

| 库 | 特点 | 适用场景 |
|---|------|---------|
| **shadcn/ui** | 可复制的组件、Tailwind CSS | 高度自定义的项目 |
| **Ant Design** | 企业级、组件丰富 | 后台管理系统 |
| **Material UI** | Google Material Design | 通用 Web 应用 |
| **Radix UI** | Headless、无障碍 | 需要完全自定义样式 |
| **Chakra UI** | 简洁 API、主题系统 | 快速开发 |

### 状态管理

| 库 | 特点 | 适用场景 |
|---|------|---------|
| **Zustand** | 轻量、简单 API | 中小型项目（✅ 本项目） |
| **Jotai** | 原子化状态 | 细粒度状态管理 |
| **Redux Toolkit** | 企业级、DevTools | 大型复杂项目 |
| **TanStack Query** | 服务端状态管理 | API 数据缓存 |
| **Valtio** | 代理式、Mutable API | 喜欢 mutable 风格 |

### 路由

| 库 | 特点 | 适用场景 |
|---|------|---------|
| **React Router** | 官方推荐、最流行 | 通用 SPA |
| **TanStack Router** | 类型安全、文件路由 | TypeScript 项目 |
| **Next.js App Router** | 服务端渲染、文件路由 | 全栈应用 |

### 表单

| 库 | 特点 | 适用场景 |
|---|------|---------|
| **React Hook Form** | 性能好、无依赖 | 通用表单 |
| **Formik** | 功能丰富 | 复杂表单 |
| **Zod** | 类型验证 | 配合 TypeScript |

### 动画

| 库 | 特点 | 适用场景 |
|---|------|---------|
| **Framer Motion** | 声明式、功能丰富 | 通用动画 |
| **React Spring** | 物理动画 | 自然运动效果 |
| **GSAP** | 专业级动画库 | 复杂动画序列 |

## H.2 构建工具

| 工具 | 特点 | 适用场景 |
|------|------|---------|
| **Vite** | 快速、原生 ESM | 新项目（✅ 本项目） |
| **Webpack** | 成熟、插件丰富 | 需要复杂配置的项目 |
| **Turbopack** | Rust 实现、极快 | Next.js 项目 |
| **esbuild** | 极速编译 | 底层工具 |

## H.3 测试工具

| 工具 | 用途 | 特点 |
|------|------|------|
| **Vitest** | 单元测试 | 快速、兼容 Jest API（✅ 本项目） |
| **React Testing Library** | 组件测试 | 以用户行为为中心（✅ 本项目） |
| **Playwright** | E2E 测试 | 多浏览器、可靠 |
| **Cypress** | E2E 测试 | 开发体验好 |
| **Storybook** | 组件开发 | 隔离开发、文档化 |
| **MSW** | API Mock | 拦截网络请求 |

---

# 附录 I：React 18 新特性

## I.1 自动批处理（Automatic Batching）

### 什么是批处理？

在 React 18 之前，只有 React 事件处理函数中的多个 setState 会被批处理。在 setTimeout、Promise、原生事件中，每次 setState 都会触发一次重渲染。

```typescript
// React 17：setTimeout 中不批处理
setTimeout(() => {
  setCount(c => c + 1)  // 触发重渲染
  setFlag(f => !f)      // 又触发重渲染
}, 0)

// React 18：自动批处理
setTimeout(() => {
  setCount(c => c + 1)  // |
  setFlag(f => !f)      // | 合并为一次重渲染
}, 0)
```

### 项目中的批处理

```typescript
// apps/web/src/store/sessionStore.ts
// 多个 state 更新会被自动批处理
setConnected: (phase) =>
  set({
    isConnected: phase === 'CONNECTED',  // |
    connectionPhase: phase,               // | Zustand 的 set 已经是批处理的
  }),
```

## I.2 Suspense 改进

### 服务端 Suspense（SSR 流式渲染）

```mermaid
graph TD
    subgraph "传统 SSR"
        A["服务端渲染整个页面"] --> B["等待所有数据加载"]
        B --> C["发送完整 HTML"]
        C --> D["用户看到页面"]
    end

    subgraph "React 18 Suspense SSR"
        E["服务端渲染 Shell"] --> F["立即发送 Shell"]
        F --> G["用户看到骨架"]
        H["数据加载完成"] --> I["流式发送 Suspense 内容"]
        I --> J["页面渐进式完善"]
    end
```

## I.3 Transitions

### useTransition

```typescript
function TabContainer() {
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState('home')

  function selectTab(nextTab: string) {
    startTransition(() => {
      setTab(nextTab)  // 低优先级更新
    })
  }

  return (
    <div>
      <TabBar onClick={selectTab} />
      {isPending && <Spinner />}
      <TabContent tab={tab} />
    </div>
  )
}
```

### useDeferredValue

```typescript
function SearchResults({ query }: { query: string }) {
  const deferredQuery = useDeferredValue(query)

  // deferredQuery 会在 query 更新后延迟更新
  // 在等待期间，UI 仍然可以响应用户输入
  return <MemoizedResultList query={deferredQuery} />
}
```

---

# 附录 J：React 最佳实践总结

## J.1 组件设计原则

```mermaid
graph TD
    subgraph "组件设计原则"
        A["单一职责"] --> B["一个组件只做一件事"]
        C["可组合性"] --> D["通过组合构建复杂 UI"]
        E["可复用性"] --> F["通过 props 定制行为"]
        G["可测试性"] --> H["纯函数、明确的输入输出"]
    end
```

| 原则 | 说明 | 反例 |
|------|------|------|
| **单一职责** | 一个组件只负责一个功能 | 一个组件同时负责列表、搜索、分页 |
| **合理的粒度** | 不要太细也不要太粗 | 一个 500 行的组件 vs 10 行一个组件 |
| **明确的接口** | Props 类型清晰 | `{...rest}` 传递所有 props |
| **避免过深嵌套** | 组件树不要太深 | 超过 5 层的 props 传递 |

## J.2 状态管理原则

```mermaid
graph TD
    subgraph "状态应该放在哪里？"
        A["只在一个组件用？"] -->|"是"| B["useState"]
        A -->|"否"| C["需要跨多个组件？"]
        C -->|"是"| D["Zustand / Context"]
        C -->|"否"| E["提升到父组件"]
    end
```

| 原则 | 说明 |
|------|------|
| **最小化状态** | 能从 props 或其他状态推导的，不要存 |
| **状态靠近使用处** | 不要过早提升状态 |
| **避免冗余状态** | 不要存储可以从其他数据计算的值 |
| **不可变更新** | 始终创建新对象/数组，不要直接修改 |

```typescript
// ❌ 冗余状态
const [firstName, setFirstName] = useState('')
const [lastName, setLastName] = useState('')
const [fullName, setFullName] = useState('')  // 冗余！可以从 firstName + lastName 推导

// ✅ 计算值
const [firstName, setFirstName] = useState('')
const [lastName, setLastName] = useState('')
const fullName = `${firstName} ${lastName}`  // 不是状态，是计算值
```

## J.3 性能优化原则

| 原则 | 说明 |
|------|------|
| **先测量再优化** | 不要凭直觉优化，用 Profiler 找瓶颈 |
| **默认不优化** | 大多数情况下 React 已经够快了 |
| **选择器精确订阅** | Zustand 中只订阅需要的字段 |
| **稳定引用** | 传递给 memo 组件的 props 要稳定 |
| **懒加载大组件** | 不常用的重型组件用 lazy |

## J.4 代码组织原则

```
src/
├── components/        # UI 组件（按功能组织）
│   ├── FeatureA/
│   │   ├── ComponentA.tsx
│   │   ├── ComponentA.test.tsx
│   │   └── useFeatureA.ts
│   └── FeatureB/
├── hooks/             # 全局自定义 Hooks
├── store/             # 全局状态
├── lib/               # 工具函数
├── types/             # 共享类型定义
└── adapters/          # 外部适配器
```

## J.5 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| **组件** | PascalCase | `LoginForm`、`StatusBar` |
| **Hook** | use 前缀 + PascalCase | `useAuth`、`useDualChannelWS` |
| **工具函数** | camelCase | `formatFileSize`、`getXtermTheme` |
| **常量** | UPPER_SNAKE_CASE | `MAX_SESSIONS`、`PING_INTERVAL` |
| **类型/接口** | PascalCase | `SessionEntry`、`FileExplorerProps` |
| **文件** | 组件用 PascalCase，其他用 camelCase | `LoginForm.tsx`、`theme.ts` |

---

# 附录 K：从零搭建 React 项目的步骤

## K.1 使用 Vite 创建项目

```bash
# 创建 React + TypeScript 项目
npm create vite@latest my-app -- --template react-ts

# 进入项目
cd my-app

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## K.2 安装常用依赖

```bash
# 状态管理
npm install zustand

# 路由
npm install react-router-dom

# 样式
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 测试
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# 图标
npm install lucide-react

# 工具
npm install clsx  # 条件类名拼接
```

## K.3 项目配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
```

```typescript
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#1a1b26',
        'dark-surface': '#24283b',
        'dark-border': '#292e42',
      },
    },
  },
  plugins: [],
}
```

## K.4 推荐的目录结构

```
my-app/
├── public/
├── src/
│   ├── components/     # UI 组件
│   ├── hooks/          # 自定义 Hooks
│   ├── store/          # Zustand store
│   ├── lib/            # 工具函数
│   ├── types/          # TypeScript 类型
│   ├── App.tsx         # 根组件
│   ├── main.tsx        # 入口
│   └── index.css       # 全局样式
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

> 📖 **附录总结**
>
> 本篇附录涵盖了 React 的核心原理（Virtual DOM、Fiber、调度）、设计模式（组合、容器/展示、自定义 Hook）、生态系统（常用库推荐）、React 18 新特性、最佳实践总结以及从零搭建项目的步骤。
>
> 结合正文八章的内容，你已经拥有了完整的 React 前端开发知识体系。接下来就是动手实践——打开 AI-CLI-Mobile 的源码，边读边写，把知识变成技能。
>
> **Remember:** The best way to learn React is to build things with React. 🔥

---

# 附录 L：React 与 Web API 深度整合

## L.1 WebSocket 在 React 中的使用

### WebSocket 基础

```mermaid
graph LR
    subgraph "HTTP vs WebSocket"
        A["HTTP"] -->|"请求-响应"| B["单向通信"]
        C["WebSocket"] -->|"全双工"| D["双向实时通信"]
    end
```

### 在 React 中管理 WebSocket

```typescript
function useWebSocket(url: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null)
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING)

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setReadyState(WebSocket.OPEN)
    ws.onmessage = (event) => setLastMessage(event)
    ws.onclose = () => setReadyState(WebSocket.CLOSED)
    ws.onerror = () => setReadyState(WebSocket.CLOSED)

    return () => {
      ws.close()
    }
  }, [url])

  const send = useCallback((data: string | ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  return { lastMessage, readyState, send }
}
```

### 项目实例：双通道 WebSocket 架构

AI-CLI-Mobile 使用两条 WebSocket 通道：

```mermaid
graph TD
    subgraph "双通道 WebSocket 架构"
        Client["浏览器客户端"]

        Client -->|"ws://host/ws/terminal"| TermWS["Terminal 通道<br/>传输终端数据（二进制）"]
        Client -->|"ws://host/ws/control"| CtrlWS["Control 通道<br/>传输控制消息（JSON）"]

        TermWS -->|"AUTH + ATTACH_SESSION"| Server1["服务端 Terminal Handler"]
        CtrlWS -->|"AUTH + INIT_SESSION"| Server2["服务端 Control Handler"]

        Server1 -->|"终端输出（二进制帧）"| TermWS
        Server2 -->|"状态更新、Token 续期"| CtrlWS
    end
```

```typescript
// apps/web/src/hooks/useDualChannelWS.ts（简化版）
export function useDualChannelWS(
  getAccessToken: () => string | null,
  getRefreshToken: () => Promise<string>,
  onAuthFailure: () => void,
) {
  const termWsRef = useRef<WebSocket | null>(null)
  const ctrlWsRef = useRef<WebSocket | null>(null)

  function connectInternal(sessionId: string, cols: number, rows: number, term: Terminal) {
    const token = getAccessToken()

    // 通道 1：终端数据
    const termWs = new WebSocket(`${WS_BASE}/ws/terminal`)
    termWs.binaryType = 'arraybuffer'
    termWsRef.current = termWs

    termWs.onopen = () => {
      // 发送认证消息
      termWs.send(JSON.stringify({
        type: 'AUTH',
        accessToken: token,
        protocolVersion: PROTOCOL_VERSION,
      }))
    }

    termWs.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data)
        if (msg.type === 'AUTH_OK') {
          // 认证成功，附加会话
          termWs.send(JSON.stringify({
            type: 'ATTACH_SESSION',
            sessionId,
          }))
          // 切换到二进制模式
          termWs.onmessage = (ev) => {
            if (ev.data instanceof ArrayBuffer) {
              term.write(new Uint8Array(ev.data))
            }
          }
          // 终端通道就绪，连接控制通道
          connectControl(token, sessionId, cols, rows)
        }
      }
    }

    // 通道 2：控制消息
    function connectControl(token: string, sessionId: string, cols: number, rows: number) {
      const ctrlWs = new WebSocket(`${WS_BASE}/ws/control`)
      ctrlWsRef.current = ctrlWs

      ctrlWs.onopen = () => {
        ctrlWs.send(JSON.stringify({
          type: 'AUTH',
          accessToken: token,
          protocolVersion: PROTOCOL_VERSION,
        }))
      }

      let authenticated = false
      ctrlWs.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (!authenticated) {
          if (msg.type === 'AUTH_OK') {
            authenticated = true
            ctrlWs.send(JSON.stringify({
              type: 'INIT_SESSION',
              sessionId, cols, rows,
              adapter: 'claude',
            }))
          }
          return
        }
        handleCtrlMessage(msg)
      }
    }
  }

  // 控制消息处理
  function handleCtrlMessage(msg: ControlServerMessage) {
    switch (msg.type) {
      case 'SESSION_READY':
        useSessionStore.getState().setConnected('CONNECTED')
        break
      case 'STATUS_UPDATE':
        useSessionStore.getState().setAgentStatus(msg.status)
        if (msg.status === 'WAITING_APPROVAL' && document.hidden) {
          sendNotification('AI CLI', '需要审批')
        }
        break
      case 'TOKEN_RENEWED':
        useSessionStore.getState().setTokens(msg.accessToken, '')
        break
    }
  }

  return { connect, disconnect, sendInput, sendResize, /* ... */ }
}
```

## L.2 Notification API

### 浏览器通知

```typescript
// apps/web/src/lib/notifications.ts
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') return
  if (Notification.permission !== 'denied') {
    await Notification.requestPermission()
  }
}

export function sendNotification(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icon.png',
      tag: 'ai-cli',
    })
  }
}
```

### 项目中的使用场景

```typescript
// 当 AI Agent 需要审批且页面在后台时，发送通知
case 'STATUS_UPDATE':
  store.getState().setAgentStatus(data.status)
  if (data.status === 'WAITING_APPROVAL' && document.hidden) {
    sendNotification('AI CLI', 'An action is waiting for your approval')
  }
  break
```

## L.3 Page Visibility API

```typescript
// 监听页面可见性变化
useEffect(() => {
  function handleVisibilityChange() {
    if (document.hidden) {
      // 页面隐藏：减少资源消耗
      // 从 DOM 移除终端实例（GPU 开销）
      if (term.element.parentNode) {
        term.element.parentNode.removeChild(term.element)
      }
    } else {
      // 页面可见：恢复资源
      // 重新挂载终端实例
      if (containerRef.current && !term.element.parentNode) {
        containerRef.current.appendChild(term.element)
        fitAddon.fit()
      }
    }
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])
```

## L.4 ResizeObserver

```typescript
// 使用 ResizeObserver 监听元素大小变化（比 window.resize 更精确）
function useResizeObserver(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!ref.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return size
}

// 使用
function TerminalContainer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { width, height } = useResizeObserver(containerRef)

  useEffect(() => {
    // 容器大小变化时重新适配终端
    fitAddon.fit()
  }, [width, height])

  return <div ref={containerRef} className="w-full h-full" />
}
```

## L.5 Intersection Observer

```typescript
// 使用 IntersectionObserver 实现懒加载和无限滚动
function useIntersectionObserver(
  ref: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, options)

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref, options])

  return isIntersecting
}

// 使用：无限滚动
function InfiniteList() {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const isAtBottom = useIntersectionObserver(sentinelRef, {
    threshold: 1.0,
  })

  useEffect(() => {
    if (isAtBottom) {
      loadMoreItems()
    }
  }, [isAtBottom])

  return (
    <div>
      {items.map(item => <Item key={item.id} item={item} />)}
      <div ref={sentinelRef} />
    </div>
  )
}
```

## L.6 AbortController

```typescript
// 项目实例：FileExplorer 中的请求取消
const fetchTree = useCallback(async (dirPath: string) => {
  // 取消上一个未完成的请求
  if (abortRef.current) {
    abortRef.current.abort()
  }
  const controller = new AbortController()
  abortRef.current = controller

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,  // 传入 signal
    })
    const data = await res.json()
    // 处理数据
  } catch (err) {
    if (controller.signal.aborted) return  // 忽略取消的请求
    // 处理其他错误
  }
}, [])

// useEffect 中的 AbortController
useEffect(() => {
  const controller = new AbortController()

  fetch(`/api/users/${userId}`, { signal: controller.signal })
    .then(res => res.json())
    .then(data => setUser(data))
    .catch(err => {
      if (err.name !== 'AbortError') setError(err)
    })

  return () => controller.abort()  // 组件卸载或 userId 变化时取消
}, [userId])
```

---

# 附录 M：React Native 与跨平台开发

## M.1 React Native 简介

React Native 让你使用 React 语法开发原生移动应用：

```mermaid
graph LR
    subgraph "React Web"
        A["React 组件"] -->|"ReactDOM"| B["HTML/CSS"]
    end

    subgraph "React Native"
        C["React 组件"] -->|"React Native"| D["原生 UI 组件"]
    end
```

## M.2 React Web vs React Native

| 特性 | React Web | React Native |
|------|-----------|-------------|
| **渲染目标** | 浏览器 DOM | 原生 UI 组件 |
| **样式** | CSS / Tailwind | StyleSheet API |
| **布局** | CSS Flexbox | Yoga（Flexbox 子集） |
| **导航** | React Router | React Navigation |
| **平台 API** | Web API | Native Modules |
| **开发工具** | 浏览器 DevTools | Flipper / React DevTools |

## M.3 共享代码策略

```mermaid
graph TD
    subgraph "代码共享策略"
        A["共享层<br/>（packages/shared）"]
        A --> B["业务逻辑"]
        A --> C["状态管理"]
        A --> D["类型定义"]
        A --> E["工具函数"]

        F["Web 层<br/>（apps/web）"]
        F --> G["Web 组件"]
        F --> H["Web 路由"]
        F --> I["Web 样式"]

        J["Mobile 层<br/>（apps/mobile）"]
        J --> K["原生组件"]
        J --> L["原生导航"]
        J --> M["原生样式"]
    end
```

---

# 附录 N：React 安全最佳实践

## N.1 XSS 防护

### React 默认防护

React 自动转义 JSX 中的内容，防止 XSS：

```typescript
// ✅ React 自动转义
function UserComment({ comment }: { comment: string }) {
  return <div>{comment}</div>
  // 如果 comment = '<script>alert("XSS")</script>'
  // 渲染结果是文字 '<script>alert("XSS")</script>'
  // 不会被执行！
}

// ⚠️ 危险：使用 dangerouslySetInnerHTML
function RawHTML({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />
  // 如果 html 来自用户输入，可能有 XSS 风险！
}
```

### 项目中的安全实践

```typescript
// apps/web/src/hooks/useDualChannelWS.ts

// 运行时消息类型校验（防御性编程）
const CONTROL_MSG_TYPES = new Set([
  'AUTH', 'AUTH_OK', 'ATTACH_SESSION', 'INIT_SESSION', 'RESIZE',
  'QUICK_ACTION', 'INJECT_CODE', 'OBSERVE_SESSION', 'PING', 'PONG',
  'STATUS_UPDATE', 'SESSION_READY', 'TOKEN_RENEWED', 'ERROR',
])

function isValidControlMsg(data: unknown): data is { type: string } {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  if (typeof obj.type !== 'string') return false
  if (!CONTROL_MSG_TYPES.has(obj.type)) return false
  return true
}

// 使用
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (!isValidControlMsg(msg)) {
    console.warn('[安全警告] 无效消息类型，已丢弃')
    return
  }
  // 处理有效消息
}
```

## N.2 Token 安全

```typescript
// apps/web/src/hooks/useAuth.ts

// 安全修复[C4]: 使用 sessionStorage 替代 localStorage
// sessionStorage 在标签页关闭后自动清除
const tokenStorage = {
  getItem(key: string) { return sessionStorage.getItem(key) },
  setItem(key: string, value: string) { sessionStorage.setItem(key, value) },
  removeItem(key: string) { sessionStorage.removeItem(key) },
}

// 未来应迁移到 httpOnly cookie + SameSite 策略
// httpOnly cookie 无法被 JavaScript 访问，防止 XSS 窃取
```

## N.3 输入验证

```typescript
// apps/web/src/store/sessionStore.ts

// 白名单校验 adapter 值
setActiveAdapter: (adapter) => {
  const VALID_ADAPTERS = new Set(['claude', 'aider', 'shell'])
  const safe = VALID_ADAPTERS.has(adapter) ? adapter : 'claude'
  set({ activeAdapter: safe })
}

// apps/web/src/hooks/useDualChannelWS.ts

// 限制注入代码大小
const MAX_INJECT_CODE_SIZE = 100 * 1024 // 100KB
const byteLength = new TextEncoder().encode(code).length
if (byteLength > MAX_INJECT_CODE_SIZE) {
  console.warn(`代码超过 ${MAX_INJECT_CODE_SIZE} 字节限制，已拒绝`)
  return
}
```

## N.4 资源限制

```typescript
// apps/web/src/store/sessionStore.ts

// 限制最大会话数量
addSession: () => {
  const MAX_SESSIONS = 10
  const { sessions } = get()
  if (sessions.length >= MAX_SESSIONS) return
  // ...
}

// apps/web/src/components/LoginForm.tsx

// 密码最小长度校验
const MIN_PASSWORD_LENGTH = 6
if (password.length < MIN_PASSWORD_LENGTH) {
  setError(`密码长度不能少于 ${MIN_PASSWORD_LENGTH} 位`)
  return
}
```

---

# 附录 O：React 性能监控

## O.1 性能指标

### Core Web Vitals

| 指标 | 缩写 | 衡量什么 | 好的阈值 |
|------|------|---------|---------|
| **Largest Contentful Paint** | LCP | 加载性能 | < 2.5 秒 |
| **First Input Delay** | FID | 交互性 | < 100 毫秒 |
| **Cumulative Layout Shift** | CLS | 视觉稳定性 | < 0.1 |

### React 特定指标

```typescript
// 使用 React Profiler 测量组件渲染时间
import { Profiler } from 'react'

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number,
) {
  console.log(`组件 ${id} 渲染耗时: ${actualDuration.toFixed(2)}ms`)
}

<Profiler id="TerminalContainer" onRender={onRenderCallback}>
  <TerminalContainer />
</Profiler>
```

## O.2 Bundle 分析

```bash
# 使用 vite-bundle-visualizer 分析打包体积
npx vite-bundle-visualizer

# 使用 source-map-explorer
npx source-map-explorer dist/assets/*.js
```

### 优化打包体积

```typescript
// 1. 懒加载大组件
const CodeEditor = lazy(() => import('./components/CodeEditor'))

// 2. 按需导入（tree shaking）
import { Terminal } from '@xterm/xterm'      // ✅ 只导入需要的
import * as xterm from '@xterm/xterm'        // ❌ 导入全部

// 3. 动态导入 polyfill
if (!window.ResizeObserver) {
  import('resize-observer-polyfill').then(module => {
    window.ResizeObserver = module.default
  })
}
```

## O.3 内存泄漏检测

### 常见内存泄漏场景

```typescript
// ❌ 泄漏 1：未清理的定时器
useEffect(() => {
  setInterval(() => { /* ... */ }, 1000)
  // 没有 return cleanup！
}, [])

// ✅ 修复
useEffect(() => {
  const timer = setInterval(() => { /* ... */ }, 1000)
  return () => clearInterval(timer)
}, [])

// ❌ 泄漏 2：未取消的网络请求
useEffect(() => {
  fetch('/api/data').then(res => res.json()).then(setData)
  // 组件卸载后，setState 仍然会被调用！
}, [])

// ✅ 修复
useEffect(() => {
  const controller = new AbortController()
  fetch('/api/data', { signal: controller.signal })
    .then(res => res.json())
    .then(setData)
    .catch(err => { if (err.name !== 'AbortError') throw err })
  return () => controller.abort()
}, [])

// ❌ 泄漏 3：未移除的事件监听
useEffect(() => {
  window.addEventListener('resize', handleResize)
  // 没有 return cleanup！
}, [])

// ✅ 修复
useEffect(() => {
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])

// ❌ 泄漏 4：未关闭的 WebSocket
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080')
  // 没有 return cleanup！
}, [])

// ✅ 修复
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080')
  return () => ws.close()
}, [])
```

### 检测工具

| 工具 | 用途 | 使用方法 |
|------|------|---------|
| **Chrome DevTools Memory** | 堆快照分析 | 拍摄快照 → 对比 → 找增长 |
| **Chrome DevTools Performance** | 内存时间线 | 录制 → 查看内存曲线 |
| **React DevTools Profiler** | 组件渲染分析 | 录制 → 查看渲染次数 |

---

# 附录 P：React 调试技巧

## P.1 React DevTools

### 组件树检查

```mermaid
graph TD
    subgraph "React DevTools 功能"
        A["Components 标签"] --> B["查看组件树"]
        A --> C["查看 Props/State"]
        A --> D["编辑 Props/State"]
        A --> E["查看 Hooks"]

        F["Profiler 标签"] --> G["录制渲染"]
        F --> H["火焰图"]
        F --> I["排名图"]
        F --> J["组件渲染次数"]
    end
```

## P.2 常用调试技巧

### 1. console.log 的高级用法

```typescript
// 条件断点
useEffect(() => {
  console.log('useEffect 执行', { sessionId, isConnected })
}, [sessionId, isConnected])

// 对象展开
console.log('Store 状态:', { ...useSessionStore.getState() })

// 分组日志
console.group('WebSocket 连接')
console.log('终端通道:', termWs.readyState)
console.log('控制通道:', ctrlWs.readyState)
console.groupEnd()
```

### 2. 断点调试

```typescript
// 在代码中插入 debugger
function handleCtrlMessage(msg: ControlServerMessage) {
  debugger  // 浏览器会在此处暂停
  switch (msg.type) {
    case 'STATUS_UPDATE':
      // ...
  }
}
```

### 3. 条件渲染调试

```typescript
// 添加调试信息
{process.env.NODE_ENV === 'development' && (
  <div className="fixed bottom-0 right-0 bg-black/80 text-white text-xs p-2 z-50 font-mono">
    <div>连接状态: {connectionPhase}</div>
    <div>会话数: {sessions.length}</div>
    <div>字号: {fontSize}</div>
  </div>
)}
```

---

> 📖 **全篇完结**
>
> 恭喜你读完了整篇 React 前端开发完全指南！从基础概念到高级原理，从项目实战到调试技巧，我们覆盖了 React 开发的方方面面。
>
> 本文所有代码示例均来自 AI-CLI-Mobile 项目的真实源码，希望你不仅学到了 React 的理论知识，更理解了如何在真实项目中应用这些知识。
>
> **下一步行动：**
> 1. 克隆 AI-CLI-Mobile 项目
> 2. 阅读 `apps/web/src/` 下的每个文件
> 3. 尝试修改组件，观察效果
> 4. 写一个新组件或新 Hook
> 5. 为项目添加新功能
>
> 编程是一门实践的手艺。**读十遍不如写一遍。** 🔥

---

# 附录 Q：React 与后端通信模式

## Q.1 REST API 通信

### fetch API 封装

```typescript
// 通用请求封装
const API_BASE = import.meta.env.VITE_API_URL || window.location.origin

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useSessionStore.getState().accessToken

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    // Token 过期，尝试刷新
    const newToken = await refreshToken()
    if (newToken) {
      // 用新 token 重试
      return apiRequest(path, options)
    }
    // 刷新失败，跳转登录
    useSessionStore.getState().reset()
    throw new Error('认证失败')
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: '请求失败' }))
    throw new Error(error.message || `HTTP ${res.status}`)
  }

  return res.json()
}

// 使用
const user = await apiRequest<User>('/api/user/profile')
const files = await apiRequest<FileEntry[]>('/api/fs/tree?path=src')
```

### 项目实例：文件浏览器的 API 调用

```typescript
// apps/web/src/components/FileExplorer.tsx
const fetchTree = useCallback(async (dirPath: string) => {
  const token = useSessionStore.getState().accessToken
  if (!token) return

  // 取消上一个请求
  if (abortRef.current) abortRef.current.abort()
  const controller = new AbortController()
  abortRef.current = controller

  setState(prev => ({ ...prev, loading: true, error: null, currentPath: dirPath }))

  try {
    const res = await fetch(
      `${API_BASE}/api/fs/tree?path=${encodeURIComponent(dirPath)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      },
    )

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(data.error || `HTTP ${res.status}`)
    }

    const data = await res.json()
    const entries: FileEntry[] = (data.entries || []).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    setState({ currentPath: dirPath, entries, loading: false, error: null })
  } catch (err) {
    if (controller.signal.aborted) return
    setState(prev => ({ ...prev, loading: false, error: (err as Error).message }))
  }
}, [])
```

## Q.2 数据缓存策略

### 服务端数据缓存

```mermaid
graph TD
    subgraph "数据缓存策略"
        A["用户操作"] --> B{"缓存中有？"}
        B -->|是| C["返回缓存数据"]
        B -->|否| D["发送请求"]
        D --> E["缓存响应"]
        E --> F["返回数据"]

        G["数据更新"] --> H["清除相关缓存"]
        H --> I["下次请求重新获取"]
    end
```

### 离线缓存（项目实现）

```typescript
// apps/web/src/lib/offlineCache.ts
export class OfflineCache {
  private sessionId: string
  private cachedScreen: string = ''
  private queuedInputs: (string | Uint8Array)[] = []

  constructor(sessionId?: string) {
    this.sessionId = sessionId || 'default'
    this.loadFromStorage()
  }

  // 缓存终端屏幕数据
  cacheScreen(data: string) {
    this.cachedScreen = data
    this.saveToStorage()
  }

  // 获取缓存的屏幕数据
  getCachedScreen(): string {
    return this.cachedScreen
  }

  // 离线时队列化输入
  queueInput(data: string | Uint8Array) {
    this.queuedInputs.push(data)
    this.saveToStorage()
  }

  // 重连后刷新队列中的输入
  flushInputs(sendFn: (data: string | Uint8Array) => void) {
    for (const input of this.queuedInputs) {
      sendFn(input)
    }
    this.queuedInputs = []
    this.saveToStorage()
  }

  hasQueuedInputs(): boolean {
    return this.queuedInputs.length > 0
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        `offline_${this.sessionId}`,
        JSON.stringify({
          screen: this.cachedScreen,
          inputs: this.queuedInputs,
        })
      )
    } catch {}
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(`offline_${this.sessionId}`)
      if (raw) {
        const data = JSON.parse(raw)
        this.cachedScreen = data.screen || ''
        this.queuedInputs = data.inputs || []
      }
    } catch {}
  }
}
```

## Q.3 错误处理模式

### 全局错误处理

```typescript
// 全局未捕获错误处理
window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的 Promise 拒绝:', event.reason)
  // 可以发送到错误监控服务
})

window.addEventListener('error', (event) => {
  console.error('未捕获的错误:', event.error)
})

// React Error Boundary 作为最后防线
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
```

### 错误分类处理

```typescript
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: 'low' | 'medium' | 'high' | 'critical',
    public recoverable: boolean = true,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

function handleError(error: unknown) {
  if (error instanceof AppError) {
    switch (error.severity) {
      case 'low':
        console.warn(error.message)
        break
      case 'medium':
        showToast(error.message, 'warning')
        break
      case 'high':
        showToast(error.message, 'error')
        break
      case 'critical':
        showToast('发生严重错误，请刷新页面', 'error')
        // 上报到监控服务
        reportError(error)
        break
    }
  } else if (error instanceof Error) {
    showToast(error.message, 'error')
  } else {
    showToast('发生未知错误', 'error')
  }
}
```

## Q.4 实时通信架构总结

```mermaid
graph TD
    subgraph "AI-CLI-Mobile 通信架构"
        Client["浏览器"]

        subgraph "HTTP 通道"
            Login["POST /api/auth/login"]
            Refresh["POST /api/auth/refresh"]
            FileTree["GET /api/fs/tree"]
            FileContent["GET /api/fs/file"]
        end

        subgraph "WebSocket 通道"
            TermWS["ws/terminal<br/>（二进制帧）"]
            CtrlWS["ws/control<br/>（JSON 消息）"]
        end

        Client --> Login
        Client --> Refresh
        Client --> FileTree
        Client --> FileContent
        Client --> TermWS
        Client --> CtrlWS

        TermWS -->|"认证 + 附加会话"| Server
        CtrlWS -->|"认证 + 初始化会话"| Server
        Server -->|"终端输出"| TermWS
        Server -->|"状态更新、Token"| CtrlWS
    end
```

| 通道 | 协议 | 数据格式 | 用途 |
|------|------|---------|------|
| **HTTP** | REST | JSON | 登录、文件操作、认证 |
| **Terminal WS** | WebSocket | 二进制帧 | 终端输入/输出 |
| **Control WS** | WebSocket | JSON | 状态同步、会话管理 |

---

> 📖 **最终总结**
>
> 这份指南从 React 基础概念到高级原理，从项目实战到调试技巧，从安全实践到性能监控，为你提供了一个完整的 React 前端开发知识体系。
>
> **全文结构：**
> - **正文 8 章**：基础概念 → Hooks → 性能优化 → 状态管理 → TypeScript → 样式方案 → 路由 → 测试
> - **附录 A-D**：API 速查、常见错误、文件结构、学习路线
> - **附录 E-Q**：术语表、核心原理、设计模式、生态系统、Web API 整合、安全、性能监控、调试、通信模式
>
> 全文共计 **~200KB**，包含 **100+ 个 Mermaid 图表**、**50+ 个对比表格**、**200+ 段代码示例**，所有代码均来自 AI-CLI-Mobile 项目真实源码。
>
> **记住：学编程最好的方式是动手。打开项目，读代码，改代码，写代码。** 🔥

---

# 附录 R：快速参考卡片

## R.1 React Hooks 一句话总结

```
useState      → 组件内部状态         → const [v, setV] = useState(init)
useEffect     → 副作用 + 生命周期    → useEffect(() => { ... return cleanup }, [deps])
useRef        → DOM 引用 / 可变值    → const ref = useRef(init); ref.current = v
useCallback   → 缓存函数引用         → const fn = useCallback(() => {}, [deps])
useMemo       → 缓存计算结果         → const val = useMemo(() => compute(), [deps])
useContext    → 读取 Context         → const val = useContext(MyContext)
useReducer    → 复杂状态逻辑         → const [s, d] = useReducer(reducer, init)
useId         → 生成唯一 ID          → const id = useId()
useTransition → 低优先级更新         → const [isPending, start] = useTransition()
useDeferred   → 延迟值更新           → const deferred = useDeferredValue(value)
```

## R.2 Zustand 快速参考

```typescript
// 创建 store
const useStore = create<State>((set, get) => ({
  count: 0,
  increment: () => set(s => ({ count: s.count + 1 })),
  reset: () => set({ count: 0 }),
}))

// 组件中使用（选择器订阅）
const count = useStore(s => s.count)

// 组件外访问
const { count } = useStore.getState()

// 带中间件
const useStore = create(
  devtools(persist((set) => ({ ... }), { name: 'key' }))
)
```

## R.3 Vitest 快速参考

```typescript
// 断言
expect(value).toBe(expected)           // 严格相等
expect(value).toEqual(expected)        // 深度相等
expect(value).toBeTruthy()             // 真值
expect(value).toBeNull()               // null
expect(array).toHaveLength(3)          // 数组长度
expect(element).toBeInTheDocument()    // DOM 中存在
expect(button).toBeDisabled()          // 禁用状态

// Mock
const fn = vi.fn()                     // 创建 mock 函数
fn.mockReturnValue(42)                 // 返回固定值
fn.mockResolvedValue(data)             // 返回 Promise
vi.spyOn(obj, 'method')               // 监视方法调用
vi.mock('./module')                    // 模拟模块
```

## R.4 Tailwind CSS 速查

```
布局:    flex grid block inline hidden
间距:    p-4 px-3 py-2 m-4 mx-auto gap-2
尺寸:    w-full h-screen w-72 h-[40px]
颜色:    text-gray-300 bg-blue-600 border-dark-border
字体:    text-sm text-xl font-medium font-mono
边框:    border rounded rounded-lg rounded-full
状态:    hover: focus: active: disabled:
响应式:  sm: md: lg: xl: 2xl:
动画:    animate-spin animate-pulse transition-colors
```

---

> 🔥 **Happy Hacking with React!**

---

## 30. React Server Components 原理

### 30.1 什么是 Server Components

React Server Components (RSC) 是 React 的一种新组件类型，它**只在服务端运行**，不会被发送到客户端。这带来了显著的性能优势。

```mermaid
graph LR
    subgraph 服务端
        A[Server Component] -->|"序列化为 RSC Payload"| B[响应]
        A -->|可直接访问| C[(数据库)]
        A -->|可直接访问| D[文件系统]
    end
    subgraph 客户端
        B -->|"渲染为 HTML"| E[浏览器]
        F[Client Component] -->|"独立 Bundle"| E
    end
```

**Server vs Client Components 对比：**

| 特性 | Server Component | Client Component |
|------|-----------------|-----------------|
| 运行环境 | 服务端 | 客户端（浏览器） |
| 可访问数据库/文件 | ✅ 是 | ❌ 否 |
| 可使用 useState/useEffect | ❌ 否 | ✅ 是 |
| 可绑定事件处理器 | ❌ 否 | ✅ 是 |
| Bundle 大小 | 不计入客户端 | 计入客户端 |
| 水合 (Hydration) | 不需要 | 需要 |

### 30.2 如何使用

```jsx
// app/page.js (默认是 Server Component)
import ClientCounter from './ClientCounter';
import { getPosts } from './api/posts';

// 这是一个 Server Component - 不能用 useState 等 Hooks
export default async function HomePage() {
  // ✅ 可以直接访问数据库
  const posts = await getPosts();

  return (
    <div>
      <h1>最新文章</h1>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.summary}</p>
        </article>
      ))}
      {/* 嵌套 Client Component */}
      <ClientCounter initialCount={0} />
    </div>
  );
}
```

```jsx
// app/ClientCounter.js (需要 'use client' 标记)
'use client';

import { useState } from 'react';

export default function ClientCounter({ initialCount }) {
  const [count, setCount] = useState(initialCount);

  return (
    <div>
      <p>计数: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+1</button>
    </div>
  );
}
```

### 30.3 RSC 的数据流

```mermaid
sequenceDiagram
    participant Browser as 浏览器
    participant Server as 服务端
    participant DB as 数据库

    Browser->>Server: 请求页面
    Server->>DB: 查询数据 (Server Component)
    DB-->>Server: 返回数据
    Server->>Server: 渲染 Server Components
    Server->>Server: 生成 RSC Payload
    Server-->>Browser: 发送 RSC Payload + HTML
    Browser->>Browser: 水合 Client Components
    Note over Browser: 页面可交互
```

### 30.4 最佳实践

```javascript
// ✅ 好的模式：Server Component 包裹 Client Component
// app/ProductPage.js (Server Component)
import db from './db';
import ProductDetails from './ProductDetails';  // Client Component
import RecommendedProducts from './RecommendedProducts';  // Server Component

export default async function ProductPage({ params }) {
  const product = await db.product.findUnique({ where: { id: params.id } });
  
  return (
    <div>
      {/* 把服务端获取的数据作为 props 传给客户端组件 */}
      <ProductDetails product={product} />
      {/* 纯服务端组件，不发送到客户端 */}
      <RecommendedProducts category={product.category} />
    </div>
  );
}
```

---

## 31. React Suspense 与并发特性

### 31.1 Suspense 基础

`Suspense` 让组件在等待异步操作时展示 fallback 内容。

```jsx
import { Suspense } from 'react';

function App() {
  return (
    <div>
      <h1>我的应用</h1>
      <Suspense fallback={<div>加载中...</div>}>
        <UserProfile />
      </Suspense>
    </div>
  );
}
```

### 31.2 配合 React.lazy 代码分割

```jsx
import { lazy, Suspense } from 'react';

// 动态导入，按需加载
const HeavyChart = lazy(() => import('./HeavyChart'));
const PDFViewer = lazy(() => import('./PDFViewer'));

function Dashboard() {
  return (
    <div>
      <h1>仪表盘</h1>
      <Suspense fallback={<div>加载图表中...</div>}>
        <HeavyChart data={chartData} />
      </Suspense>
      <Suspense fallback={<div>加载 PDF 中...</div>}>
        <PDFViewer url={pdfUrl} />
      </Suspense>
    </div>
  );
}
```

### 31.3 Suspense 数据获取

```jsx
// 使用 use() Hook（React 19+）
import { Suspense, use } from 'react';

// 假设 fetchPosts 返回一个 Promise
function PostList({ postsPromise }) {
  // use() 会暂停组件渲染直到 Promise 完成
  const posts = use(postsPromise);
  
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

function App() {
  const postsPromise = fetchPosts(); // 在组件外部调用
  
  return (
    <Suspense fallback={<div>加载文章...</div>}>
      <PostList postsPromise={postsPromise} />
    </Suspense>
  );
}
```

### 31.4 useTransition 非紧急更新

```jsx
import { useTransition, useState } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e) {
    const value = e.target.value;
    setQuery(value);  // 紧急更新：立即更新输入框
    
    // 非紧急更新：可以被中断
    startTransition(() => {
      setResults(filterResults(value));  // 搜索结果可以延迟
    });
  }

  return (
    <div>
      <input value={query} onChange={handleSearch} />
      {isPending ? (
        <div>搜索中...</div>
      ) : (
        <ResultList results={results} />
      )}
    </div>
  );
}
```

### 31.5 useDeferredValue 延迟值

```jsx
import { useDeferredValue, useState, useMemo } from 'react';

function SearchResults({ query }) {
  // 当 query 频繁变化时，deferredQuery 会延迟更新
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  // 使用 deferredQuery 进行昂贵的过滤操作
  const results = useMemo(() => {
    return filterHeavyList(deferredQuery);
  }, [deferredQuery]);

  return (
    <div style={{ opacity: isStale ? 0.7 : 1 }}>
      {results.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

**并发特性对比：**

| 特性 | 用途 | 场景 |
|------|------|------|
| `Suspense` | 声明式加载状态 | 代码分割、数据加载 |
| `useTransition` | 标记非紧急更新 | 搜索过滤、Tab 切换 |
| `useDeferredValue` | 延迟值更新 | 输入框搜索结果 |
| `lazy()` | 代码分割 | 大型组件按需加载 |

---

## 32. React 状态机模式（XState 集成）

### 32.1 为什么使用状态机

对于复杂的 UI 状态管理（如表单向导、支付流程），状态机可以让状态转换变得**可预测和可测试**。

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: SUBMIT
    Loading --> Success: RESOLVE
    Loading --> Error: REJECT
    Error --> Loading: RETRY
    Success --> [*]
    Error --> Idle: RESET
```

### 32.2 XState 基础用法

```bash
npm install xstate @xstate/react
```

```jsx
import { createMachine, assign } from 'xstate';
import { useMachine } from '@xstate/react';

// 定义状态机
const fetchMachine = createMachine({
  id: 'fetch',
  initial: 'idle',
  context: {
    data: null,
    error: null,
    retries: 0
  },
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      invoke: {
        src: 'fetchData',
        onDone: {
          target: 'success',
          actions: assign({ data: (_, event) => event.data })
        },
        onError: {
          target: 'failure',
          actions: assign({ error: (_, event) => event.data })
        }
      }
    },
    success: {
      on: { FETCH: 'loading' }  // 允许重新获取
    },
    failure: {
      on: {
        RETRY: {
          target: 'loading',
          actions: assign({ retries: (ctx) => ctx.retries + 1 })
        },
        RESET: {
          target: 'idle',
          actions: assign({ data: null, error: null, retries: 0 })
        }
      }
    }
  }
});

// 在 React 组件中使用
function DataLoader({ url }) {
  const [state, send] = useMachine(fetchMachine, {
    services: {
      fetchData: () => fetch(url).then(res => res.json())
    }
  });

  if (state.matches('idle')) {
    return <button onClick={() => send({ type: 'FETCH' })}>加载数据</button>;
  }

  if (state.matches('loading')) {
    return <div>加载中...</div>;
  }

  if (state.matches('success')) {
    return (
      <div>
        <pre>{JSON.stringify(state.context.data, null, 2)}</pre>
        <button onClick={() => send({ type: 'FETCH' })}>重新加载</button>
      </div>
    );
  }

  if (state.matches('failure')) {
    return (
      <div>
        <p>错误: {state.context.error?.message}</p>
        <button onClick={() => send({ type: 'RETRY' })}>重试</button>
        <button onClick={() => send({ type: 'RESET' })}>重置</button>
      </div>
    );
  }
}
```

### 32.3 多步骤表单状态机

```javascript
const multiStepFormMachine = createMachine({
  id: 'multiStepForm',
  initial: 'personalInfo',
  context: {
    personalInfo: {},
    address: {},
    payment: {}
  },
  states: {
    personalInfo: {
      on: {
        NEXT: {
          target: 'address',
          actions: assign({ personalInfo: (_, e) => e.data })
        }
      }
    },
    address: {
      on: {
        NEXT: {
          target: 'payment',
          actions: assign({ address: (_, e) => e.data })
        },
        BACK: 'personalInfo'
      }
    },
    payment: {
      on: {
        SUBMIT: 'submitting',
        BACK: 'address'
      }
    },
    submitting: {
      invoke: {
        src: 'submitForm',
        onDone: 'success',
        onError: 'payment'
      }
    },
    success: { type: 'final' }
  }
});
```

---

## 33. React 国际化（i18n）

### 33.1 react-intl (FormatJS)

```bash
npm install react-intl
```

```jsx
// i18n/messages.js
export const messages = {
  'zh-CN': {
    'app.title': '我的应用',
    'app.welcome': '你好, {name}!',
    'app.items.count': '{count, plural, =0 {没有项目} one {# 个项目} other {# 个项目}}',
    'app.date': '今天是 {date, date, long}',
  },
  'en': {
    'app.title': 'My App',
    'app.welcome': 'Hello, {name}!',
    'app.items.count': '{count, plural, =0 {No items} one {# item} other {# items}}',
    'app.date': 'Today is {date, date, long}',
  }
};
```

```jsx
// App.jsx
import { IntlProvider, FormattedMessage, FormattedDate, useIntl } from 'react-intl';
import { messages } from './i18n/messages';

function App() {
  const [locale, setLocale] = useState('zh-CN');

  return (
    <IntlProvider locale={locale} messages={messages[locale]}>
      <div>
        <select value={locale} onChange={e => setLocale(e.target.value)}>
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
        <h1><FormattedMessage id="app.title" /></h1>
        <p>
          <FormattedMessage id="app.welcome" values={{ name: '小明' }} />
        </p>
        <p>
          <FormattedMessage id="app.items.count" values={{ count: 5 }} />
        </p>
        <p>
          <FormattedMessage id="app.date" values={{ date: new Date() }} />
        </p>
      </div>
    </IntlProvider>
  );
}

// 在 JS 逻辑中使用
function UserProfile() {
  const intl = useIntl();
  
  const greeting = intl.formatMessage(
    { id: 'app.welcome' },
    { name: '小明' }
  );
  
  return <p>{greeting}</p>;
}
```

### 33.2 i18next

```bash
npm install i18next react-i18next
```

```javascript
// i18n/config.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': {
      translation: {
        nav: { home: '首页', about: '关于', contact: '联系我们' },
        profile: {
          title: '个人资料',
          editButton: '编辑资料',
          saveButton: '保存',
          name: '姓名',
          email: '邮箱',
        }
      }
    },
    en: {
      translation: {
        nav: { home: 'Home', about: 'About', contact: 'Contact Us' },
        profile: {
          title: 'Profile',
          editButton: 'Edit Profile',
          saveButton: 'Save',
          name: 'Name',
          email: 'Email',
        }
      }
    }
  },
  lng: 'zh-CN',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
```

```jsx
// components/Profile.jsx
import { useTranslation } from 'react-i18next';

function Profile() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1>{t('profile.title')}</h1>
      <label>{t('profile.name')}</label>
      <input type="text" />
      <label>{t('profile.email')}</label>
      <input type="email" />
      <button>{t('profile.editButton')}</button>
      
      <div>
        <button onClick={() => i18n.changeLanguage('zh-CN')}>中文</button>
        <button onClick={() => i18n.changeLanguage('en')}>English</button>
      </div>
    </div>
  );
}
```

---

## 34. React 测试进阶

### 34.1 MSW (Mock Service Worker) Mock API

MSW 通过拦截网络请求来 mock API，而不是修改 fetch/axios。

```bash
npm install -D msw
```

```javascript
// mocks/handlers.js
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock GET /api/users
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: 1, name: '张三', email: 'zhangsan@example.com' },
      { id: 2, name: '李四', email: 'lisi@example.com' },
    ]);
  }),

  // Mock GET /api/users/:id
  http.get('/api/users/:id', ({ params }) => {
    const { id } = params;
    return HttpResponse.json({
      id: Number(id),
      name: `用户${id}`,
      email: `user${id}@example.com`
    });
  }),

  // Mock POST /api/users
  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { id: 3, ...body },
      { status: 201 }
    );
  }),

  // Mock 错误响应
  http.get('/api/error', () => {
    return HttpResponse.json(
      { message: '服务器错误' },
      { status: 500 }
    );
  }),
];
```

```javascript
// mocks/server.js - 用于测试环境
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```javascript
// jest.setup.js 或测试文件中
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### 34.2 测试用户行为（而非实现细节）

使用 `@testing-library/react` 测试用户实际操作：

```jsx
// UserProfile.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import UserProfile from './UserProfile';

describe('UserProfile', () => {
  test('加载并显示用户信息', async () => {
    render(<UserProfile userId={1} />);
    
    // 等待数据加载完成
    expect(screen.getByText('加载中...')).toBeInTheDocument();
    
    // 验证显示了正确的用户信息
    await waitFor(() => {
      expect(screen.getByText('张三')).toBeInTheDocument();
      expect(screen.getByText('zhangsan@example.com')).toBeInTheDocument();
    });
  });

  test('点击编辑按钮后可以修改信息', async () => {
    const user = userEvent.setup();
    render(<UserProfile userId={1} />);
    
    // 等待加载完成
    await screen.findByText('张三');
    
    // 点击编辑按钮
    await user.click(screen.getByRole('button', { name: /编辑/i }));
    
    // 修改姓名
    const nameInput = screen.getByLabelText(/姓名/i);
    await user.clear(nameInput);
    await user.type(nameInput, '王五');
    
    // 保存
    await user.click(screen.getByRole('button', { name: /保存/i }));
    
    // 验证显示更新后的信息
    await waitFor(() => {
      expect(screen.getByText('王五')).toBeInTheDocument();
    });
  });

  test('API 错误时显示错误信息', async () => {
    // Override handler to return error
    server.use(
      http.get('/api/users/:id', () => {
        return HttpResponse.json(
          { message: '用户不存在' },
          { status: 404 }
        );
      })
    );

    render(<UserProfile userId={999} />);
    
    await waitFor(() => {
      expect(screen.getByText(/用户不存在/)).toBeInTheDocument();
    });
  });
});
```

### 34.3 测试异步操作

```jsx
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchPage from './SearchPage';

test('搜索框输入后显示结果', async () => {
  const user = userEvent.setup();
  render(<SearchPage />);
  
  const searchInput = screen.getByPlaceholderText(/搜索/i);
  
  // 输入搜索关键词
  await user.type(searchInput, 'React');
  
  // 等待搜索结果出现
  await waitFor(() => {
    expect(screen.getByText('React 入门教程')).toBeInTheDocument();
  }, { timeout: 3000 });
});

test('loading 状态正确展示', async () => {
  // 让 API 响应延迟
  server.use(
    http.get('/api/search', async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return HttpResponse.json([{ id: 1, title: '结果' }]);
    })
  );

  const user = userEvent.setup();
  render(<SearchPage />);
  
  await user.type(screen.getByPlaceholderText(/搜索/i), 'test');
  
  // 应该先显示 loading
  expect(screen.getByText('搜索中...')).toBeInTheDocument();
  
  // 然后显示结果
  await waitFor(() => {
    expect(screen.getByText('结果')).toBeInTheDocument();
  });
});
```

### 34.4 自定义渲染器

```jsx
// test-utils.jsx
import { render } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function AllProviders({ children }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="zh-CN" messages={{}}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </IntlProvider>
    </QueryClientProvider>
  );
}

function customRender(ui, options) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
```


---

## 35. React 性能优化

### 35.1 React.memo 避免不必要的重渲染

```jsx
import { memo, useMemo, useCallback } from 'react';

// React.memo：只在 props 变化时重新渲染
const ExpensiveComponent = memo(function ExpensiveComponent({ data, onClick }) {
  console.log('ExpensiveComponent 渲染了');
  
  return (
    <div>
      <h3>{data.title}</h3>
      <p>{data.description}</p>
      <button onClick={onClick}>点击</button>
    </div>
  );
});

// 自定义比较函数
const OptimizedList = memo(
  function List({ items, onItemClick }) {
    return (
      <ul>
        {items.map(item => (
          <li key={item.id} onClick={() => onItemClick(item.id)}>
            {item.name}
          </li>
        ))}
      </ul>
    );
  },
  (prevProps, nextProps) => {
    // 只在列表长度或内容变化时才重渲染
    return (
      prevProps.items.length === nextProps.items.length &&
      prevProps.items.every((item, i) => item.id === nextProps.items[i].id)
    );
  }
);
```

### 35.2 useMemo 和 useCallback

```jsx
function ProductPage({ products, categoryId }) {
  // useMemo：缓存计算结果
  const filteredProducts = useMemo(() => {
    return products.filter(p => p.categoryId === categoryId);
  }, [products, categoryId]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => a.price - b.price);
  }, [filteredProducts]);

  // useCallback：缓存函数引用
  const handleAddToCart = useCallback((productId) => {
    // 添加到购物车逻辑
    console.log(`添加产品 ${productId} 到购物车`);
  }, []);  // 空依赖 = 函数永远不会改变

  const handleSort = useCallback((sortBy) => {
    // 排序逻辑
    console.log(`按 ${sortBy} 排序`);
  }, []);

  return (
    <div>
      <SortBar onSort={handleSort} />
      <ProductList 
        products={sortedProducts} 
        onAddToCart={handleAddToCart}
      />
    </div>
  );
}
```

### 35.3 虚拟列表（Virtual List）

当渲染大量列表数据时，使用虚拟列表只渲染可视区域内的元素。

```bash
npm install react-window
```

```jsx
import { FixedSizeList } from 'react-window';

function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style} className="list-item">
      <h3>{items[index].name}</h3>
      <p>{items[index].description}</p>
    </div>
  );

  return (
    <FixedSizeList
      height={600}        // 容器高度
      width="100%"         // 容器宽度
      itemCount={items.length}
      itemSize={80}        // 每项高度
    >
      {Row}
    </FixedSizeList>
  );
}

// 不等高列表
import { VariableSizeList } from 'react-window';

function DynamicList({ items }) {
  const getItemSize = (index) => {
    // 根据内容动态计算高度
    return items[index].description.length > 100 ? 120 : 60;
  };

  return (
    <VariableSizeList
      height={600}
      itemCount={items.length}
      itemSize={getItemSize}
    >
      {({ index, style }) => (
        <div style={style}>{items[index].name}</div>
      )}
    </VariableSizeList>
  );
}
```

### 35.4 代码分割与懒加载

```jsx
import { lazy, Suspense, useState } from 'react';

// 按路由懒加载
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));

// 带重试的懒加载
function lazyWithRetry(componentImport) {
  return lazy(() =>
    componentImport().catch((error) => {
      // 如果加载失败，等待 2 秒后重试
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(componentImport());
        }, 2000);
      });
    })
  );
}

const HeavyPage = lazyWithRetry(() => import('./pages/HeavyPage'));

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Suspense>
  );
}
```

---

## 36. React 状态管理方案对比

| 方案 | 复杂度 | 适合场景 | 学习成本 |
|------|--------|---------|---------|
| **useState/useReducer** | 低 | 组件内部状态 | 低 |
| **Context API** | 低 | 主题、语言、认证状态 | 低 |
| **Zustand** | 中 | 中小型应用全局状态 | 低 |
| **Jotai** | 中 | 原子化状态管理 | 中 |
| **Redux Toolkit** | 高 | 大型复杂应用 | 高 |
| **MobX** | 中 | 响应式状态管理 | 中 |
| **TanStack Query** | 中 | 服务端状态管理 | 中 |

```jsx
// Zustand 示例 - 轻量级状态管理
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools((set, get) => ({
    // 状态
    user: null,
    cart: [],
    theme: 'light',
    
    // 操作
    setUser: (user) => set({ user }),
    addToCart: (item) => set((state) => ({
      cart: [...state.cart, item]
    })),
    removeFromCart: (itemId) => set((state) => ({
      cart: state.cart.filter(item => item.id !== itemId)
    })),
    clearCart: () => set({ cart: [] }),
    toggleTheme: () => set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light'
    })),
    
    // 计算属性（通过 get 访问当前状态）
    getCartTotal: () => {
      const { cart } = get();
      return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }
  }))
);

// 在组件中使用
function CartButton() {
  const cart = useStore((state) => state.cart);
  const addToCart = useStore((state) => state.addToCart);
  
  return (
    <button onClick={() => addToCart({ id: 1, name: '商品', price: 99, quantity: 1 })}>
      购物车 ({cart.length})
    </button>
  );
}
```


---

## 37. React 表单处理

### 37.1 受控组件 vs 非受控组件

| 特性 | 受控组件 | 非受控组件 |
|------|---------|-----------|
| 数据存储 | React state | DOM |
| 更新方式 | `onChange` 事件 | `ref` 直接访问 |
| 验证 | 实时 | 提交时 |
| 适用场景 | 复杂交互、实时验证 | 简单表单、文件上传 |

```jsx
// 受控组件
function ControlledForm() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    role: 'user'
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 实时验证
    if (name === 'email' && !/\S+@\S+\.\S+/.test(value)) {
      setErrors(prev => ({ ...prev, email: '邮箱格式不正确' }));
    } else {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Object.values(errors).some(Boolean)) return;
    console.log('提交:', formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="username">用户名</label>
        <input
          id="username"
          name="username"
          value={formData.username}
          onChange={handleChange}
          required
        />
      </div>
      <div>
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>
      <div>
        <label htmlFor="role">角色</label>
        <select name="role" value={formData.role} onChange={handleChange}>
          <option value="user">普通用户</option>
          <option value="admin">管理员</option>
        </select>
      </div>
      <button type="submit">提交</button>
    </form>
  );
}
```

### 37.2 使用 react-hook-form

```bash
npm install react-hook-form zod @hookform/resolvers
```

```jsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 定义验证 schema
const schema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符').max(20),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(8, '密码至少 8 个字符')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, '密码需包含大小写字母和数字'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: '两次密码不一致',
  path: ['confirmPassword']
});

function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid }
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onChange'  // 实时验证
  });

  const onSubmit = async (data) => {
    // data 已经过验证
    const { confirmPassword, ...submitData } = data;
    await registerUser(submitData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <input {...register('username')} placeholder="用户名" />
        {errors.username && <p className="error">{errors.username.message}</p>}
      </div>
      <div>
        <input {...register('email')} placeholder="邮箱" />
        {errors.email && <p className="error">{errors.email.message}</p>}
      </div>
      <div>
        <input {...register('password')} type="password" placeholder="密码" />
        {errors.password && <p className="error">{errors.password.message}</p>}
      </div>
      <div>
        <input {...register('confirmPassword')} type="password" placeholder="确认密码" />
        {errors.confirmPassword && <p className="error">{errors.confirmPassword.message}</p>}
      </div>
      <button type="submit" disabled={!isValid || isSubmitting}>
        {isSubmitting ? '注册中...' : '注册'}
      </button>
    </form>
  );
}
```

---

## 38. React 路由进阶

### 38.1 React Router v6 数据路由

```jsx
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useLoaderData,
  useActionData,
  Form,
  redirect,
} from 'react-router-dom';

// Loader：在路由渲染前加载数据
async function userLoader({ params }) {
  const response = await fetch(`/api/users/${params.userId}`);
  if (!response.ok) {
    throw new Response('用户未找到', { status: 404 });
  }
  return response.json();
}

// Action：处理表单提交
async function updateUserAction({ request, params }) {
  const formData = await request.formData();
  const updates = Object.fromEntries(formData);
  
  const response = await fetch(`/api/users/${params.userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });

  if (!response.ok) {
    return { error: '更新失败' };
  }
  
  return redirect(`/users/${params.userId}`);
}

// 组件
function UserProfile() {
  const user = useLoaderData();
  const actionData = useActionData();

  return (
    <div>
      <h1>{user.name}</h1>
      {actionData?.error && <p className="error">{actionData.error}</p>}
      <Form method="put">
        <input name="name" defaultValue={user.name} />
        <input name="email" defaultValue={user.email} />
        <button type="submit">保存</button>
      </Form>
    </div>
  );
}

// 路由配置
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'users/:userId',
        element: <UserProfile />,
        loader: userLoader,
        action: updateUserAction,
        errorElement: <ErrorBoundary />
      }
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />;
}
```

### 38.2 嵌套路由与布局

```jsx
// 带有嵌套布局的路由
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'dashboard',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'analytics', element: <Analytics /> },
          { path: 'settings', element: <Settings /> },
        ]
      },
      {
        path: 'admin',
        element: <AdminLayout />,
        loader: adminLoader,  // 需要管理员权限
        children: [
          { path: 'users', element: <UserManagement /> },
          { path: 'posts', element: <PostManagement /> },
        ]
      }
    ]
  }
]);

function DashboardLayout() {
  return (
    <div className="dashboard">
      <nav>
        <NavLink to="/dashboard">概览</NavLink>
        <NavLink to="/dashboard/analytics">分析</NavLink>
        <NavLink to="/dashboard/settings">设置</NavLink>
      </nav>
      <main>
        <Outlet />  {/* 子路由在这里渲染 */}
      </main>
    </div>
  );
}
```

---

## 39. React 错误处理

### 39.1 Error Boundary

```jsx
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // 上报错误
    console.error('Error Boundary 捕获:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>出错了 😥</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 使用
function App() {
  return (
    <ErrorBoundary>
      <Header />
      <Main />
      <Footer />
    </ErrorBoundary>
  );
}
```

### 39.2 React 19 错误处理增强

```jsx
// React 19 的 use() Hook 支持在渲染时处理 Promise 错误
import { Suspense, use } from 'react';

function UserProfile({ userPromise }) {
  // 如果 Promise reject，会被最近的 Error Boundary 捕获
  const user = use(userPromise);
  
  return <div>{user.name}</div>;
}

// 在 Error Boundary 内使用 Suspense
function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <UserProfile userPromise={fetchUser()} />
      </Suspense>
    </ErrorBoundary>
  );
}
```


---

## 19. React 19 新特性

React 19 是 React 的重大版本更新，引入了多项革命性特性，极大地提升了开发体验和应用性能。

### 19.1 React Compiler

React Compiler（原名 React Forget）是一个自动优化 React 应用的编译器，它能自动记忆化组件和 Hook，无需手动使用 `useMemo`、`useCallback` 和 `React.memo`。

```javascript
// React 19 之前：需要手动优化
import { useMemo, useCallback, memo } from 'react';

const ExpensiveComponent = memo(({ data, onItemClick }) => {
  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formatted: formatDate(item.date),
    }));
  }, [data]);

  const handleClick = useCallback((id) => {
    onItemClick(id);
  }, [onItemClick]);

  return (
    <ul>
      {processedData.map(item => (
        <li key={item.id} onClick={() => handleClick(item.id)}>
          {item.formatted}
        </li>
      ))}
    </ul>
  );
});

// React 19 + Compiler：自动优化，无需手动记忆化
function ExpensiveComponent({ data, onItemClick }) {
  const processedData = data.map(item => ({
    ...item,
    formatted: formatDate(item.date),
  }));

  return (
    <ul>
      {processedData.map(item => (
        <li key={item.id} onClick={() => onItemClick(item.id)}>
          {item.formatted}
        </li>
      ))}
    </ul>
  );
}
// React Compiler 自动处理了 useMemo、useCallback 和 memo 的优化

// Babel 插件配置
// babel.config.js
module.exports = {
  plugins: [
    ['babel-plugin-react-compiler', {
      // 编译器配置
    }],
  ],
};
```

### 19.2 Actions

Actions 是 React 19 引入的用于处理异步操作的新范式，简化了数据变更和状态更新。

```javascript
// 使用 useActionState 处理表单提交
import { useActionState } from 'react';

async function submitForm(previousState, formData) {
  const name = formData.get('name');
  const email = formData.get('email');

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    });

    if (!response.ok) {
      throw new Error('提交失败');
    }

    const user = await response.json();
    return { success: true, user, error: null };
  } catch (error) {
    return { success: false, user: null, error: error.message };
  }
}

function UserForm() {
  const [state, formAction, isPending] = useActionState(submitForm, {
    success: false,
    user: null,
    error: null,
  });

  return (
    <form action={formAction}>
      <input name="name" placeholder="姓名" required />
      <input name="email" type="email" placeholder="邮箱" required />

      <button type="submit" disabled={isPending}>
        {isPending ? '提交中...' : '提交'}
      </button>

      {state.error && <p className="error">{state.error}</p>}
      {state.success && <p className="success">用户 {state.user.name} 创建成功！</p>}
    </form>
  );
}

// 使用 useOptimistic 实现乐观更新
import { useOptimistic } from 'react';

function TodoList({ todos, onAddTodo }) {
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo) => [...state, { ...newTodo, pending: true }]
  );

  async function handleSubmit(formData) {
    const text = formData.get('todo');
    addOptimisticTodo({ id: Date.now(), text, completed: false });
    await onAddTodo(text);
  }

  return (
    <div>
      <form action={handleSubmit}>
        <input name="todo" placeholder="添加待办..." />
        <button type="submit">添加</button>
      </form>

      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id} style={{ opacity: todo.pending ? 0.6 : 1 }}>
            {todo.text}
            {todo.pending && <span> (保存中...)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 19.3 新 Hooks

```javascript
// use() - 在渲染时读取资源
import { use, Suspense } from 'react';

function UserProfile({ userPromise }) {
  // 直接在组件中 await Promise
  const user = use(userPromise);

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

function App() {
  const userPromise = fetch('/api/user/1').then(r => r.json());

  return (
    <Suspense fallback={<div>加载中...</div>}>
      <UserProfile userPromise={userPromise} />
    </Suspense>
  );
}

// use() 也可以读取 Context
import { createContext, use } from 'react';

const ThemeContext = createContext('light');

function ThemedButton() {
  const theme = use(ThemeContext);
  return <button className={`btn-${theme}`}>点击我</button>;
}

// useId - 生成唯一 ID
import { useId } from 'react';

function FormField({ label, type = 'text' }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} />
    </div>
  );
}

// useTransition - 低优先级更新
import { useTransition, useState } from 'react';

function SearchResults({ items }) {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSearch = (e) => {
    // 立即更新输入框
    setQuery(e.target.value);

    // 低优先级：搜索结果可以延迟更新
    startTransition(() => {
      // 这里的更新会被标记为低优先级
      filterResults(e.target.value);
    });
  };

  return (
    <div>
      <input value={query} onChange={handleSearch} />
      {isPending && <p>搜索中...</p>}
      {/* 搜索结果列表 */}
    </div>
  );
}

// useDeferredValue - 延迟更新值
import { useDeferredValue, useState } from 'react;

function App() {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <HeavyList query={deferredQuery} />
    </div>
  );
}
```

### 19.4 Server Components 改进

```javascript
// React 19 中 Server Components 的改进

// 1. 从 Client Components 导入 Server Components
// ServerComponent.jsx (服务端组件)
async function ServerComponent() {
  const data = await fetch('https://api.example.com/data');
  const json = await data.json();

  return (
    <div>
      <h2>服务端数据</h2>
      <pre>{JSON.stringify(json, null, 2)}</pre>
    </div>
  );
}

export default ServerComponent;

// ClientComponent.jsx (客户端组件)
'use client';
import { useState } from 'react';
import ServerComponent from './ServerComponent'; // ✅ React 19 支持

function ClientComponent() {
  const [show, setShow] = useState(false);

  return (
    <div>
      <button onClick={() => setShow(!show)}>切换</button>
      {show && <ServerComponent />}
    </div>
  );
}

// 2. Server Actions 改进
// actions.js
'use server';

export async function createPost(formData) {
  const title = formData.get('title');
  const content = formData.get('content');

  // 验证
  if (!title || title.length < 3) {
    return { error: '标题至少需要 3 个字符' };
  }

  // 写入数据库
  const post = await db.posts.create({ title, content });

  // 可以在 Server Action 中调用 redirect
  redirect(`/posts/${post.id}`);
}

// 在客户端组件中使用
'use client';
import { useActionState } from 'react';
import { createPost } from './actions';

function CreatePostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null);

  return (
    <form action={formAction}>
      <input name="title" placeholder="标题" />
      <textarea name="content" placeholder="内容" />
      <button disabled={isPending}>
        {isPending ? '创建中...' : '创建文章'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
```

```mermaid
graph TD
    A[React 19 架构] --> B[Server Components]
    A --> C[Client Components]
    A --> D[Server Actions]

    B --> B1[在服务端渲染]
    B --> B2[可以直接访问数据库]
    B --> B3[零客户端 JS]

    C --> C1['use client' 标记]
    C --> C2[交互性]
    C --> C3[浏览器 API]

    D --> D1['use server' 标记]
    D --> D2[表单处理]
    D --> D3[数据变更]

    B --> E[流式传输]
    C --> E
    D --> E

    E --> F[浏览器]
```

---

## 20. Next.js 14 深入

### 20.1 App Router 架构

```javascript
// app/layout.tsx - 根布局
export const metadata = {
  title: '我的应用',
  description: '使用 Next.js 14 构建',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>
        <header>
          <nav>{/* 导航栏 */}</nav>
        </header>
        <main>{children}</main>
        <footer>{/* 页脚 */}</footer>
      </body>
    </html>
  );
}

// app/page.tsx - 首页（Server Component by default）
export default async function HomePage() {
  const posts = await fetch('https://api.example.com/posts', {
    next: { revalidate: 3600 }, // ISR: 每小时重新验证
  }).then(r => r.json());

  return (
    <div>
      <h1>最新文章</h1>
      {posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.summary}</p>
        </article>
      ))}
    </div>
  );
}

// app/posts/[id]/page.tsx - 动态路由
export async function generateStaticParams() {
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());
  return posts.map(post => ({ id: post.id.toString() }));
}

export async function generateMetadata({ params }) {
  const post = await fetch(`https://api.example.com/posts/${params.id}`)
    .then(r => r.json());

  return {
    title: post.title,
    description: post.summary,
  };
}

export default async function PostPage({ params }) {
  const post = await fetch(`https://api.example.com/posts/${params.id}`, {
    cache: 'no-store', // SSR: 每次请求都重新获取
  }).then(r => r.json());

  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}

// app/posts/loading.tsx - 加载状态
export default function Loading() {
  return <div className="skeleton">加载中...</div>;
}

// app/posts/error.tsx - 错误处理
'use client';

export default function Error({ error, reset }) {
  return (
    <div>
      <h2>出错了！</h2>
      <p>{error.message}</p>
      <button onClick={reset}>重试</button>
    </div>
  );
}
```

### 20.2 Server Actions 详解

```javascript
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const PostSchema = z.object({
  title: z.string().min(3).max(100),
  content: z.string().min(10),
  tags: z.array(z.string()).optional(),
});

export async function createPost(prevState, formData) {
  // 验证输入
  const validatedFields = PostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    tags: formData.getAll('tags'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  // 写入数据库
  try {
    const post = await db.posts.create({
      data: validatedFields.data,
    });

    // 重新验证缓存
    revalidatePath('/posts');
    revalidatePath(`/posts/${post.id}`);

    // 重定向到新文章
    redirect(`/posts/${post.id}`);
  } catch (error) {
    return { message: '创建文章失败' };
  }
}

// 在客户端组件中使用
'use client';

import { useActionState } from 'react';
import { createPost } from '@/app/actions';

export function CreatePostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="title">标题</label>
        <input id="title" name="title" />
        {state?.errors?.title && (
          <p className="error">{state.errors.title[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="content">内容</label>
        <textarea id="content" name="content" />
        {state?.errors?.content && (
          <p className="error">{state.errors.content[0]}</p>
        )}
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? '发布中...' : '发布'}
      </button>

      {state?.message && <p className="error">{state.message}</p>}
    </form>
  );
}
```

### 20.3 缓存策略对比

| 策略 | 说明 | 使用场景 |
|------|------|----------|
| `cache: 'force-cache'` | 缓存直到手动失效 | 静态内容、不常变化的数据 |
| `cache: 'no-store'` | 每次请求都重新获取 | 用户特定数据、实时数据 |
| `next: { revalidate: 3600 }` | ISR，每 N 秒重新验证 | 定期更新的内容 |
| `next: { revalidate: false }` | 永久缓存 | 永不变化的数据 |
| `next: { tags: ['posts'] }` | 按标签缓存 | 需要按需失效的缓存 |

---

## 21. Remix 对比

### 21.1 嵌套路由

```javascript
// Remix 路由结构
// app/
// ├── routes/
// │   ├── _index.tsx          → /
// │   ├── posts.tsx           → /posts (布局)
// │   ├── posts._index.tsx    → /posts (列表)
// │   ├── posts.$id.tsx       → /posts/:id (详情)
// │   └── posts.new.tsx       → /posts/new (新建)

// app/routes/posts.tsx - 父路由（布局）
import { Outlet, useLoaderData } from '@remix-run/react';
import { json } from '@remix-run/node';

export async function loader() {
  const categories = await getCategories();
  return json({ categories });
}

export default function PostsLayout() {
  const { categories } = useLoaderData();

  return (
    <div className="posts-layout">
      <aside>
        <h3>分类</h3>
        <ul>
          {categories.map(cat => (
            <li key={cat.id}>{cat.name}</li>
          ))}
        </ul>
      </aside>
      <main>
        <Outlet /> {/* 子路由在这里渲染 */}
      </main>
    </div>
  );
}

// app/routes/posts._index.tsx - 子路由
import { useLoaderData, Link } from '@remix-run/react';
import { json } from '@remix-run/node';

export async function loader() {
  const posts = await getPosts();
  return json({ posts });
}

export default function PostsIndex() {
  const { posts } = useLoaderData();

  return (
    <div>
      <h2>所有文章</h2>
      {posts.map(post => (
        <article key={post.id}>
          <Link to={`/posts/${post.id}`}>
            <h3>{post.title}</h3>
          </Link>
          <p>{post.summary}</p>
        </article>
      ))}
    </div>
  );
}
```

### 21.2 数据加载模式

```javascript
// Remix 的 loader 和 action 模式

// loader: 处理 GET 请求（数据读取）
export async function loader({ params, request }) {
  const post = await getPost(params.id);
  if (!post) {
    throw new Response('文章不存在', { status: 404 });
  }

  // 可以访问 URL 参数
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || '1';

  return json({ post, page });
}

// action: 处制 POST/PUT/DELETE 请求（数据变更）
export async function action({ request, params }) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    await deletePost(params.id);
    return redirect('/posts');
  }

  if (intent === 'update') {
    const title = formData.get('title');
    const content = formData.get('content');

    const errors = {};
    if (!title || title.length < 3) {
      errors.title = '标题至少需要 3 个字符';
    }
    if (!content) {
      errors.content = '内容不能为空';
    }

    if (Object.keys(errors).length > 0) {
      return json({ errors }, { status: 400 });
    }

    await updatePost(params.id, { title, content });
    return redirect(`/posts/${params.id}`);
  }
}

// 在组件中使用
import { useLoaderData, useActionData, Form } from '@remix-run/react';

export default function EditPost() {
  const { post } = useLoaderData();
  const actionData = useActionData();

  return (
    <Form method="post">
      <input name="title" defaultValue={post.title} />
      {actionData?.errors?.title && (
        <p className="error">{actionData.errors.title}</p>
      )}

      <textarea name="content" defaultValue={post.content} />
      {actionData?.errors?.content && (
        <p className="error">{actionData.errors.content}</p>
      )}

      <button name="intent" value="update">更新</button>
      <button name="intent" value="delete">删除</button>
    </Form>
  );
}
```

### 21.3 错误处理

```javascript
// Remix 错误处理
// app/routes/posts.$id.tsx

export async function loader({ params }) {
  const post = await getPost(params.id);
  if (!post) {
    throw new Response('文章不存在', { status: 404 });
  }
  return json({ post });
}

// CatchBoundary: 处理 Response 错误
export function CatchBoundary() {
  const caught = useCatch();

  return (
    <div>
      <h2>错误 {caught.status}</h2>
      <p>{caught.data}</p>
    </div>
  );
}

// ErrorBoundary: 处理意外错误
export function ErrorBoundary({ error }) {
  return (
    <div>
      <h2>发生了意外错误</h2>
      <pre>{error.message}</pre>
    </div>
  );
}
```

### 21.4 Next.js vs Remix 架构对比

```mermaid
graph TD
    subgraph NextJS [Next.js 14]
        A1[App Router] --> B1[Server Components]
        A1 --> C1[Server Actions]
        B1 --> D1[静态生成 SSG]
        B1 --> E1[增量静态再生 ISR]
        B1 --> F1[服务端渲染 SSR]
        C1 --> G1[表单处理]
    end

    subgraph Remix [Remix]
        A2[嵌套路由] --> B2[Loader 函数]
        A2 --> C2[Action 函数]
        B2 --> D2[服务端渲染]
        C2 --> E2[表单处理]
        A2 --> F2[嵌套布局]
    end

    H[用户请求] --> NextJS
    H --> Remix
```

| 特性 | Next.js 14 | Remix |
|------|------------|-------|
| **渲染方式** | SSG + SSR + ISR | SSR 为主 |
| **数据加载** | Server Components + fetch | loader 函数 |
| **数据变更** | Server Actions | action 函数 |
| **路由** | 文件系统路由 | 文件系统路由 + 配置 |
| **嵌套布局** | 支持（layout.tsx） | 核心特性 |
| **缓存** | 强大的缓存策略 | 简单缓存 |
| **学习曲线** | 中等 | 较低 |
| **适用场景** | 内容站点、电商、SaaS | 全栈应用、表单密集型 |

---

## 22. React Native 简介

### 22.1 跨平台原理

```mermaid
graph LR
    subgraph ReactNative [React Native 架构]
        A[JavaScript 代码] --> B[Hermes/JS 引擎]
        B --> C[新架构 Bridge/JSI]
        C --> D[原生 UI 组件]
        D --> E[iOS UIKit]
        D --> F[Android View]
    end

    subgraph NewArch [新架构]
        G[JSI<br>JavaScript Interface] --> H[Fabric<br>新渲染器]
        G --> I[TurboModules<br>新原生模块]
        H --> J[Shadow Tree]
        I --> K[原生代码调用]
    end
```

### 22.2 核心组件

```javascript
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';

// 基本组件示例
function UserCard({ user }) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: user.avatar }}
        style={styles.avatar}
      />
      <View style={styles.info}>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>
    </View>
  );
}

// 列表组件
function UserList({ users, loading }) {
  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <UserCard user={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={<Text>暂无数据</Text>}
    />
  );
}

// 平台特定代码
const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  info: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#eee',
  },
});

// 表单组件
function LoginForm() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('错误', '请填写所有字段');
      return;
    }
    // 登录逻辑
  };

  return (
    <ScrollView contentContainerStyle={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="邮箱"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="密码"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>登录</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
```

### 22.3 导航系统

```javascript
// React Navigation 基本用法
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 底部标签导航
function HomeTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="首页"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="搜索"
        component={SearchScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="search" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="个人"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// 主导航栈
function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="HomeTabs"
          component={HomeTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Details"
          component={DetailsScreen}
          options={({ route }) => ({
            title: route.params?.title || '详情',
          })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// 导航使用
function HomeScreen({ navigation }) {
  return (
    <View>
      <Button
        title="查看详情"
        onPress={() => navigation.navigate('Details', {
          id: '1',
          title: '文章标题',
        })}
      />
      <Button
        title="打开设置"
        onPress={() => navigation.navigate('Settings')}
      />
    </View>
  );
}
```

### 22.4 状态管理与数据获取

```javascript
// React Native 中的数据获取
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        {/* 导航配置 */}
      </NavigationContainer>
    </QueryClientProvider>
  );
}

// 自定义 Hook：获取用户数据
function useUser(userId) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const response = await fetch(`https://api.example.com/users/${userId}`);
      if (!response.ok) throw new Error('获取用户失败');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 分钟
  });
}

// 在组件中使用
function UserProfile({ userId }) {
  const { data: user, isLoading, error } = useUser(userId);

  if (isLoading) return <ActivityIndicator />;
  if (error) return <Text>错误: {error.message}</Text>;

  return (
    <View>
      <Text>{user.name}</Text>
      <Text>{user.email}</Text>
    </View>
  );
}
```

---

## 23. 综合实战：全栈应用架构

```mermaid
graph TB
    subgraph Frontend [前端 - Next.js 14]
        A[App Router] --> B[Server Components]
        A --> C[Client Components]
        B --> D[Server Actions]
        C --> E[React Query]
    end

    subgraph Backend [后端 - API]
        F[REST API] --> G[数据库]
        H[GraphQL] --> G
        I[Server Actions] --> G
    end

    subgraph Mobile [移动端 - React Native]
        J[导航] --> K[屏幕]
        K --> L[组件]
        L --> M[状态管理]
    end

    subgraph Shared [共享代码]
        N[TypeScript 类型]
        O[工具函数]
        P[验证逻辑]
    end

    Frontend --> Backend
    Mobile --> Backend
    Shared --> Frontend
    Shared --> Mobile
```

```typescript
// 共享类型定义
// packages/shared/types/index.ts

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author: User;
  tags: string[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

// 共享验证逻辑
// packages/shared/validations/index.ts
import { z } from 'zod';

export const PostSchema = z.object({
  title: z.string().min(3).max(100),
  content: z.string().min(10),
  tags: z.array(z.string()).max(5),
  published: z.boolean().default(false),
});

export type CreatePostInput = z.infer<typeof PostSchema>;
```

```javascript
// Next.js 中使用共享类型
// app/posts/create/page.tsx
import { CreatePostInput, PostSchema } from '@shared/validations';
import { createPost } from './actions';

export default function CreatePostPage() {
  return <CreatePostForm />;
}

// React Native 中使用相同的类型和验证
// screens/CreatePost.tsx
import { CreatePostInput, PostSchema } from '@shared/validations';
import { createPost } from '../api/posts';

export default function CreatePostScreen() {
  // 使用相同的验证逻辑
}
```

---

## 24. React 性能优化进阶

### 24.1 渲染优化策略

```javascript
// 1. 避免不必要的重渲染
import { memo, useMemo, useCallback, useRef } from 'react';

// ✅ 使用 memo 避免父组件更新导致子组件重渲染
const ExpensiveList = memo(function ExpensiveList({ items, onItemClick }) {
  console.log('ExpensiveList 重渲染');
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => onItemClick(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
});

// 2. 使用 useMemo 缓存计算结果
function Dashboard({ data, filters }) {
  // ✅ 只在 data 或 filters 变化时重新计算
  const filteredData = useMemo(() => {
    return data.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        return item[key] === value;
      });
    });
  }, [data, filters]);

  const statistics = useMemo(() => {
    return {
      total: filteredData.length,
      sum: filteredData.reduce((acc, item) => acc + item.value, 0),
      avg: filteredData.length > 0
        ? filteredData.reduce((acc, item) => acc + item.value, 0) / filteredData.length
        : 0,
    };
  }, [filteredData]);

  return (
    <div>
      <Stats data={statistics} />
      <DataGrid data={filteredData} />
    </div>
  );
}

// 3. 使用 useCallback 缓存回调函数
function TodoApp() {
  const [todos, setTodos] = useState([]);

  // ✅ useCallback 确保函数引用稳定
  const handleToggle = useCallback((id) => {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    ));
  }, []);

  const handleDelete = useCallback((id) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, []);

  // ❌ 这样会导致 TodoItem 每次都重渲染
  // const handleToggleBad = (id) => {
  //   setTodos(todos.map(todo => ...));
  // };

  return (
    <ul>
      {todos.map(todo => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      ))}
    </ul>
  );
}

const TodoItem = memo(function TodoItem({ todo, onToggle, onDelete }) {
  console.log(`TodoItem ${todo.id} 重渲染`);
  return (
    <li>
      <input
        type="checkbox"
        checked={todo.done}
        onChange={() => onToggle(todo.id)}
      />
      <span>{todo.text}</span>
      <button onClick={() => onDelete(todo.id)}>删除</button>
    </li>
  );
});
```

### 24.2 虚拟化长列表

```javascript
// 使用 react-window 实现虚拟滚动
import { FixedSizeList, VariableSizeList } from 'react-window';

// 固定高度列表
function VirtualizedList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style} className="list-row">
      <span>{items[index].name}</span>
      <span>{items[index].value}</span>
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      width="100%"
      itemCount={items.length}
      itemSize={50}
      overscanCount={5}
    >
      {Row}
    </FixedSizeList>
  );
}

// 可变高度列表
function VariableHeightList({ items }) {
  const listRef = useRef(null);

  const getItemSize = (index) => {
    // 根据内容动态计算高度
    return items[index].expanded ? 120 : 50;
  };

  const Row = ({ index, style }) => (
    <div style={style}>
      <div className="item-header">{items[index].title}</div>
      {items[index].expanded && (
        <div className="item-detail">{items[index].detail}</div>
      )}
    </div>
  );

  return (
    <VariableSizeList
      ref={listRef}
      height={600}
      width="100%"
      itemCount={items.length}
      itemSize={getItemSize}
    >
      {Row}
    </VariableSizeList>
  );
}

// 自定义虚拟滚动 Hook
function useVirtualScroll({ itemCount, itemHeight, containerHeight }) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, itemCount);
  const offsetY = startIndex * itemHeight;

  const visibleItems = Array.from(
    { length: endIndex - startIndex },
    (_, i) => startIndex + i
  );

  return {
    visibleItems,
    offsetY,
    totalHeight: itemCount * itemHeight,
    onScroll: (e) => setScrollTop(e.currentTarget.scrollTop),
  };
}
```

### 24.3 代码分割与懒加载

```javascript
import { lazy, Suspense } from 'react';

// 路由级别的代码分割
const HomePage = lazy(() => import('./pages/Home'));
const AboutPage = lazy(() => import('./pages/About'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const SettingsPage = lazy(() => import('./pages/Settings'));

// 带预加载的懒加载
function createLazyComponent(importFn) {
  const Component = lazy(importFn);
  Component.preload = importFn;
  return Component;
}

const HeavyChart = createLazyComponent(() => import('./components/HeavyChart'));

function App() {
  // 在鼠标悬停时预加载
  const handleMouseEnter = () => {
    HeavyChart.preload();
  };

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      <div onMouseEnter={handleMouseEnter}>
        <HeavyChart />
      </div>
    </Suspense>
  );
}

// 条件加载组件
function ConditionalHeavyComponent({ showAnalytics }) {
  const AnalyticsPanel = useMemo(
    () => lazy(() => import('./components/AnalyticsPanel')),
    []
  );

  if (!showAnalytics) return null;

  return (
    <Suspense fallback={<div>加载分析面板...</div>}>
      <AnalyticsPanel />
    </Suspense>
  );
}
```

### 24.4 状态管理优化

```javascript
// 使用 Zustand 避免不必要的重渲染
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const useStore = create(
  subscribeWithSelector((set, get) => ({
    // 用户状态
    user: null,
    setUser: (user) => set({ user }),

    // 主题状态
    theme: 'light',
    toggleTheme: () => set((state) => ({
      theme: state.theme === 'light' ? 'dark' : 'light',
    })),

    // 待办事项
    todos: [],
    addTodo: (text) => set((state) => ({
      todos: [...state.todos, { id: Date.now(), text, done: false }],
    })),
    toggleTodo: (id) => set((state) => ({
      todos: state.todos.map(todo =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      ),
    })),

    // 派生状态（计算属性）
    get completedCount() {
      return get().todos.filter(t => t.done).length;
    },
  }))
);

// ✅ 只订阅需要的状态，避免不必要的重渲染
function TodoCount() {
  const count = useStore((state) => state.todos.length);
  return <span>总数: {count}</span>;
}

function CompletedCount() {
  const count = useStore((state) => state.todos.filter(t => t.done).length);
  return <span>已完成: {count}</span>;
}

// ❌ 这样会导致任何状态变化都重渲染
// function BadComponent() {
//   const state = useStore(); // 订阅整个 store
//   return <span>{state.todos.length}</span>;
// }
```

---

## 25. React 测试进阶

### 25.1 组件测试模式

```javascript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

// Mock Service Worker 设置
const server = setupServer(
  rest.get('/api/users', (req, res, ctx) => {
    return res(
      ctx.json([
        { id: 1, name: '小明' },
        { id: 2, name: '小红' },
      ])
    );
  }),

  rest.post('/api/users', async (req, res, ctx) => {
    const body = await req.json();
    return res(ctx.json({ id: 3, ...body }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 测试异步组件
describe('UserList', () => {
  it('应该加载并显示用户列表', async () => {
    render(<UserList />);

    // 等待加载完成
    expect(screen.getByText('加载中...')).toBeInTheDocument();

    // 等待数据出现
    await waitFor(() => {
      expect(screen.getByText('小明')).toBeInTheDocument();
      expect(screen.getByText('小红')).toBeInTheDocument();
    });
  });

  it('应该处理加载错误', async () => {
    server.use(
      rest.get('/api/users', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    render(<UserList />);

    await waitFor(() => {
      expect(screen.getByText(/错误/)).toBeInTheDocument();
    });
  });
});

// 测试表单交互
describe('UserForm', () => {
  it('应该验证必填字段', async () => {
    const user = userEvent.setup();
    render(<UserForm />);

    // 点击提交（不填任何内容）
    await user.click(screen.getByRole('button', { name: /提交/ }));

    expect(screen.getByText('名称不能为空')).toBeInTheDocument();
    expect(screen.getByText('邮箱不能为空')).toBeInTheDocument();
  });

  it('应该成功提交表单', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<UserForm onSubmit={onSubmit} />);

    // 填写表单
    await user.type(screen.getByLabelText('名称'), '测试用户');
    await user.type(screen.getByLabelText('邮箱'), 'test@example.com');

    // 提交
    await user.click(screen.getByRole('button', { name: /提交/ }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: '测试用户',
        email: 'test@example.com',
      });
    });
  });
});

// 快照测试
describe('Button 快照', () => {
  it('应该匹配快照', () => {
    const { container } = render(<Button variant="primary">点击</Button>);
    expect(container).toMatchSnapshot();
  });
});
```

### 25.2 Hook 测试

```javascript
import { renderHook, act } from '@testing-library/react';

// 测试自定义 Hook
describe('useCounter', () => {
  it('应该初始化计数器', () => {
    const { result } = renderHook(() => useCounter(0));

    expect(result.current.count).toBe(0);
  });

  it('应该增加计数', () => {
    const { result } = renderHook(() => useCounter(0));

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });

  it('应该减少计数', () => {
    const { result } = renderHook(() => useCounter(5));

    act(() => {
      result.current.decrement();
    });

    expect(result.current.count).toBe(4);
  });
});

// 测试异步 Hook
describe('useFetch', () => {
  it('应该获取数据', async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useFetch('/api/data')
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeDefined();
  });
});
```
