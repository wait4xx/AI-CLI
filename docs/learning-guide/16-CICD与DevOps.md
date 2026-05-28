# AI-CLI-Mobile 学习指南第十六篇：CI/CD 与 DevOps

> 📖 本篇是学习指南的第十六篇，面向初学者全面讲解 CI/CD 与 DevOps 的核心概念、工具链和最佳实践。
> 我们将结合 AI-CLI-Mobile 项目的实际配置，深入剖析 GitHub Actions、代码质量工具、Git Hooks、
> 语义化版本、部署策略等关键知识点，让你从零理解现代软件工程的交付流程。

---

## 目录

- [第一章：CI/CD 概念与价值](#第一章cicd-概念与价值)
- [第二章：GitHub Actions 配置详解](#第二章github-actions-配置详解)
- [第三章：GitLab CI 对比](#第三章gitlab-ci-对比)
- [第四章：Jenkins 对比分析](#第四章jenkins-对比分析)
- [第五章：自动化测试集成](#第五章自动化测试集成)
- [第六章：代码质量工具链](#第六章代码质量工具链)
- [第七章：Git Hooks 与 Husky](#第七章git-hooks-与-husky)
- [第八章：lint-staged 工作流](#第八章lint-staged-工作流)
- [第九章：Conventional Commits 规范](#第九章conventional-commits-规范)
- [第十章：语义化版本号（SemVer）](#第十章语义化版本号semver)
- [第十一章：环境管理（dev/staging/prod）](#第十一章环境管理devstagingprod)
- [第十二章：部署策略](#第十二章部署策略)
- [第十三章：Turborepo 构建编排分析](#第十三章turborepo-构建编排分析)
- [第十四章：DevOps 文化与实践](#第十四章devops-文化与实践)

---

# 第一章：CI/CD 概念与价值

## 1.1 什么是 CI/CD？

CI/CD 是现代软件开发中最核心的工程实践之一。它是三个缩写的组合：

| 缩写 | 全称 | 中文含义 | 核心思想 |
|------|------|---------|---------|
| **CI** | Continuous Integration | 持续集成 | 频繁地将代码合并到主分支，每次合并都自动验证 |
| **CD** | Continuous Delivery | 持续交付 | 确保代码随时可以部署到生产环境 |
| **CD** | Continuous Deployment | 持续部署 | 代码通过所有测试后自动部署到生产环境 |

> 💡 **初学者理解**：想象你和朋友一起写一本书。如果每个人写完一章才汇总一次，最后合并时肯定会冲突。
> CI 就是要求大家每天（甚至每小时）把自己写的部分合并到一起，并且每次合并都检查有没有错别字和逻辑错误。
> CD 则是确保这本书随时可以印刷出版。

### CI 与 CD 的区别

```
┌─────────────────────────────────────────────────────────────────┐
│                      CI/CD 流程对比                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  仅 CI：                                                       │
│  代码提交 → 自动构建 → 自动测试 → ✅ 合并（手动部署）             │
│                                                                 │
│  CI + 持续交付：                                                │
│  代码提交 → 自动构建 → 自动测试 → ✅ 自动准备部署 → 手动发布      │
│                                                                 │
│  CI + 持续部署：                                                │
│  代码提交 → 自动构建 → 自动测试 → ✅ 自动部署到生产               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 为什么需要 CI/CD？

### 没有 CI/CD 的痛苦

想象一个没有 CI/CD 的团队日常：

| 场景 | 痛苦描述 | CI/CD 如何解决 |
|------|---------|---------------|
| 合并代码 | "我本地跑得好好的啊！" 每次合并都是一场灾难 | 每次提交都自动测试，问题早发现 |
| 部署上线 | 手动 SSH 到服务器，手动拉代码，手动重启 | 一键部署或自动部署 |
| 回滚版本 | "上个版本是什么来着？" 手动找 Git tag | 自动回滚到上一个健康版本 |
| 代码风格 | 每个人的代码风格都不一样，Code Review 浪费时间 | 自动格式化 + 静态检查 |
| 环境差异 | "在我电脑上能跑啊" | Docker 统一环境 |
| 发布恐惧 | 不敢发布，怕出 Bug | 小批量频繁发布，出问题影响小 |

### CI/CD 的核心价值

```mermaid
graph TD
    A["传统发布方式"] --> B["攒几周的代码"]
    B --> C["手动合并"]
    C --> D["大量冲突"]
    D --> E["手动测试"]
    E --> F["遗漏 Bug"]
    F --> G["生产环境崩溃"]
    G --> H["紧急修复"]
    H --> A

    I["CI/CD 方式"] --> J["每天多次提交"]
    J --> K["自动合并+测试"]
    K --> L["即时发现冲突"]
    L --> M["自动全面测试"]
    M --> N["Bug 无处藏身"]
    N --> O["一键部署"]
    O --> P["快速反馈"]
    P --> I

    style A fill:#f66,stroke:#333,color:#fff
    style G fill:#f66,stroke:#333,color:#fff
    style I fill:#6c6,stroke:#333,color:#fff
    style O fill:#6c6,stroke:#333,color:#fff
```

## 1.3 CI/CD 流水线全景图

一个完整的 CI/CD 流水线长什么样？以下是我们 AI-CLI-Mobile 项目的流水线全景：

```mermaid
flowchart LR
    subgraph 开发阶段
        A["开发者写代码"] --> B["git commit"]
        B --> C["Git Hooks 触发"]
        C --> D["lint-staged\n代码检查"]
        D --> E["commitlint\n提交规范检查"]
    end

    subgraph CI 阶段["CI 阶段（GitHub Actions）"]
        F["代码推送到 GitHub"] --> G["安装依赖"]
        G --> H["ESLint 代码检查"]
        H --> I["TypeScript 类型检查"]
        I --> J["单元测试"]
        J --> K["构建验证"]
        K --> L["Docker 镜像构建"]
    end

    subgraph CD 阶段
        M["测试全部通过"] --> N["构建 Docker 镜像"]
        N --> O["推送到 GHCR"]
        O --> P["部署到服务器"]
        P --> Q["健康检查"]
        Q --> R["流量切换"]
    end

    E --> F
    L --> M

    style A fill:#4CAF50,stroke:#333,color:#fff
    style F fill:#2196F3,stroke:#333,color:#fff
    style M fill:#FF9800,stroke:#333,color:#fff
    style R fill:#9C27B0,stroke:#333,color:#fff
```

## 1.4 CI/CD 的核心原则

| 原则 | 说明 | 实践示例 |
|------|------|---------|
| **快速反馈** | 代码提交后几分钟内知道结果 | GitHub Actions 通常 3-5 分钟完成 |
| **自动化一切** | 能自动化的都自动化 | lint、test、build、deploy 全自动 |
| **小批量交付** | 频繁提交小改动，而非攒大改动 | 每天多次提交，每次只改一小块 |
| **环境一致性** | 开发、测试、生产环境尽可能一样 | Docker 容器化 |
| **可重复性** | 同样的代码总是产生同样的结果 | 锁定依赖版本（pnpm-lock.yaml） |
| **可追溯性** | 每次部署都能追溯到具体代码 | Git commit hash 标记镜像 |
| **快速回滚** | 出问题能秒级回滚 | Docker tag 切换 |

## 1.5 CI/CD 工具生态概览

```mermaid
graph TB
    subgraph 代码托管平台
        GH["GitHub Actions"]
        GL["GitLab CI/CD"]
        BB["Bitbucket Pipelines"]
    end

    subgraph 独立CI工具
        JK["Jenkins"]
        CK["CircleCI"]
        TC["TeamCity"]
        TK["Travis CI"]
    end

    subgraph 云原生CI
        AC["ArgoCD"]
        FK["Flux CD"]
        SW["Spinnaker"]
    end

    subgraph 辅助工具
        DK["Docker"]
        K8["Kubernetes"]
        HM["Helm"]
        TF["Terraform"]
    end

    GH --> DK
    GL --> DK
    JK --> DK
    DK --> K8
    K8 --> AC

    style GH fill:#2088FF,stroke:#333,color:#fff
    style GL fill:#FC6D26,stroke:#333,color:#fff
    style JK fill:#D33833,stroke:#333,color:#fff
```

---

# 第二章：GitHub Actions 配置详解

## 2.1 GitHub Actions 是什么？

GitHub Actions 是 GitHub 内置的 CI/CD 平台。它让你可以直接在 GitHub 仓库中定义自动化工作流，
无需配置外部服务器。每当代码被推送、PR 被创建、或打 Tag 时，工作流会自动运行。

### 核心概念

| 概念 | 英文 | 说明 | 类比 |
|------|------|------|------|
| **工作流** | Workflow | 一个完整的自动化流程文件 | 一份菜谱 |
| **事件** | Event | 触发工作流的条件（push、PR等） | 按下开始按钮 |
| **作业** | Job | 工作流中的一组步骤，可以并行 | 一个厨师的任务 |
| **步骤** | Step | 作业中的单个操作 | 菜谱中的一步 |
| **动作** | Action | 可复用的步骤（别人写好的） | 预制调料包 |
| **运行器** | Runner | 执行工作流的服务器 | 厨房 |

### 工作流结构图

```mermaid
graph TD
    WF["📄 Workflow 文件\n(.github/workflows/ci.yml)"] --> E["🎯 触发事件\n(push/PR/tag)"]
    WF --> JOB1["📋 Job 1: lint-and-test"]
    WF --> JOB2["📋 Job 2: docker-build-check"]
    WF --> JOB3["📋 Job 3: build-and-push"]

    JOB1 --> S1["Step 1: checkout"]
    JOB1 --> S2["Step 2: setup pnpm"]
    JOB1 --> S3["Step 3: setup node"]
    JOB1 --> S4["Step 4: install deps"]
    JOB1 --> S5["Step 5: security audit"]
    JOB1 --> S6["Step 6: lint"]
    JOB1 --> S7["Step 7: type check"]
    JOB1 --> S8["Step 8: test"]

    E -.->|触发| JOB1
    JOB1 -.->|needs| JOB2
    JOB1 -.->|needs| JOB3

    style WF fill:#f9f,stroke:#333,color:#333
    style JOB1 fill:#4CAF50,stroke:#333,color:#fff
    style JOB2 fill:#FF9800,stroke:#333,color:#fff
    style JOB3 fill:#2196F3,stroke:#333,color:#fff
```

## 2.2 AI-CLI-Mobile 的 CI 配置逐行解析

让我们逐行分析项目的真实 CI 配置文件：

```yaml
# .github/workflows/ci.yml

# ============================================================
# 工作流名称 —— 显示在 GitHub Actions 页面的标签名
# ============================================================
name: CI

# ============================================================
# 触发条件 —— 什么时候运行这个工作流
# ============================================================
on:
  # 当代码推送到 main 分支时触发
  push:
    branches: [main]
    # 当推送以 v 开头的 tag 时也触发（如 v1.0.0）
    tags: ['v*']
  # 当有人创建 PR 并目标是 main 分支时触发
  pull_request:
    branches: [main]
```

> 💡 **初学者理解**：
> - `push` 到 `main` = 代码合并到主分支了，需要验证
> - `tags: ['v*']` = 打版本标签了，需要构建发布版本
> - `pull_request` = 有人提交了 PR，需要在合并前验证

### 触发事件详解

```mermaid
flowchart TD
    A["开发者操作"] --> B{什么操作?}
    B -->|"git push origin main"| C["push 事件\nbranches: [main]"]
    B -->|"git tag v1.0.0\ngit push --tags"| D["push 事件\ntags: ['v*']"]
    B -->|"创建/更新 PR\n目标: main"| E["pull_request 事件\nbranches: [main]"]

    C --> F["运行 lint-and-test\n运行 build-and-push"]
    D --> F
    E --> G["运行 lint-and-test\n运行 docker-build-check"]

    style C fill:#4CAF50,stroke:#333,color:#fff
    style D fill:#FF9800,stroke:#333,color:#fff
    style E fill:#2196F3,stroke:#333,color:#fff
```

### 第一个 Job：lint-and-test

```yaml
jobs:
  # ============================================================
  # Job 1: 代码检查和测试
  # 这是所有后续 Job 的前置条件
  # ============================================================
  lint-and-test:
    # 运行环境：GitHub 提供的最新 Ubuntu 虚拟机
    runs-on: ubuntu-latest

    steps:
      # ---- Step 1: 检出代码 ----
      # actions/checkout 是官方提供的 Action
      # 它会把仓库代码下载到运行器上
      - uses: actions/checkout@v4

      # ---- Step 2: 安装 pnpm 包管理器 ----
      # 项目使用 pnpm 8.15.4，需要先安装
      - uses: pnpm/action-setup@v2
        with:
          version: 8.15.4

      # ---- Step 3: 设置 Node.js 环境 ----
      # 指定 Node.js 20 版本
      # cache: 'pnpm' 会缓存 pnpm 的全局存储，加速后续安装
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      # ---- Step 4: 安装项目依赖 ----
      # --frozen-lockfile 确保严格按照 lock 文件安装
      # 如果 lock 文件过时，直接报错（防止依赖漂移）
      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # ---- Step 5: 检查环境变量示例文件 ----
      # 确保 .env.example 存在（新开发者能知道需要哪些环境变量）
      - name: Check .env.example
        run: test -f .env.example && echo "✓ .env.example exists"

      # ---- Step 6: 安全审计 ----
      # 检查依赖中是否有已知的安全漏洞
      # continue-on-error: true 表示即使有漏洞也不阻断流水线
      - name: Security audit
        run: pnpm audit --audit-level moderate
        continue-on-error: true

      # ---- Step 7: ESLint 代码检查 ----
      - name: Lint
        run: pnpm lint

      # ---- Step 8: TypeScript 类型检查 ----
      # turbo run build 会触发所有包的构建，包括类型检查
      - name: Type check
        run: pnpm build

      # ---- Step 9: 前端单独 lint ----
      # --filter web 只对 web 应用执行
      - name: Frontend lint
        run: pnpm --filter web lint

      # ---- Step 10: 前端类型检查 ----
      # tsc --noEmit 只检查类型，不输出编译文件
      - name: Frontend type check
        run: pnpm --filter web exec tsc --noEmit

      # ---- Step 11: 运行测试 ----
      - name: Test
        run: pnpm test

      # ---- Step 12: 测试覆盖率检查 ----
      - name: Test coverage check
        run: pnpm --filter server exec vitest run --coverage
        continue-on-error: true

      # ---- Step 13: 共享包类型检查 ----
      - name: Shared package type check
        run: pnpm --filter shared exec tsc --noEmit
```

### 执行流程图

```mermaid
flowchart TD
    A["actions/checkout@v4\n检出代码"] --> B["pnpm/action-setup@v2\n安装 pnpm"]
    B --> C["actions/setup-node@v4\n设置 Node.js"]
    C --> D["pnpm install --frozen-lockfile\n安装依赖"]
    D --> E["check .env.example\n检查环境变量文件"]
    E --> F["pnpm audit\n安全审计 ⚠️"]
    F --> G["pnpm lint\nESLint 检查"]
    G --> H["pnpm build\nTypeScript 类型检查"]
    H --> I["pnpm --filter web lint\n前端 lint"]
    I --> J["tsc --noEmit\n前端类型检查"]
    J --> K["pnpm test\n运行测试"]
    K --> L["vitest --coverage\n覆盖率检查 ⚠️"]
    L --> M["pnpm --filter shared exec tsc\n共享包类型检查"]

    F -.->|"continue-on-error"| G
    L -.->|"continue-on-error"| M

    style A fill:#e1f5fe,stroke:#333
    style G fill:#fff3e0,stroke:#333
    style K fill:#e8f5e9,stroke:#333
    style F fill:#fff9c4,stroke:#333
```

### 第二个 Job：Docker 构建检查

```yaml
  # ============================================================
  # Job 2: Docker 镜像构建验证（仅 PR 时运行）
  # ============================================================
  docker-build-check:
    runs-on: ubuntu-latest
    # needs 表示依赖 lint-and-test，必须先通过
    needs: lint-and-test
    # 只在 Pull Request 时运行（主分支推送不运行）
    if: github.event_name == 'pull_request'

    steps:
      - uses: actions/checkout@v4

      # 设置 Docker Buildx（高级构建工具，支持缓存等）
      - uses: docker/setup-buildx-action@v3

      # 试构建 Docker 镜像，但不推送
      # push: false = 只构建，验证 Dockerfile 语法正确
      - name: Build Docker image (dry-run)
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          push: false
          cache-from: type=gha
          tags: ai-cli-mobile:test
```

> 💡 **为什么 PR 时只验证构建，不推送？**
> 因为 PR 的代码还没有被审查和合并，不能推送到镜像仓库。
> 这就像"试做一道新菜"——先尝尝味道对不对，确认好了再上桌。

### 第三个 Job：构建并推送镜像

```yaml
  # ============================================================
  # Job 3: 构建并推送 Docker 镜像
  # 仅在 main 分支推送或版本 tag 时运行
  # ============================================================
  build-and-push:
    needs: lint-and-test
    # 条件：main 分支推送 或 版本 tag
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    # GitHub Token 权限声明
    permissions:
      contents: read    # 读取仓库代码
      packages: write   # 推送 Docker 镜像

    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3

      # 登录 GitHub Container Registry (GHCR)
      # GHCR 是 GitHub 提供的 Docker 镜像仓库
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # 构建并推送镜像
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          push: true
          # 多标签策略：
          tags: |
            ghcr.io/${{ github.repository }}:latest
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ${{ startsWith(github.ref, 'refs/tags/v') && format('ghcr.io/{0}:{1}', github.repository, github.ref_name) || '' }}
          # 使用 GitHub Actions 缓存加速构建
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 镜像标签策略解析

| 标签 | 何时生成 | 用途 | 示例 |
|------|---------|------|------|
| `latest` | 每次 main 推送 | 最新版本，方便拉取 | `ghcr.io/user/repo:latest` |
| `commit SHA` | 每次 main 推送 | 精确追溯到某次提交 | `ghcr.io/user/repo:abc1234` |
| `版本号` | 打 v 开头的 tag | 正式发布版本 | `ghcr.io/user/repo:v1.0.0` |

```mermaid
flowchart LR
    subgraph Job关系图
        A["lint-and-test"] -->|"PR 时"| B["docker-build-check\n(只构建不推送)"]
        A -->|"main/tag 时"| C["build-and-push\n(构建+推送)"]
    end

    C --> D["GHCR 镜像仓库"]
    D --> E["latest 标签"]
    D --> F["SHA 标签"]
    D --> G["版本号标签\n(仅 tag 时)"]

    style A fill:#4CAF50,stroke:#333,color:#fff
    style B fill:#FF9800,stroke:#333,color:#fff
    style C fill:#2196F3,stroke:#333,color:#fff
```

## 2.3 GitHub Actions 常用语法速查表

### 环境变量和 Secrets

```yaml
# 定义环境变量
env:
  NODE_VERSION: 20
  PNPM_VERSION: 8.15.4

# 使用环境变量
- name: Use env
  run: echo "Node version is ${{ env.NODE_VERSION }}"

# 使用 Secrets（在仓库 Settings > Secrets 中配置）
- name: Deploy
  run: ./deploy.sh
  env:
    DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

### 条件执行

```yaml
# 仅在特定条件下运行
- name: Deploy
  if: github.ref == 'refs/heads/main'

# 仅在 PR 时运行
- name: PR Check
  if: github.event_name == 'pull_request'

# 使用表达式
- name: Tag build
  if: startsWith(github.ref, 'refs/tags/v')
```

### 矩阵策略（并行测试多个版本）

```yaml
strategy:
  matrix:
    node-version: [18, 20, 22]
    os: [ubuntu-latest, windows-latest]

steps:
  - uses: actions/setup-node@v4
    with:
      node-version: ${{ matrix.node-version }}
```

### 缓存策略

```yaml
# 方式 1：使用 setup-node 内置缓存
- uses: actions/setup-node@v4
  with:
    cache: 'pnpm'

# 方式 2：手动缓存
- uses: actions/cache@v4
  with:
    path: ~/.pnpm-store
    key: ${{ runner.os }}-pnpm-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-pnpm-
```

---

# 第三章：GitLab CI 对比

## 3.1 GitLab CI 是什么？

GitLab CI 是 GitLab 内置的 CI/CD 系统。与 GitHub Actions 类似，但配置方式不同。
GitLab CI 使用 `.gitlab-ci.yml` 文件来定义流水线。

### 核心概念对比

| 概念 | GitHub Actions | GitLab CI | 说明 |
|------|---------------|-----------|------|
| 配置文件 | `.github/workflows/*.yml` | `.gitlab-ci.yml` | GitHub 支持多文件，GitLab 单文件 |
| 运行单元 | Job | Job | 基本执行单元 |
| 分组 | Workflow | Pipeline | 一组 Job 的集合 |
| 执行环境 | Runner | Runner | 执行 Job 的机器 |
| 复用机制 | Action (uses) | include/template | 复用已有配置 |
| 触发方式 | on: push/pull_request | rules/only/except | 控制何时运行 |
| 变量 | `${{ secrets.X }}` | `$VARIABLE` | 环境变量引用方式 |
| 缓存 | actions/cache | cache: | 依赖缓存 |
| 制品 | artifacts | artifacts | 构建产物传递 |

## 3.2 GitLab CI 配置示例

以下是等价于我们 AI-CLI-Mobile GitHub Actions 配置的 GitLab CI 版本：

```yaml
# .gitlab-ci.yml

# ============================================================
# 全局镜像 —— 所有 Job 默认使用的 Docker 镜像
# ============================================================
image: node:20-bookworm

# ============================================================
# 阶段定义 —— Pipeline 的执行顺序
# ============================================================
stages:
  - install    # 安装依赖
  - check      # 代码检查
  - test       # 测试
  - build      # 构建
  - deploy     # 部署

# ============================================================
# 全局变量
# ============================================================
variables:
  PNPM_VERSION: "8.15.4"

# ============================================================
# 缓存配置 —— 跨 Job 共享 node_modules
# ============================================================
cache:
  key:
    files:
      - pnpm-lock.yaml
  paths:
    - .pnpm-store/
    - node_modules/

# ============================================================
# 安装 pnpm 的模板（可复用）
# ============================================================
.setup_pnpm: &setup_pnpm
  before_script:
    - corepack enable
    - corepack prepare pnpm@$PNPM_VERSION --activate
    - pnpm install --frozen-lockfile

# ============================================================
# Job: 安装依赖
# ============================================================
install:
  stage: install
  <<: *setup_pnpm
  script:
    - pnpm install --frozen-lockfile
  artifacts:
    paths:
      - node_modules/
    expire_in: 1 hour

# ============================================================
# Job: ESLint 检查
# ============================================================
lint:
  stage: check
  <<: *setup_pnpm
  script:
    - pnpm lint
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main"'

# ============================================================
# Job: TypeScript 类型检查
# ============================================================
type-check:
  stage: check
  <<: *setup_pnpm
  script:
    - pnpm build
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
    - if: '$CI_COMMIT_BRANCH == "main"'

# ============================================================
# Job: 单元测试
# ============================================================
test:
  stage: test
  <<: *setup_pnpm
  script:
    - pnpm test
  coverage: '/Statements\s*:\s*(\d+\.?\d*)%/'
  artifacts:
    reports:
      junit: test-results.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

# ============================================================
# Job: 安全审计
# ============================================================
security-audit:
  stage: check
  <<: *setup_pnpm
  script:
    - pnpm audit --audit-level moderate
  allow_failure: true

# ============================================================
# Job: Docker 构建（仅 PR）
# ============================================================
docker-build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t ai-cli-mobile:test .
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'

# ============================================================
# Job: 构建并推送镜像
# ============================================================
docker-push:
  stage: deploy
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - docker build -t $CI_REGISTRY_IMAGE:latest -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  rules:
    - if: '$CI_COMMIT_BRANCH == "main"'
    - if: '$CI_COMMIT_TAG =~ /^v/'
```

## 3.3 GitHub Actions vs GitLab CI 详细对比

| 特性 | GitHub Actions | GitLab CI | 谁更好？ |
|------|---------------|-----------|---------|
| **配置灵活度** | 多文件，每个 Workflow 独立 | 单文件，结构化阶段 | GitHub 更灵活 |
| **学习曲线** | YAML + 市场 Action | YAML + 内置功能 | 各有千秋 |
| **市场/生态** | GitHub Marketplace (20万+ Action) | 内置功能丰富 | GitHub 生态更大 |
| **Runner** | 免费 Ubuntu/Windows/macOS | 需自建或用 SaaS | GitHub 免费额度更多 |
| **缓存** | 需手动配置 | 内置缓存机制 | GitLab 更简单 |
| **制品管理** | 需 upload-artifact Action | 内置 artifacts | GitLab 更方便 |
| **安全扫描** | 需第三方 Action | 内置 SAST/DAST/依赖扫描 | GitLab 内置更强 |
| **私有部署** | 需 GitHub Enterprise | 社区版免费 | GitLab 更经济 |
| **容器注册表** | GHCR（需配置） | 内置 Container Registry | GitLab 更无缝 |

---

# 第四章：Jenkins 对比分析

## 4.1 Jenkins 是什么？

Jenkins 是最老牌的开源 CI/CD 工具，诞生于 2011 年（前身是 Hudson）。
它是一个独立的 Java 应用，需要自己安装和维护服务器。

### 与 GitHub Actions / GitLab CI 的根本区别

```mermaid
graph TB
    subgraph GitHub Actions / GitLab CI
        A["☁️ 云托管\n无需维护服务器\n按量付费"] --> B["配置即代码\nYAML 文件定义"]
        B --> C["有限定制\n使用平台提供的功能"]
    end

    subgraph Jenkins
        D["🖥️ 自托管\n需要自己维护服务器\n完全免费"] --> E["配置+代码\nJenkinsfile + 插件"]
        E --> F["高度定制\n2000+ 插件，几乎无限制"]
    end

    style A fill:#4CAF50,stroke:#333,color:#fff
    style D fill:#FF9800,stroke:#333,color:#fff
```

## 4.2 Jenkins 配置示例（等价功能）

```groovy
// Jenkinsfile (Declarative Pipeline)

pipeline {
    // 运行环境
    agent {
        docker {
            image 'node:20-bookworm'
            args '-v pnpm-store:/root/.local/share/pnpm/store'
        }
    }

    // 环境变量
    environment {
        PNPM_VERSION = '8.15.4'
    }

    // 触发条件
    triggers {
        pollSCM('H/5 * * * *')  // 每5分钟检查一次代码变更
    }

    // 流水线阶段
    stages {
        stage('Setup') {
            steps {
                sh 'corepack enable'
                sh "corepack prepare pnpm@${PNPM_VERSION} --activate"
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Lint') {
            steps {
                sh 'pnpm lint'
            }
        }

        stage('Type Check') {
            steps {
                sh 'pnpm build'
            }
        }

        stage('Test') {
            steps {
                sh 'pnpm test'
            }
            post {
                always {
                    junit 'test-results.xml'
                }
            }
        }

        stage('Security Audit') {
            steps {
                sh 'pnpm audit --audit-level moderate || true'
            }
        }

        stage('Docker Build') {
            when {
                anyOf {
                    branch 'main'
                    tag pattern: "v\\d+\\.\\d+\\.\\d+"
                }
            }
            steps {
                script {
                    docker.build("ai-cli-mobile:${env.GIT_COMMIT}")
                }
            }
        }

        stage('Docker Push') {
            when {
                branch 'main'
            }
            steps {
                script {
                    docker.withRegistry('https://ghcr.io', 'ghcr-credentials') {
                        def img = docker.build("ghcr.io/user/ai-cli-mobile:${env.GIT_COMMIT}")
                        img.push()
                        img.push('latest')
                    }
                }
            }
        }
    }

    post {
        failure {
            mail to: 'team@example.com',
                 subject: "Build Failed: ${currentBuild.fullDisplayName}",
                 body: "Check: ${env.BUILD_URL}"
        }
        success {
            echo 'Build succeeded!'
        }
    }
}
```

## 4.3 三大 CI/CD 工具全面对比

| 维度 | GitHub Actions | GitLab CI | Jenkins |
|------|---------------|-----------|---------|
| **部署方式** | 云托管 | 云托管/自托管 | 自托管 |
| **费用** | 公开仓库免费 | 社区版免费 | 完全免费（需自维护） |
| **配置语言** | YAML | YAML | Groovy/YAML |
| **学习曲线** | ⭐⭐ 低 | ⭐⭐ 低 | ⭐⭐⭐⭐ 高 |
| **维护成本** | 零 | 低（SaaS）/中（自托管） | 高 |
| **插件生态** | 20万+ Action | 内置为主 | 2000+ 插件 |
| **并行构建** | 支持（矩阵） | 支持（并行 Job） | 支持 |
| **Docker 支持** | 原生 | 原生 | 需插件 |
| **安全扫描** | 需第三方 | 内置 | 需插件 |
| **审批流程** | 环境保护规则 | 手动 Job | 内置审批 |
| **可视化** | 基础 | 优秀 | 插件丰富 |
| **适用场景** | GitHub 项目 | GitLab 项目 | 复杂企业需求 |
| **推荐指数** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

> 💡 **初学者建议**：如果你的代码在 GitHub 上，优先用 GitHub Actions。它的生态最好、配置最简单、免费额度够用。
> Jenkins 适合需要高度定制的企业环境，但维护成本高。

---

# 第五章：自动化测试集成

## 5.1 测试金字塔

在 CI/CD 中集成自动化测试是保证代码质量的关键。测试金字塔告诉我们不同类型测试的比例：

```mermaid
graph TB
    subgraph 测试金字塔
        E2E["🔺 E2E 测试\n(端到端测试)\n数量少，速度慢，覆盖关键路径"]
        INT["🔶 集成测试\n(组件交互)\n数量适中，验证模块协作"]
        UNIT["🟩 单元测试\n(函数级别)\n数量多，速度快，覆盖细节"]
    end

    UNIT --> INT --> E2E

    style E2E fill:#f44336,stroke:#333,color:#fff
    style INT fill:#FF9800,stroke:#333,color:#fff
    style UNIT fill:#4CAF50,stroke:#333,color:#fff
```

| 测试类型 | 占比 | 速度 | 成本 | 覆盖范围 | 工具 |
|---------|------|------|------|---------|------|
| **单元测试** | 70% | 毫秒级 | 低 | 单个函数/模块 | Vitest, Jest |
| **集成测试** | 20% | 秒级 | 中 | 模块间交互 | Vitest + msw |
| **E2E 测试** | 10% | 分钟级 | 高 | 完整用户流程 | Playwright, Cypress |

## 5.2 单元测试（Unit Tests）

单元测试是最基础的测试，验证单个函数或模块的行为。

```typescript
// apps/server/src/utils/__tests__/validateInput.test.ts

import { describe, it, expect } from 'vitest';
import { validateTerminalSize, sanitizeInput } from '../validateInput';

describe('validateTerminalSize', () => {
  // 正常情况
  it('should accept valid terminal dimensions', () => {
    expect(validateTerminalSize(80, 24)).toBe(true);
    expect(validateTerminalSize(120, 40)).toBe(true);
  });

  // 边界情况
  it('should reject zero or negative dimensions', () => {
    expect(validateTerminalSize(0, 24)).toBe(false);
    expect(validateTerminalSize(80, -1)).toBe(false);
  });

  // 极端情况
  it('should reject unreasonably large dimensions', () => {
    expect(validateTerminalSize(10000, 10000)).toBe(false);
  });
});

describe('sanitizeInput', () => {
  it('should pass through normal text', () => {
    expect(sanitizeInput('hello world')).toBe('hello world');
  });

  it('should escape control characters', () => {
    expect(sanitizeInput('\x00\x01\x02')).toBe('');
  });

  it('should preserve ANSI escape codes', () => {
    const input = '\x1b[31mred text\x1b[0m';
    expect(sanitizeInput(input)).toBe(input);
  });
});
```

### Vitest 配置

```typescript
// apps/server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 测试环境
    environment: 'node',
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // 覆盖率阈值 —— 低于此值测试失败
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    // 测试文件匹配模式
    include: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
    // 排除目录
    exclude: ['node_modules', 'dist', 'e2e'],
  },
});
```

## 5.3 集成测试（Integration Tests）

集成测试验证多个模块协同工作的正确性。

```typescript
// apps/server/src/__tests__/terminalSession.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from '../server';
import { WebSocket } from 'ws';

describe('Terminal Session Integration', () => {
  let server: any;
  let port: number;

  beforeAll(async () => {
    // 启动测试服务器
    server = await createServer({ port: 0 });
    port = server.address().port;
  });

  afterAll(async () => {
    await server.close();
  });

  it('should create a terminal session via WebSocket', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/ws/terminal`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        // 发送创建会话请求
        ws.send(JSON.stringify({
          type: 'create_session',
          cols: 80,
          rows: 24,
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        expect(msg.type).toBe('session_created');
        expect(msg.sessionId).toBeDefined();
        ws.close();
        resolve();
      });
    });
  });

  it('should handle multiple concurrent sessions', async () => {
    const sessions = await Promise.all(
      Array.from({ length: 5 }, () =>
        new Promise<string>((resolve) => {
          const ws = new WebSocket(`ws://localhost:${port}/ws/terminal`);
          ws.on('open', () => {
            ws.send(JSON.stringify({ type: 'create_session', cols: 80, rows: 24 }));
          });
          ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'session_created') {
              resolve(msg.sessionId);
              ws.close();
            }
          });
        })
      )
    );

    // 5 个会话应有不同的 ID
    expect(new Set(sessions).size).toBe(5);
  });
});
```

## 5.4 E2E 测试（端到端测试）

E2E 测试模拟真实用户操作，验证整个应用的流程。

```typescript
// e2e/terminal.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Terminal Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'testpass');
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL('/dashboard');
  });

  test('should create and interact with terminal', async ({ page }) => {
    // 点击创建终端按钮
    await page.click('[data-testid="new-terminal"]');
    await page.waitForSelector('.xterm-screen');

    // 等待终端就绪（出现提示符）
    await page.waitForFunction(() => {
      const screen = document.querySelector('.xterm-screen');
      return screen?.textContent?.includes('$');
    });

    // 输入命令
    await page.keyboard.type('echo "Hello CI/CD"');
    await page.keyboard.press('Enter');

    // 验证输出
    await page.waitForFunction(() => {
      const screen = document.querySelector('.xterm-screen');
      return screen?.textContent?.includes('Hello CI/CD');
    });
  });

  test('should survive page refresh (session persistence)', async ({ page }) => {
    // 创建终端并执行命令
    await page.click('[data-testid="new-terminal"]');
    await page.waitForSelector('.xterm-screen');
    await page.keyboard.type('export TEST_VAR=persisted');
    await page.keyboard.press('Enter');
    await page.keyboard.type('echo $TEST_VAR');
    await page.keyboard.press('Enter');

    // 刷新页面
    await page.reload();

    // 验证终端会话恢复
    await page.waitForSelector('.xterm-screen');
    const content = await page.locator('.xterm-screen').textContent();
    expect(content).toContain('persisted');
  });
});
```

### Playwright 配置

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results.xml' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

## 5.5 测试在 CI 中的集成流程

```mermaid
flowchart LR
    subgraph "GitHub Actions"
        A["代码推送"] --> B["安装依赖"]
        B --> C["单元测试\nvitest"]
        C --> D["集成测试\nvitest"]
        D --> E["构建"]
        E --> F["E2E 测试\nplaywright"]
    end

    C -->|"覆盖率报告"| G["📊 Coverage"]
    F -->|"截图/视频"| H["📸 Artifacts"]

    style C fill:#4CAF50,stroke:#333,color:#fff
    style D fill:#FF9800,stroke:#333,color:#fff
    style F fill:#f44336,stroke:#333,color:#fff
```

---

# 第六章：代码质量工具链

## 6.1 代码质量工具全景

```mermaid
graph LR
    subgraph 代码质量工具链
        direction TB
        ESLINT["🔍 ESLint\n代码逻辑检查\n发现潜在 Bug"]
        PRETTIER["🎨 Prettier\n代码格式化\n统一风格"]
        STYLELINT["💅 Stylelint\nCSS 检查\n样式规范"]
        TSC["📐 TypeScript\n类型检查\n类型安全"]
        COMMITLINT["📝 commitlint\n提交规范\nConventional Commits"]
    end

    CODE["👨‍💻 开发者写代码"] --> ESLINT
    CODE --> PRETTIER
    CODE --> STYLELINT
    CODE --> TSC

    ESLINT --> CI["🤖 CI 流水线"]
    PRETTIER --> CI
    STYLELINT --> CI
    TSC --> CI
    COMMITLINT --> GIT["🔗 Git Hooks"]

    style ESLINT fill:#4B32C3,stroke:#333,color:#fff
    style PRETTIER fill:#F7B93E,stroke:#333,color:#333
    style STYLELINT fill:#333,stroke:#333,color:#fff
    style TSC fill:#3178C6,stroke:#333,color:#fff
```

## 6.2 ESLint 配置详解

ESLint 是 JavaScript/TypeScript 的静态代码分析工具，用于发现代码中的问题。

### ESLint 能检查什么？

| 检查类型 | 示例 | 严重性 |
|---------|------|-------|
| **语法错误** | 括号不匹配、缺少分号 | ❌ Error |
| **未使用变量** | 声明了但没用的变量 | ⚠️ Warning |
| **潜在 Bug** | `==` vs `===`、变量遮蔽 | ❌ Error |
| **最佳实践** | 不用 `eval()`、不用 `var` | ⚠️ Warning |
| **代码风格** | 缩进、引号（通常交给 Prettier） | 🔵 Info |
| **TypeScript 专用** | `any` 类型、类型断言滥用 | ⚠️ Warning |

### Flat Config 配置示例（ESLint 9+）

```javascript
// eslint.config.js（新格式）
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  // 基础规则
  js.configs.recommended,

  // TypeScript 规则
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: true,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // ---- TypeScript 推荐规则 ----
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',  // 以 _ 开头的参数允许未使用
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',  // 强制使用 import type
      }],

      // ---- 最佳实践 ----
      'no-console': ['warn', {
        allow: ['warn', 'error'],  // 只允许 console.warn 和 console.error
      }],
      'no-debugger': 'error',
      'no-eval': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // ---- React 相关（如果有） ----
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // 忽略文件
  {
    ignores: ['dist/', 'node_modules/', '*.config.js'],
  },
];
```

### ESLint 规则严重性

| 级别 | 值 | 含义 | CI 行为 |
|------|---|------|---------|
| **Off** | `0` | 关闭规则 | 不检查 |
| **Warn** | `1` | 警告 | 显示但不阻断 |
| **Error** | `2` | 错误 | 阻断 CI |

## 6.3 Prettier 配置详解

Prettier 是一个"有主见的"代码格式化工具。它不检查代码逻辑，只管格式。

### Prettier 能做什么？

```
格式化前：                          格式化后：
const user={name:"张三",           const user = {
age:25,skills:["React",             name: "张三",
"TypeScript","Node.js"]             age: 25,
}                                   skills: ["React", "TypeScript", "Node.js"],
                                   };
```

### Prettier 与 ESLint 的分工

```mermaid
graph TD
    subgraph "Prettier 负责（格式）"
        P1["缩进：2空格 or 4空格"]
        P2["引号：单引号 or 双引号"]
        P3["分号：要不要"]
        P4["换行：一行多长"]
        P5["尾逗号：要不要"]
        P6["括号间距：( x ) or (x)"]
    end

    subgraph "ESLint 负责（逻辑）"
        E1["未使用变量"]
        E2["类型安全"]
        E3["潜在 Bug"]
        E4["最佳实践"]
        E5["代码复杂度"]
        E6["导入顺序"]
    end

    style P1 fill:#F7B93E,stroke:#333,color:#333
    style E1 fill:#4B32C3,stroke:#333,color:#fff
```

### 项目使用的 Prettier 配置

AI-CLI-Mobile 项目使用共享配置包：

```json
// package.json
{
  "prettier": "@ai-cli/prettier-config"
}
```

共享配置包通常包含：

```javascript
// packages/prettier-config/index.js
module.exports = {
  // 一行最多 100 个字符
  printWidth: 100,
  // 使用 2 个空格缩进
  tabWidth: 2,
  // 不使用 Tab 缩进
  useTabs: false,
  // 语句末尾加分号
  semi: true,
  // 使用单引号
  singleQuote: true,
  // 对象属性仅在必要时加引号
  quoteProps: 'as-needed',
  // 在 JSX 中使用单引号
  jsxSingleQuote: true,
  // 多行时加尾逗号（ES5 兼容）
  trailingComma: 'all',
  // 对象大括号内加空格 { foo: bar }
  bracketSpacing: true,
  // JSX 标签的 > 放在下一行末尾
  jsxBracketSameLine: false,
  // 箭头函数参数加括号 (x) => x
  arrowParens: 'always',
  // 每个文件自动检测换行符
  endOfLine: 'lf',
};
```

### 常用 Prettier 配置项对照表

| 配置项 | 可选值 | 推荐值 | 说明 |
|--------|-------|--------|------|
| `printWidth` | 数字 | `100` | 一行最大字符数 |
| `tabWidth` | 数字 | `2` | 缩进空格数 |
| `useTabs` | `true/false` | `false` | 用 Tab 还是空格 |
| `semi` | `true/false` | `true` | 是否加分号 |
| `singleQuote` | `true/false` | `true` | 用单引号还是双引号 |
| `trailingComma` | `"none"/"es5"/"all"` | `"all"` | 尾逗号策略 |
| `bracketSpacing` | `true/false` | `true` | 对象括号内空格 |
| `arrowParens` | `"avoid"/"always"` | `"always"` | 箭头函数参数括号 |
| `endOfLine` | `"lf"/"crlf"/"auto"` | `"lf"` | 换行符类型 |

## 6.4 Stylelint 配置

Stylelint 是 CSS/SCSS 的静态检查工具。

```javascript
// .stylelintrc.js
module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-prettier',  // 与 Prettier 不冲突
  ],
  rules: {
    // 颜色使用小写十六进制
    'color-hex-case': 'lower',
    // 颜色使用简写
    'color-hex-length': 'short',
    // 禁止空块
    'block-no-empty': true,
    // 禁止未知的 @ 规则
    'at-rule-no-unknown': [true, {
      ignoreAtRules: ['tailwind', 'apply', 'layer'],
    }],
    // 类名使用 BEM 或 kebab-case
    'selector-class-pattern': /^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$/,
  },
};
```

## 6.5 工具链协作流程

```mermaid
flowchart TD
    A["开发者写代码"] --> B{"保存文件\n(编辑器自动)"}
    B --> C["Prettier 格式化"]
    C --> D["ESLint 检查"]
    D --> E{有问题?}
    E -->|"是"| F["显示红线提示"]
    F --> A
    E -->|"否"| G["git add"]
    G --> H["Git Hook 触发"]
    H --> I["lint-staged\n只检查暂存文件"]
    I --> J["commitlint\n检查提交信息"]
    J --> K["git commit ✅"]
    K --> L["git push"]
    L --> M["CI 运行完整检查"]

    style B fill:#E3F2FD,stroke:#333
    style H fill:#FFF3E0,stroke:#333
    style M fill:#E8F5E9,stroke:#333
```

---

# 第七章：Git Hooks 与 Husky

## 7.1 什么是 Git Hooks？

Git Hooks 是 Git 在特定事件发生时自动执行的脚本。比如在提交代码前、推送代码前等。

### Git Hooks 类型

| Hook 名称 | 触发时机 | 常见用途 |
|-----------|---------|---------|
| `pre-commit` | `git commit` 执行前 | 代码检查、格式化 |
| `prepare-commit-msg` | 编辑提交信息前 | 自动生成提交信息模板 |
| `commit-msg` | 提交信息编辑后 | 检查提交信息格式 |
| `pre-push` | `git push` 执行前 | 运行测试 |
| `pre-rebase` | `git rebase` 执行前 | 防止 rebase 特定分支 |
| `post-merge` | `git merge` 执行后 | 重新安装依赖 |
| `post-checkout` | `git checkout` 执行后 | 清理临时文件 |

### Git Hooks 工作原理

```mermaid
flowchart LR
    A["开发者执行\ngit commit"] --> B["Git 查找\n.git/hooks/pre-commit"]
    B --> C{脚本存在?}
    C -->|"是"| D["执行 pre-commit 脚本"]
    D --> E{返回值?}
    E -->|"0 (成功)"| F["继续提交"]
    E -->|"非0 (失败)"| G["❌ 取消提交"]
    C -->|"否"| F

    style D fill:#FF9800,stroke:#333,color:#fff
    style F fill:#4CAF50,stroke:#333,color:#fff
    style G fill:#f44336,stroke:#333,color:#fff
```

### 传统 Git Hooks 的问题

传统的 Git Hooks 存在 `.git/hooks/` 目录中，而 `.git/` 目录不在版本控制中。这意味着：

1. **无法共享**：每个开发者需要手动配置
2. **容易遗忘**：新成员克隆仓库后没有 Hooks
3. **难以维护**：手动复制脚本文件

## 7.2 Husky 是什么？

Husky 是一个 Git Hooks 管理工具，它解决了上述问题。通过 Husky，Git Hooks 可以像代码一样被版本控制。

### Husky 工作原理

```mermaid
graph TD
    subgraph "传统方式"
        T1["手动创建 .git/hooks/pre-commit"]
        T2["脚本不在版本控制中"]
        T3["每个开发者需要手动配置"]
    end

    subgraph "Husky 方式"
        H1["package.json 中声明 husky"]
        H2["pnpm prepare 自动安装"]
        H3[".husky/ 目录在版本控制中"]
        H4["所有人自动获得相同配置"]
    end

    H1 --> H2 --> H3 --> H4

    style T1 fill:#f44336,stroke:#333,color:#fff
    style H4 fill:#4CAF50,stroke:#333,color:#fff
```

## 7.3 AI-CLI-Mobile 项目的 Husky 配置

### 安装和初始化

```bash
# 安装 husky
pnpm add -D husky

# 初始化（在 package.json 中添加 prepare 脚本）
npx husky init
```

package.json 中的配置：

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.0.0"
  }
}
```

> 💡 **`prepare` 脚本是什么？**
> `prepare` 是 npm/pnpm 的生命周期脚本，在 `pnpm install` 后自动执行。
> 这意味着任何人克隆仓库并运行 `pnpm install` 后，Husky 会自动配置 Git Hooks。

### Husky 配置文件

```bash
# .husky/pre-commit（唯一的 Hook 文件）
pnpm lint-staged
```

就这么简单！整个内容就是一行命令。

### 完整的 Git Hooks 流程

```mermaid
sequenceDiagram
    participant Dev as 开发者
    participant Git as Git
    participant Husky as Husky
    participant LS as lint-staged
    participant ESL as ESLint
    participant PR as Prettier
    participant CL as commitlint

    Dev->>Git: git commit -m "feat: add terminal"
    Git->>Husky: 触发 pre-commit hook
    Husky->>LS: 执行 pnpm lint-staged

    LS->>LS: 获取暂存文件列表
    LS->>ESL: 对 .ts/.tsx 文件运行 eslint --fix
    ESL-->>LS: 检查结果

    LS->>PR: 对 .ts/.tsx/.json/.md 文件运行 prettier --write
    PR-->>LS: 格式化结果

    LS-->>Husky: 完成
    Husky-->>Git: 返回 0（成功）

    Git->>Git: 打开编辑器输入提交信息
    Git->>CL: 触发 commit-msg hook
    CL->>CL: 检查提交信息格式
    CL-->>Git: 返回 0（成功）
    Git-->>Dev: ✅ 提交成功
```

## 7.4 常见 Husky 配置模式

### 模式 1：只运行 lint-staged

```bash
# .husky/pre-commit
pnpm lint-staged
```

### 模式 2：运行多个检查

```bash
# .husky/pre-commit
pnpm lint-staged
pnpm type-check
```

### 模式 3：提交前运行测试

```bash
# .husky/pre-commit
pnpm lint-staged

# .husky/pre-push
pnpm test
```

### 模式 4：检查提交信息

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

### 模式 5：条件执行（跳过 CI 环境）

```bash
# .husky/pre-commit
if [ "$CI" = "true" ]; then
  echo "Skipping pre-commit hook in CI"
  exit 0
fi
pnpm lint-staged
```

---

# 第八章：lint-staged 工作流

## 8.1 什么是 lint-staged？

lint-staged 是一个只对 Git 暂存区（staged）文件运行 linters 的工具。

### 为什么需要 lint-staged？

```mermaid
graph TD
    subgraph "不使用 lint-staged"
        A1["git add ."] --> A2["对整个项目运行 ESLint"]
        A2 --> A3["❌ 可能要等很久"]
        A3 --> A4["❌ 可能报大量无关错误"]
    end

    subgraph "使用 lint-staged"
        B1["git add src/terminal.ts"] --> B2["只对 src/terminal.ts 运行 ESLint"]
        B2 --> B3["✅ 几秒钟完成"]
        B3 --> B4["✅ 只检查你修改的文件"]
    end

    style A3 fill:#f44336,stroke:#333,color:#fff
    style A4 fill:#f44336,stroke:#333,color:#fff
    style B3 fill:#4CAF50,stroke:#333,color:#fff
    style B4 fill:#4CAF50,stroke:#333,color:#fff
```

## 8.2 AI-CLI-Mobile 项目的 lint-staged 配置

项目在 `package.json` 中的配置：

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

### 配置逐项解析

| Glob 模式 | 匹配文件 | 执行命令 | 说明 |
|-----------|---------|---------|------|
| `*.{ts,tsx}` | TypeScript 文件 | `eslint --fix` | 检查代码问题并自动修复 |
| `*.{ts,tsx}` | TypeScript 文件 | `prettier --write` | 格式化代码 |
| `*.{json,md,yml,yaml}` | 配置/文档文件 | `prettier --write` | 只格式化，不做逻辑检查 |

### 执行流程详解

```mermaid
flowchart TD
    A["git add src/terminal.ts\nREADME.md\nconfig.json"] --> B["lint-staged 启动"]
    B --> C["获取暂存文件列表"]
    C --> D{文件类型?}
    D -->|"src/terminal.ts\n(.ts 文件)"| E["ESLint: eslint --fix src/terminal.ts"]
    E --> F["Prettier: prettier --write src/terminal.ts"]
    D -->|"README.md\n(.md 文件)"| G["Prettier: prettier --write README.md"]
    D -->|"config.json\n(.json 文件)"| H["Prettier: prettier --write config.json"]
    F --> I["lint-staged 将修改重新加入暂存区"]
    G --> I
    H --> I
    I --> J["✅ pre-commit 完成"]

    style E fill:#4B32C3,stroke:#333,color:#fff
    style F fill:#F7B93E,stroke:#333,color:#333
    style G fill:#F7B93E,stroke:#333,color:#333
```

## 8.3 lint-staged 的智能之处

### 只检查暂存文件

```
你修改了 10 个文件，但只 git add 了 3 个
→ lint-staged 只检查这 3 个文件
→ 速度快，结果精准
```

### 自动修复 + 重新暂存

```
1. 你 git add 了一个有格式问题的文件
2. ESLint --fix 自动修复了一些问题
3. Prettier --write 重新格式化了代码
4. lint-staged 自动将修复后的文件重新加入暂存区
→ 你不需要再手动 git add
```

### 按文件类型分组

```mermaid
graph LR
    subgraph "暂存的文件"
        F1["terminal.ts"]
        F2["styles.css"]
        F3["README.md"]
        F4["config.json"]
        F5["Component.tsx"]
    end

    subgraph "*.ts, *.tsx"
        F1 --> E1["eslint --fix"]
        F5 --> E2["eslint --fix"]
        E1 --> P1["prettier --write"]
        E2 --> P2["prettier --write"]
    end

    subgraph "*.json, *.md, *.yml, *.yaml"
        F3 --> P3["prettier --write"]
        F4 --> P4["prettier --write"]
    end

    subgraph "*.css（无配置）"
        F2 -.->|"不处理"| SKIP["跳过"]
    end

    style E1 fill:#4B32C3,stroke:#333,color:#fff
    style P1 fill:#F7B93E,stroke:#333,color:#333
    style SKIP fill:#9E9E9E,stroke:#333,color:#fff
```

## 8.4 高级 lint-staged 配置

### 配置文件方式（.lintstagedrc.js）

```javascript
// .lintstagedrc.js
const path = require('path');

module.exports = {
  // TypeScript 文件
  '*.{ts,tsx}': (filenames) => {
    const escapedFiles = filenames
      .map((f) => path.relative(process.cwd(), f))
      .map((f) => `'${f}'`);

    return [
      `eslint --fix ${escapedFiles.join(' ')}`,
      `prettier --write ${escapedFiles.join(' ')}`,
    ];
  },

  // CSS/SCSS 文件
  '*.{css,scss}': ['stylelint --fix', 'prettier --write'],

  // JSON/Markdown/YAML
  '*.{json,md,yml,yaml}': ['prettier --write'],

  // package.json 特殊处理
  'package.json': ['sort-package-json'],

  // Docker 相关
  'Dockerfile': ['hadolint'],
};
```

### 项目特定配置（Monorepo）

```javascript
// 针对不同子包的配置
module.exports = {
  'apps/web/**/*.{ts,tsx}': [
    'eslint --config apps/web/.eslintrc --fix',
    'prettier --write',
  ],
  'apps/server/**/*.ts': [
    'eslint --config apps/server/.eslintrc --fix',
    'prettier --write',
  ],
  'packages/**/*.ts': [
    'eslint --fix',
    'prettier --write',
  ],
};
```

---

# 第九章：Conventional Commits 规范

## 9.1 什么是 Conventional Commits？

Conventional Commits（约定式提交）是一种对提交信息的轻量约定。它提供了一组简单的规则来创建清晰的提交历史。

### 提交信息格式

```
<type>(<scope>): <subject>

[body]

[footer]
```

### 完整示例

```
feat(terminal): 添加终端会话持久化功能

当用户刷新页面或网络断开时，终端会话不再丢失。
使用 tmux 作为后端会话管理器，WebSocket 断线后自动重连。

- 新增 SessionManager 类管理 tmux 会话
- 新增 WebSocket 重连机制
- 添加会话超时清理定时器

Closes #123
Fixes #456
```

## 9.2 类型（Type）详解

| 类型 | 含义 | 示例 | 发版影响 |
|------|------|------|---------|
| `feat` | 新功能 | `feat(auth): 添加 JWT 刷新机制` | MINOR |
| `fix` | Bug 修复 | `fix(ws): 修复断线重连失败` | PATCH |
| `docs` | 文档更新 | `docs: 更新 README 安装说明` | - |
| `style` | 代码格式（不影响逻辑） | `style: 统一缩进为 2 空格` | - |
| `refactor` | 重构（既不修复 Bug 也不添加功能） | `refactor(server): 提取会话管理模块` | - |
| `perf` | 性能优化 | `perf(terminal): 优化渲染性能` | PATCH |
| `test` | 添加/修改测试 | `test: 添加终端会话单元测试` | - |
| `build` | 构建系统或外部依赖变更 | `build: 升级 Node.js 到 v20` | - |
| `ci` | CI 配置变更 | `ci: 添加 Docker 构建缓存` | - |
| `chore` | 其他杂项 | `chore: 清理未使用的依赖` | - |
| `revert` | 回滚 | `revert: 回滚 feat(auth) 的改动` | 视情况 |

## 9.3 commitlint 配置

commitlint 是一个检查提交信息是否符合 Conventional Commits 规范的工具。

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 类型必须是以下之一
    'type-enum': [
      2,
      'always',
      [
        'feat',     // 新功能
        'fix',      // Bug 修复
        'docs',     // 文档
        'style',    // 格式
        'refactor', // 重构
        'perf',     // 性能
        'test',     // 测试
        'build',    // 构建
        'ci',       // CI
        'chore',    // 杂项
        'revert',   // 回滚
      ],
    ],
    // 主题不能为空
    'subject-empty': [2, 'never'],
    // 类型不能为空
    'type-empty': [2, 'never'],
    // 类型必须小写
    'type-case': [2, 'always', 'lower-case'],
    // 主题最大长度
    'subject-max-length': [2, 'always', 100],
    // body 最大行长
    'body-max-line-length': [2, 'always', 200],
  },
};
```

### Husky 集成

```bash
# .husky/commit-msg
npx --no -- commitlint --edit $1
```

### 常见错误示例

```
❌ git commit -m "修改了代码"
   → 缺少 type

❌ git commit -m "fix"
   → 缺少 subject

❌ git commit -m "Feat: 添加新功能"
   → type 必须小写

❌ git commit -m "feat:"
   → subject 不能为空

✅ git commit -m "feat(terminal): 添加会话持久化"
```

## 9.4 提交信息验证流程

```mermaid
flowchart TD
    A["开发者写提交信息"] --> B["git commit -m 'xxx'"]
    B --> C["Husky 触发 commit-msg hook"]
    C --> D["commitlint 解析提交信息"]
    D --> E{格式正确?}
    E -->|"✅ 正确"| F["提交成功"]
    E -->|"❌ 错误"| G["显示错误信息"]
    G --> H["提示正确格式"]
    H --> A

    style F fill:#4CAF50,stroke:#333,color:#fff
    style G fill:#f44336,stroke:#333,color:#fff
```

---

# 第十章：语义化版本号（SemVer）

## 10.1 什么是语义化版本号？

语义化版本号（Semantic Versioning，简称 SemVer）是一套版本号命名规范。它通过版本号来传达代码变更的含义。

### 版本号格式

```
MAJOR.MINOR.PATCH

例如：1.2.3
     │ │ │
     │ │ └── PATCH：向后兼容的 Bug 修复
     │ └──── MINOR：向后兼容的新功能
     └────── MAJOR：不兼容的 API 变更
```

### 版本号含义对照表

| 版本变更 | 含义 | 何时升级 | 示例 |
|---------|------|---------|------|
| `1.0.0 → 1.0.1` | Bug 修复 | 修复了一个 Bug | 修复终端输入法问题 |
| `1.0.0 → 1.1.0` | 新功能 | 添加了向后兼容的新功能 | 添加文件浏览器 |
| `1.0.0 → 2.0.0` | 破坏性变更 | API 不兼容旧版本 | 重构 WebSocket 协议 |
| `1.0.0-alpha.1` | 预发布版本 | 测试阶段 | 内部测试 |
| `1.0.0-beta.1` | Beta 版本 | 公开测试 | 公测 |
| `1.0.0-rc.1` | 候选版本 | 即将发布 | 发布前最后测试 |

## 10.2 SemVer 工作流程

```mermaid
flowchart LR
    subgraph "开发过程"
        A["日常开发\ncommit, commit..."]
        A --> B["修复 Bug"]
        A --> C["添加功能"]
        A --> D["破坏性变更"]
    end

    B --> E["PATCH 版本\n1.0.0 → 1.0.1"]
    C --> F["MINOR 版本\n1.0.0 → 1.1.0"]
    D --> G["MAJOR 版本\n1.0.0 → 2.0.0"]

    E --> H["git tag v1.0.1"]
    F --> I["git tag v1.1.0"]
    G --> J["git tag v2.0.0"]

    H --> K["CI 自动构建\nDocker 镜像"]
    I --> K
    J --> K

    style E fill:#4CAF50,stroke:#333,color:#fff
    style F fill:#2196F3,stroke:#333,color:#fff
    style G fill:#f44336,stroke:#333,color:#fff
```

## 10.3 语义化版本号与自动发版

### Conventional Commits + SemVer = 自动化

通过 Conventional Commits 的提交类型，可以自动决定版本号：

```mermaid
flowchart TD
    A["收集自上次发版以来的所有 commit"] --> B{包含 BREAKING CHANGE?}
    B -->|"是"| C["升级 MAJOR\nx.0.0"]
    B -->|"否"| D{包含 feat?}
    D -->|"是"| E["升级 MINOR\n0.x.0"]
    D -->|"否"| F{只包含 fix?}
    F -->|"是"| G["升级 PATCH\n0.0.x"]
    F -->|"否"| H["不发版\n(只有 docs/style/chore)"]

    style C fill:#f44336,stroke:#333,color:#fff
    style E fill:#2196F3,stroke:#333,color:#fff
    style G fill:#4CAF50,stroke:#333,color:#fff
    style H fill:#9E9E9E,stroke:#333,color:#fff
```

### 工具推荐

| 工具 | 功能 | 配置复杂度 |
|------|------|-----------|
| **semantic-release** | 全自动发版（分析提交→确定版本→发布→打 Tag） | 中 |
| **changesets** | 手动记录变更，批量发版 | 低 |
| **release-please** | Google 出品，基于 PR 的自动发版 | 低 |
| **standard-version** | 本地命令行工具，生成 CHANGELOG | 低 |

## 10.4 CHANGELOG 自动生成

```markdown
# CHANGELOG.md

# [1.2.0](https://github.com/user/ai-cli-mobile/compare/v1.1.0...v1.2.0) (2024-03-15)

### Features

* **terminal:** 添加终端会话持久化功能 ([#123](https://github.com/user/ai-cli-mobile/issues/123))
* **file-browser:** 支持文件预览 ([#124](https://github.com/user/ai-cli-mobile/issues/124))

### Bug Fixes

* **ws:** 修复断线重连后会话丢失 ([#125](https://github.com/user/ai-cli-mobile/issues/125))
* **auth:** 修复 Token 刷新竞态条件 ([#126](https://github.com/user/ai-cli-mobile/issues/126))

# [1.1.0](https://github.com/user/ai-cli-mobile/compare/v1.0.0...v1.1.0) (2024-03-01)

### Features

* **auth:** 添加 JWT 双 Token 机制
* **terminal:** 支持虚拟键盘适配
```

---

# 第十一章：环境管理（dev/staging/prod）

## 11.1 环境分类

```mermaid
graph LR
    subgraph "开发环境 DEV"
        D1["本地开发服务器"]
        D2["热重载 (HMR)"]
        D3["详细日志"]
        D4["Mock 数据"]
    end

    subgraph "测试环境 STAGING"
        S1["与生产相同配置"]
        S2["真实数据子集"]
        S3["QA 测试"]
        S4["性能测试"]
    end

    subgraph "生产环境 PROD"
        P1["高可用部署"]
        P2["监控告警"]
        P3["最少日志"]
        P4["真实用户数据"]
    end

    D1 -->|"开发完成"| S1
    S1 -->|"测试通过"| P1

    style D1 fill:#4CAF50,stroke:#333,color:#fff
    style S1 fill:#FF9800,stroke:#333,color:#fff
    style P1 fill:#f44336,stroke:#333,color:#fff
```

### 环境对比表

| 维度 | DEV（开发） | STAGING（预发布） | PROD（生产） |
|------|-----------|-----------------|-------------|
| **用途** | 日常开发调试 | 上线前验证 | 服务真实用户 |
| **数据** | 测试数据/假数据 | 生产数据副本 | 真实用户数据 |
| **日志级别** | debug（最详细） | info（中等） | warn/error（最少） |
| **错误处理** | 显示完整堆栈 | 显示友好提示 | 显示友好提示 |
| **缓存** | 关闭/短时间 | 模拟生产 | 全面开启 |
| **性能优化** | 不需要 | 测试验证 | 全面优化 |
| **访问控制** | 无/简单密码 | IP 白名单 | 认证+授权 |
| **监控** | 可选 | 必须 | 必须+告警 |

## 11.2 环境变量管理

### .env 文件层级

```bash
# 文件优先级（从高到低）
.env.local          # 本地覆盖（不提交到 Git）
.env.development    # 开发环境
.env.staging        # 预发布环境
.env.production     # 生产环境
.env.example        # 示例文件（提交到 Git）
```

### AI-CLI-Mobile 的环境变量

```bash
# .env.example（提交到 Git 的示例文件）

# ============ 服务器配置 ============
PORT=3000
HOST=0.0.0.0

# ============ 认证配置 ============
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============ 会话配置 ============
SESSION_TIMEOUT=3600
MAX_SESSIONS_PER_USER=5

# ============ Docker 配置 ============
DOCKER_SOCKET=/var/run/docker.sock
DOCKER_NETWORK=ai-cli-mobile

# ============ 日志配置 ============
LOG_LEVEL=info
LOG_FORMAT=json

# ============ CORS 配置 ============
CORS_ORIGIN=http://localhost:5173
```

### 环境变量在 CI/CD 中的使用

```yaml
# GitHub Actions 中使用 Secrets
- name: Deploy
  run: ./deploy.sh
  env:
    # GitHub Secrets（在仓库设置中配置）
    DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
    DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}

    # 根据分支设置不同值
    NODE_ENV: ${{ github.ref == 'refs/heads/main' && 'production' || 'development' }}
    LOG_LEVEL: ${{ github.ref == 'refs/heads/main' && 'warn' || 'debug' }}
```

## 11.3 环境配置文件管理

```mermaid
graph TD
    subgraph "版本控制 (Git)"
        ENV_EX[".env.example\n(模板，提交到 Git)"]
    end

    subgraph "本地开发"
        ENV_LOC[".env.local\n(实际值，不提交)"]
    end

    subgraph "CI/CD"
        GH_SEC["GitHub Secrets\n(加密存储)"]
    end

    subgraph "服务器"
        SYS_ENV["系统环境变量\n(docker-compose)"]
    end

    ENV_EX -->|"复制并填值"| ENV_LOC
    GH_SEC -->|"运行时注入"| CI_JOB["CI Job"]
    SYS_ENV -->|"运行时注入"| APP["应用进程"]

    style ENV_EX fill:#4CAF50,stroke:#333,color:#fff
    style ENV_LOC fill:#f44336,stroke:#333,color:#fff
    style GH_SEC fill:#2196F3,stroke:#333,color:#fff
```

## 11.4 Docker Compose 环境管理

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=warn
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

# docker-compose.dev.yml（开发用）
# docker-compose.override.yml（本地覆盖）
```

```bash
# 使用不同环境的 compose 文件
docker-compose up -d                           # 默认
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up   # 开发
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up  # 生产
```

---

# 第十二章：部署策略

## 12.1 三大部署策略

```mermaid
graph TB
    subgraph "🔵 蓝绿部署"
        direction LR
        BL["🔵 蓝环境\n(当前生产)"] -->|"切换流量"| GR["🟢 绿环境\n(新版本)"]
        GR -.->|"回滚"| BL
    end

    subgraph "🐤 金丝雀发布"
        direction LR
        CAN1["用户群 1"] -->|"10% 流量"| NEW["新版本"]
        CAN2["用户群 2"] -->|"90% 流量"| OLD["旧版本"]
        NEW -->|"逐步增加"| FULL["100% 新版本"]
    end

    subgraph "🔄 滚动更新"
        direction LR
        R1["旧 ✅"] -->|"更新"| R1N["新 ✅"]
        R2["旧 ✅"] -->|"更新"| R2N["新 ✅"]
        R3["旧 ✅"] -->|"更新"| R3N["新 ✅"]
        R4["旧 ✅"] -->|"更新"| R4N["新 ✅"]
    end

    style BL fill:#2196F3,stroke:#333,color:#fff
    style GR fill:#4CAF50,stroke:#333,color:#fff
    style NEW fill:#FF9800,stroke:#333,color:#fff
    style OLD fill:#9E9E9E,stroke:#333,color:#fff
```

## 12.2 蓝绿部署（Blue-Green Deployment）

### 原理

维护两个完全相同的生产环境：蓝（Blue）和绿（Green）。任何时候只有一个环境对外服务。

```mermaid
sequenceDiagram
    participant User as 用户
    participant LB as 负载均衡器
    participant Blue as 🔵 蓝环境 (v1.0)
    participant Green as 🟢 绿环境 (v2.0)

    Note over Blue: 当前生产环境 v1.0
    User->>LB: 请求
    LB->>Blue: 路由到蓝环境
    Blue-->>User: 响应 v1.0

    Note over Green: 部署新版本 v2.0
    LB->>Green: 验证绿环境健康
    Green-->>LB: ✅ 健康检查通过

    Note over LB: 切换流量！
    User->>LB: 请求
    LB->>Green: 路由到绿环境
    Green-->>User: 响应 v2.0

    Note over Blue: 蓝环境待命（可快速回滚）
```

### 优缺点

| 优点 | 缺点 |
|------|------|
| ✅ 零停机时间 | ❌ 需要双倍服务器资源 |
| ✅ 快速回滚（秒级） | ❌ 数据库迁移复杂 |
| ✅ 发布风险低 | ❌ 成本较高 |
| ✅ 新版本可完整测试 | ❌ 长时间运行的请求处理复杂 |

### Nginx 配置示例

```nginx
# 蓝绿部署 Nginx 配置
upstream blue {
    server 127.0.0.1:3001;
}

upstream green {
    server 127.0.0.1:3002;
}

# 当前活跃环境（通过符号链接或变量控制）
upstream active {
    server 127.0.0.1:3001;  # 蓝环境
    # server 127.0.0.1:3002;  # 切换到绿环境
}

server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://active;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 切换脚本

```bash
#!/bin/bash
# blue-green-switch.sh

CURRENT=$(readlink /etc/nginx/active-env)

if [ "$CURRENT" = "blue" ]; then
    NEW="green"
    PORT=3002
else
    NEW="blue"
    PORT=3001
fi

# 检查新环境健康状态
echo "检查 $NEW 环境健康状态..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/health)

if [ "$HEALTH" != "200" ]; then
    echo "❌ $NEW 环境不健康，取消切换"
    exit 1
fi

# 切换 Nginx 配置
echo "✅ $NEW 环境健康，切换流量..."
ln -sfn /etc/nginx/upstreams/$NEW.conf /etc/nginx/active-env.conf
nginx -s reload

echo "✅ 已切换到 $NEW 环境"
```

## 12.3 金丝雀发布（Canary Release）

### 原理

逐步将新版本推送给一小部分用户，观察无问题后逐步扩大范围。

```mermaid
flowchart TD
    subgraph "金丝雀发布流程"
        A["部署新版本到\n少数服务器 (5%)"] --> B["监控指标"]
        B --> C{指标正常?}
        C -->|"是"| D["增加流量 (25%)"]
        D --> E["继续监控"]
        E --> F{指标正常?}
        F -->|"是"| G["增加流量 (50%)"]
        G --> H["继续监控"]
        H --> I{指标正常?}
        I -->|"是"| J["全量发布 (100%)"]
        C -->|"否"| K["❌ 回滚到旧版本"]
        F -->|"否"| K
        I -->|"否"| K
    end

    style J fill:#4CAF50,stroke:#333,color:#fff
    style K fill:#f44336,stroke:#333,color:#fff
```

### Nginx 金丝雀配置

```nginx
# 金丝雀：90% 流量到稳定版，10% 到新版本
upstream canary {
    server 127.0.0.1:3001 weight=90;  # 稳定版
    server 127.0.0.1:3002 weight=10;  # 金丝雀版
}

server {
    listen 80;
    location / {
        proxy_pass http://canary;
    }
}
```

### 监控指标

| 指标 | 阈值 | 说明 |
|------|------|------|
| 错误率 | < 1% | HTTP 5xx 错误占比 |
| 响应时间 P99 | < 500ms | 99% 的请求响应时间 |
| CPU 使用率 | < 80% | 服务器 CPU |
| 内存使用率 | < 85% | 服务器内存 |
| 用户反馈 | 无异常投诉 | 客服系统 |

## 12.4 滚动更新（Rolling Update）

### 原理

逐步替换旧版本的实例，每次只替换一个（或一批），直到所有实例都是新版本。

```mermaid
sequenceDiagram
    participant K8s as 编排器
    participant P1 as Pod 1 (v1)
    participant P2 as Pod 2 (v1)
    participant P3 as Pod 3 (v1)
    participant P4 as Pod 4 (v1)

    Note over K8s: 开始滚动更新

    K8s->>P1: 替换为 v2
    Note over P1: Pod 1 (v2) ✅

    K8s->>P2: 替换为 v2
    Note over P2: Pod 2 (v2) ✅

    K8s->>P3: 替换为 v2
    Note over P3: Pod 3 (v2) ✅

    K8s->>P4: 替换为 v2
    Note over P4: Pod 4 (v2) ✅

    Note over K8s: 滚动更新完成！
```

### Kubernetes 滚动更新配置

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-cli-mobile
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 最多多出 1 个 Pod
      maxUnavailable: 0   # 不允许任何 Pod 不可用
  selector:
    matchLabels:
      app: ai-cli-mobile
  template:
    metadata:
      labels:
        app: ai-cli-mobile
    spec:
      containers:
        - name: app
          image: ghcr.io/user/ai-cli-mobile:latest
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

## 12.5 三种策略对比

| 维度 | 蓝绿部署 | 金丝雀发布 | 滚动更新 |
|------|---------|-----------|---------|
| **停机时间** | 零 | 零 | 零 |
| **回滚速度** | ⚡ 秒级 | ⚡ 秒级 | 🐢 需要重新部署 |
| **资源需求** | 2x | 1.1x | 1x |
| **发布风险** | 低 | 最低 | 中 |
| **实现复杂度** | 中 | 高 | 低 |
| **适用场景** | 关键业务 | 大规模服务 | 一般服务 |
| **数据库兼容性** | 需要双版本兼容 | 需要双版本兼容 | 相对简单 |
| **监控要求** | 低 | 高 | 中 |

---

# 第十三章：Turborepo 构建编排分析

## 13.1 Turborepo 是什么？

Turborepo 是一个 Monorepo 的构建系统，它可以智能地编排多个包的构建任务，实现：
- **并行构建**：没有依赖关系的任务同时执行
- **增量构建**：只构建发生变化的部分
- **远程缓存**：团队共享构建缓存

## 13.2 AI-CLI-Mobile 的 turbo.json 详解

```jsonc
{
  // JSON Schema，IDE 自动补全和验证
  "$schema": "https://turbo.build/schema.json",

  // 全局依赖：这些文件变化时，所有任务的缓存失效
  "globalDependencies": ["**/.env.*local"],

  // 任务管道定义
  "pipeline": {
    "build": {
      // 先构建依赖包，再构建当前包
      "dependsOn": ["^build"],
      // 构建输出目录（缓存这些目录）
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      // 开发模式不缓存
      "cache": false,
      // 持续运行（不退出）
      "persistent": true
    },
    "lint": {
      // lint 依赖依赖包先构建完成
      "dependsOn": ["^build"]
    },
    "test": {
      // 测试依赖当前包先构建完成
      "dependsOn": ["build"]
    }
  }
}
```

### 配置项逐项解析

| 配置项 | 值 | 含义 |
|--------|---|------|
| `dependsOn: ["^build"]` | `^` 前缀 | 先执行所有依赖包的 `build`，再执行当前包的 |
| `dependsOn: ["build"]` | 无前缀 | 先执行当前包的 `build`，再执行当前任务 |
| `outputs: ["dist/**"]` | glob 模式 | 缓存这些输出目录 |
| `cache: false` | boolean | 禁用缓存（每次重新执行） |
| `persistent: true` | boolean | 标记为长期运行任务（如 dev server） |

### 任务依赖关系图

```mermaid
graph TD
    subgraph "packages/shared"
        SB["build"]
        SL["lint"]
        ST["test"]
    end

    subgraph "apps/server"
        RB["build"]
        RL["lint"]
        RT["test"]
    end

    subgraph "apps/web"
        WB["build"]
        WL["lint"]
        WT["test"]
    end

    SB -->|"dependsOn: ^build"| RB
    SB -->|"dependsOn: ^build"| WB
    RB -->|"dependsOn: build"| RT
    WB -->|"dependsOn: build"| WT
    SB -->|"dependsOn: build"| ST

    SB --> SL
    RB --> RL
    WB --> WL

    style SB fill:#4CAF50,stroke:#333,color:#fff
    style RB fill:#2196F3,stroke:#333,color:#fff
    style WB fill:#FF9800,stroke:#333,color:#fff
```

## 13.3 Turborepo 缓存机制

### 本地缓存

```mermaid
flowchart TD
    A["turbo run build"] --> B["计算任务哈希"]
    B --> C{缓存命中?}
    C -->|"是"| D["✅ 直接使用缓存输出\n(跳过执行)"]
    C -->|"否"| E["执行任务"]
    E --> F["保存输出到缓存"]
    F --> G["✅ 返回结果"]

    style D fill:#4CAF50,stroke:#333,color:#fff
    style G fill:#4CAF50,stroke:#333,color:#fff
```

### 哈希计算因素

| 因素 | 说明 | 示例 |
|------|------|------|
| 源代码文件 | 任务相关的所有源文件 | `src/**/*.ts` |
| 依赖锁定文件 | `pnpm-lock.yaml` | 依赖版本变化 |
| 环境变量 | `globalDependencies` 中的 | `.env.local` |
| 任务配置 | `turbo.json` 中的配置 | `dependsOn`、`outputs` |
| 根 package.json | 根目录的配置 | 脚本、依赖 |

### 缓存效果对比

```bash
# 第一次构建（无缓存）
$ turbo run build
Tasks: 3 successful, 3 total
Time: 45s

# 第二次构建（全部缓存命中）
$ turbo run build
Tasks: 3 cached, 3 total
Time: 0.5s  ← 90x 加速！

# 修改 shared 包后构建
$ turbo run build
Tasks: 2 cached, 1 modified, 3 total
Time: 15s  ← 只重新构建 shared + 依赖它的包
```

## 13.4 pnpm Workspace 与 Turborepo 协作

```mermaid
graph LR
    subgraph "pnpm workspace.yaml"
        PW["packages:\n  - 'packages/*'\n  - 'apps/*'"]
    end

    subgraph "turbo.json"
        TJ["pipeline:\n  build, dev, lint, test"]
    end

    subgraph "实际执行"
        PNPM["pnpm install\n统一安装依赖"]
        TURBO["turbo run build\n智能编排构建"]
        CACHE["缓存系统\n增量+并行"]
    end

    PW --> PNPM
    TJ --> TURBO
    PNPM --> TURBO
    TURBO --> CACHE

    style PNPM fill:#f44336,stroke:#333,color:#fff
    style TURBO fill:#FF9800,stroke:#333,color:#fff
```

### pnpm-workspace.yaml

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'  # 共享包
  - 'apps/*'      # 应用
```

### 包之间的依赖关系

```jsonc
// apps/server/package.json
{
  "dependencies": {
    "@ai-cli/shared": "workspace:*"  // 引用本地 shared 包
  }
}

// apps/web/package.json
{
  "dependencies": {
    "@ai-cli/shared": "workspace:*"  // 同样引用 shared 包
  }
}
```

---

# 第十四章：DevOps 文化与实践

## 14.1 什么是 DevOps？

DevOps 不是一个工具，不是一个人的职位，而是一种文化和实践。它的核心是打破开发（Dev）和运维（Ops）之间的壁垒。

```mermaid
graph LR
    subgraph "传统模式"
        DEV1["👨‍💻 开发团队"] -->|"扔过墙"| OPS1["🔧 运维团队"]
        OPS1 -->|"出问题了！"| DEV1
    end

    subgraph "DevOps 模式"
        DEV2["👨‍💻 开发"] <-->|"协作"| OPS2["🔧 运维"]
        DEV2 --- AUTO["🤖 自动化"]
        OPS2 --- AUTO
    end

    style DEV1 fill:#4CAF50,stroke:#333,color:#fff
    style OPS1 fill:#FF9800,stroke:#333,color:#fff
    style AUTO fill:#2196F3,stroke:#333,color:#fff
```

## 14.2 DevOps 核心实践（CALMS 模型）

| 实践 | 英文 | 含义 | AI-CLI-Mobile 中的体现 |
|------|------|------|---------------------|
| **文化** | Culture | 共享责任，互相理解 | 全栈开发者，一人负责前后端 |
| **自动化** | Automation | 尽可能自动化一切 | GitHub Actions + Husky + lint-staged |
| **精益** | Lean | 小批量快速交付 | Conventional Commits + 频繁发布 |
| **度量** | Measurement | 用数据驱动改进 | 测试覆盖率 + 性能监控 |
| **分享** | Sharing | 知识共享，文档完善 | 16 篇学习指南 |

## 14.3 DevOps 生命周期

```mermaid
graph TB
    subgraph "DevOps 无限循环"
        PLAN["📋 Plan\n计划"] --> CODE["💻 Code\n编码"]
        CODE --> BUILD["🔨 Build\n构建"]
        BUILD --> TEST["🧪 Test\n测试"]
        TEST --> RELEASE["📦 Release\n发布"]
        RELEASE --> DEPLOY["🚀 Deploy\n部署"]
        DEPLOY --> OPERATE["⚙️ Operate\n运维"]
        OPERATE --> MONITOR["📊 Monitor\n监控"]
        MONITOR --> PLAN
    end

    style PLAN fill:#FF6B6B,stroke:#333,color:#fff
    style CODE fill:#4ECDC4,stroke:#333,color:#fff
    style BUILD fill:#45B7D1,stroke:#333,color:#fff
    style TEST fill:#96CEB4,stroke:#333,color:#fff
    style RELEASE fill:#FFEAA7,stroke:#333,color:#333
    style DEPLOY fill:#DDA0DD,stroke:#333,color:#fff
    style OPERATE fill:#98D8C8,stroke:#333,color:#fff
    style MONITOR fill:#F7DC6F,stroke:#333,color:#333
```

### 各阶段实践

| 阶段 | 工具/实践 | AI-CLI-Mobile 中的应用 |
|------|---------|---------------------|
| **Plan** | Jira, GitHub Issues | GitHub Issues + Projects |
| **Code** | IDE, Git | VS Code + Git + pnpm |
| **Build** | Webpack, Turbo | Turborepo + Vite |
| **Test** | Vitest, Playwright | Vitest + Playwright |
| **Release** | semantic-release | GitHub Actions + Docker |
| **Deploy** | Docker, K8s | Docker + docker-compose |
| **Operate** | 监控, 日志 | PM2 + 日志系统 |
| **Monitor** | APM, 告警 | 健康检查端点 |

## 14.4 DevOps 工具链全景

```mermaid
graph TB
    subgraph "代码管理"
        GIT["Git"]
        GH["GitHub"]
    end

    subgraph "CI/CD"
        GHA["GitHub Actions"]
        JENKINS["Jenkins"]
    end

    subgraph "代码质量"
        ESLINT["ESLint"]
        PRETTIER["Prettier"]
        VITEST["Vitest"]
    end

    subgraph "容器化"
        DOCKER["Docker"]
        DC["Docker Compose"]
    end

    subgraph "编排"
        K8S["Kubernetes"]
        HELM["Helm"]
    end

    subgraph "监控"
        PROM["Prometheus"]
        GRAF["Grafana"]
    end

    subgraph "日志"
        ELK["ELK Stack"]
        LOKI["Loki"]
    end

    GIT --> GH --> GHA
    GHA --> ESLINT
    GHA --> PRETTIER
    GHA --> VITEST
    GHA --> DOCKER
    DOCKER --> K8S
    K8S --> PROM --> GRAF
    K8S --> LOKI

    style GHA fill:#2088FF,stroke:#333,color:#fff
    style DOCKER fill:#2496ED,stroke:#333,color:#fff
    style K8S fill:#326CE5,stroke:#333,color:#fff
```

## 14.5 DevOps 度量指标（DORA 四大指标）

Google 的 DORA 团队定义了四个衡量 DevOps 能力的关键指标：

| 指标 | 英文 | 精英团队 | 优秀团队 | 一般团队 | 低效团队 |
|------|------|---------|---------|---------|---------|
| **部署频率** | Deployment Frequency | 按需（每天多次） | 每天到每周 | 每月到每季 | 每半年+ |
| **变更前置时间** | Lead Time for Changes | < 1小时 | 1天到1周 | 1月到6月 | 6月+ |
| **变更失败率** | Change Failure Rate | 0-15% | 16-30% | 16-30% | 46-60% |
| **恢复时间** | Time to Restore | < 1小时 | < 1天 | 1天到1周 | 1周+ |

```mermaid
graph LR
    subgraph "精英团队 🏆"
        E1["部署：每天多次"]
        E2["前置时间：< 1小时"]
        E3["失败率：< 15%"]
        E4["恢复：< 1小时"]
    end

    subgraph "目标"
        T["提高这四个指标\n= 提升 DevOps 能力"]
    end

    E1 --> T
    E2 --> T
    E3 --> T
    E4 --> T

    style E1 fill:#FFD700,stroke:#333,color:#333
    style T fill:#4CAF50,stroke:#333,color:#fff
```

## 14.6 基础设施即代码（IaC）

### 什么是 IaC？

把基础设施的配置写成代码，纳入版本控制，实现可重复、可审计的基础设施管理。

```mermaid
graph TD
    subgraph "传统方式（手动）"
        M1["SSH 到服务器"]
        M2["手动安装软件"]
        M3["手动配置文件"]
        M4["手动启动服务"]
        M5["出了问题\n不知道改了什么"]
    end

    subgraph "IaC 方式（代码）"
        I1["编写配置文件"]
        I2["git commit"]
        I3["自动执行配置"]
        I4["环境可重复创建"]
        I5["git log 查看历史"]
    end

    style M5 fill:#f44336,stroke:#333,color:#fff
    style I5 fill:#4CAF50,stroke:#333,color:#fff
```

### IaC 工具对比

| 工具 | 类型 | 适用场景 | 学习曲线 |
|------|------|---------|---------|
| **Terraform** | 声明式 | 云基础设施（AWS/GCP/Azure） | 中 |
| **Ansible** | 命令式 | 服务器配置管理 | 低 |
| **Pulumi** | 编程式 | 云基础设施（用编程语言） | 中 |
| **CloudFormation** | 声明式 | AWS 专用 | 中 |
| **Docker Compose** | 声明式 | 容器编排（单机） | 低 |
| **Kubernetes YAML** | 声明式 | 容器编排（集群） | 高 |

### AI-CLI-Mobile 的 IaC 实践

```yaml
# docker-compose.yml —— 容器编排即代码
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "${PORT:-3000}:3000"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

## 14.7 监控与可观测性

### 三大支柱

```mermaid
graph TB
    subgraph "可观测性三大支柱"
        LOGS["📋 日志 Logs\n发生了什么"]
        METRICS["📊 指标 Metrics\n整体状态如何"]
        TRACES["🔍 链路追踪 Traces\n请求经过了哪里"]
    end

    APP["应用程序"] --> LOGS
    APP --> METRICS
    APP --> TRACES

    LOGS --> ALERT["🚨 告警"]
    METRICS --> ALERT
    TRACES --> ALERT

    style LOGS fill:#4CAF50,stroke:#333,color:#fff
    style METRICS fill:#2196F3,stroke:#333,color:#fff
    style TRACES fill:#FF9800,stroke:#333,color:#fff
```

### 健康检查端点

```typescript
// apps/server/src/routes/health.ts
import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  // 基础健康检查（存活探针）
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // 详细健康检查（就绪探针）
  app.get('/health/ready', async (request, reply) => {
    const checks = {
      database: await checkDatabase(),
      redis: await checkRedis(),
      docker: await checkDocker(),
    };

    const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

    if (!allHealthy) {
      return reply.status(503).send({
        status: 'not ready',
        checks,
      });
    }

    return { status: 'ready', checks };
  });
}
```

## 14.8 安全左移（Shift Left Security）

### 什么是安全左移？

在开发生命周期的早期就引入安全检查，而不是等到部署前才做安全审查。

```mermaid
flowchart LR
    subgraph "传统方式"
        direction LR
        A1["编码"] --> B1["测试"] --> C1["部署"] --> D1["🔒 安全检查"]
        D1 -->|"发现问题，推倒重来"| A1
    end

    subgraph "安全左移"
        direction LR
        A2["🔒 编码时检查"] --> B2["🔒 测试时扫描"] --> C2["🔒 构建时审计"] --> D2["✅ 安全部署"]
    end

    style D1 fill:#f44336,stroke:#333,color:#fff
    style D2 fill:#4CAF50,stroke:#333,color:#fff
```

### AI-CLI-Mobile 的安全实践

| 阶段 | 工具/实践 | 检查内容 |
|------|---------|---------|
| **编码时** | ESLint 安全规则 | 不安全的代码模式 |
| **提交时** | Husky + lint-staged | 代码质量、密钥泄露 |
| **CI 时** | `pnpm audit` | 依赖漏洞扫描 |
| **构建时** | Docker 扫描（Trivy） | 镜像漏洞 |
| **部署时** | 环境变量检查 | 敏感信息不硬编码 |

## 14.9 从零开始的 DevOps 路线图

```mermaid
flowchart TD
    subgraph "第一阶段：基础"
        A1["学会 Git 基本操作"]
        A2["理解 CI/CD 概念"]
        A3["配置 GitHub Actions"]
        A1 --> A2 --> A3
    end

    subgraph "第二阶段：代码质量"
        B1["配置 ESLint + Prettier"]
        B2["设置 Husky + lint-staged"]
        B3["学习 Conventional Commits"]
        A3 --> B1 --> B2 --> B3
    end

    subgraph "第三阶段：测试"
        C1["编写单元测试"]
        C2["编写集成测试"]
        C3["配置 E2E 测试"]
        B3 --> C1 --> C2 --> C3
    end

    subgraph "第四阶段：容器化"
        D1["学习 Docker 基础"]
        D2["编写 Dockerfile"]
        D3["使用 Docker Compose"]
        C3 --> D1 --> D2 --> D3
    end

    subgraph "第五阶段：部署"
        E1["自动化部署脚本"]
        E2["蓝绿/金丝雀部署"]
        E3["监控和告警"]
        D3 --> E1 --> E2 --> E3
    end

    subgraph "第六阶段：进阶"
        F1["Kubernetes"]
        F2["Terraform/IaC"]
        F3["服务网格"]
        E3 --> F1 --> F2 --> F3
    end

    style A1 fill:#E8F5E9,stroke:#333
    style F3 fill:#FF9800,stroke:#333,color:#fff
```

---

## 附录 A：常用命令速查

### CI/CD 相关 Git 命令

```bash
# 打版本标签
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 查看标签
git tag -l "v*"

# 回滚到某个标签
git checkout v1.0.0

# 创建发布分支
git checkout -b release/v1.1.0
```

### Docker 常用命令

```bash
# 构建镜像
docker build -t ai-cli-mobile:latest .

# 运行容器
docker run -d -p 3000:3000 --name app ai-cli-mobile:latest

# 查看日志
docker logs -f app

# 健康检查
docker inspect --format='{{.State.Health.Status}}' app

# 导出/导入镜像
docker save ai-cli-mobile:latest > app.tar
docker load < app.tar
```

### GitHub CLI 命令

```bash
# 创建 Release
gh release create v1.0.0 --title "v1.0.0" --notes "Initial release"

# 查看 Workflow 运行状态
gh run list

# 查看 Workflow 日志
gh run view <run-id> --log

# 手动触发 Workflow
gh workflow run ci.yml
```

## 附录 B：常见 CI/CD 错误排查

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `pnpm install` 失败 | lock 文件过时 | 本地运行 `pnpm install` 更新 lock 文件 |
| ESLint 报错 | 代码不符合规范 | 本地运行 `pnpm lint --fix` 自动修复 |
| TypeScript 类型错误 | 类型不匹配 | 检查类型定义，修复类型错误 |
| Docker 构建失败 | Dockerfile 语法错误 | 本地 `docker build .` 测试 |
| 测试失败 | 代码变更导致 | 本地 `pnpm test` 运行测试 |
| 缓存失效 | 依赖变更 | 正常现象，重新构建即可 |
| 权限不足 | GitHub Token 权限 | 检查 `permissions` 配置 |
| Runner 超时 | 任务执行过长 | 拆分任务或优化构建 |

## 附录 C：CI/CD 最佳实践清单

### ✅ 应该做的

- [ ] 每次提交都运行自动化测试
- [ ] 使用 `--frozen-lockfile` 锁定依赖版本
- [ ] 配置代码质量检查（ESLint + Prettier）
- [ ] 使用 Conventional Commits 规范
- [ ] Docker 镜像使用多阶段构建
- [ ] 使用缓存加速 CI 构建
- [ ] 设置超时防止 CI 挂起
- [ ] 保护主分支（需 PR + 审查）
- [ ] 使用 `.env.example` 文档化环境变量
- [ ] 定期更新依赖（Dependabot/Renovate）

### ❌ 不应该做的

- [ ] ❌ 在 CI 中使用 `latest` 标签
- [ ] ❌ 硬编码密钥或密码
- [ ] ❌ 跳过测试直接部署
- [ ] ❌ 在 Dockerfile 中使用 `apt-get upgrade`
- [ ] ❌ 使用 root 用户运行容器
- [ ] ❌ 不设置健康检查
- [ ] ❌ 在主分支上直接 push 大改动
- [ ] ❌ 忽略 CI 失败继续开发
- [ ] ❌ 不监控生产环境
- [ ] ❌ 不做回滚演练

---

## 总结

本篇我们全面学习了 CI/CD 与 DevOps 的核心知识：

```mermaid
mindmap
  root((CI/CD & DevOps))
    CI/CD 基础
      持续集成
      持续交付
      持续部署
    CI 工具
      GitHub Actions
      GitLab CI
      Jenkins
    代码质量
      ESLint
      Prettier
      Stylelint
      TypeScript
    Git 工作流
      Husky
      lint-staged
      Conventional Commits
      SemVer
    部署策略
      蓝绿部署
      金丝雀发布
      滚动更新
    构建工具
      Turborepo
      Docker
    DevOps 文化
      自动化
      可观测性
      安全左移
      IaC
```

> 📖 **关键要点**：
> 1. **CI/CD 的核心**是自动化——从代码提交到部署上线，尽可能减少人工干预
> 2. **代码质量**是基础——ESLint + Prettier + lint-staged 在提交前就把问题拦住
> 3. **Git Hooks** 是本地 CI——Husky 让团队规范成为自动执行的代码
> 4. **Turborepo** 让 Monorepo 构建更快——智能缓存 + 并行执行
> 5. **部署策略**决定发布风险——蓝绿部署适合关键业务，滚动更新适合一般服务
> 6. **DevOps 是文化**——不只是工具，更是协作方式和思维方式的转变

---

---

## 附录 D：GitHub Actions 高级特性

### D.1 可复用工作流（Reusable Workflows）

当多个仓库需要相同的 CI 流程时，可以将工作流抽成可复用的模板。

```yaml
# .github/workflows/reusable-lint-test.yml
# 这是一个可复用工作流模板

name: Reusable Lint and Test

on:
  workflow_call:
    # 定义输入参数
    inputs:
      node-version:
        description: 'Node.js version'
        required: false
        default: '20'
        type: string
      pnpm-version:
        description: 'pnpm version'
        required: false
        default: '8.15.4'
        type: string
      run-e2e:
        description: 'Whether to run E2E tests'
        required: false
        default: false
        type: boolean
    # 定义 Secrets
    secrets:
      NPM_TOKEN:
        required: false

jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: ${{ inputs.pnpm-version }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm build

      - name: Test
        run: pnpm test

      - name: E2E tests
        if: ${{ inputs.run-e2e }}
        run: pnpm e2e
```

```yaml
# .github/workflows/ci.yml
# 调用可复用工作流

name: CI
on: [push, pull_request]

jobs:
  lint-and-test:
    uses: ./.github/workflows/reusable-lint-test.yml
    with:
      node-version: '20'
      run-e2e: true
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### D.2 复合动作（Composite Actions）

复合动作是将多个步骤封装为一个可复用的动作。

```yaml
# .github/actions/setup-project/action.yml
name: 'Setup Project'
description: 'Install dependencies and setup environment'

inputs:
  node-version:
    description: 'Node.js version'
    required: false
    default: '20'

runs:
  using: 'composite'
  steps:
    - name: Setup pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 8.15.4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: 'pnpm'

    - name: Install dependencies
      shell: bash
      run: pnpm install --frozen-lockfile

    - name: Cache Turbo
      uses: actions/cache@v4
      with:
        path: .turbo
        key: turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-${{ github.sha }}
        restore-keys: |
          turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}-
          turbo-${{ runner.os }}-
```

在 Workflow 中使用：

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-project
      - run: pnpm build
```

### D.3 矩阵策略进阶

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      # 当一个矩阵任务失败时，不取消其他任务
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18, 20, 22]
        # 排除特定组合
        exclude:
          - os: windows-latest
            node-version: 18
        # 添加额外的矩阵项
        include:
          - os: ubuntu-latest
            node-version: 20
            experimental: true

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
        continue-on-error: ${{ matrix.experimental || false }}
```

### D.4 环境保护规则

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    # 使用 "production" 环境（需在 GitHub 仓库设置中创建）
    environment:
      name: production
      url: https://ai-cli-mobile.example.com
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: ./deploy.sh
        env:
          DEPLOY_KEY: ${{ secrets.PRODUCTION_DEPLOY_KEY }}
```

在 GitHub 仓库的 Settings > Environments 中可以配置：
- **必需审查者**：部署前需要指定人员批准
- **等待计时器**：部署前等待指定时间
- **分支限制**：只有特定分支可以部署
- **环境 Secrets**：环境级别的加密变量

### D.5 并发控制

```yaml
# 防止同时运行多个部署
concurrency:
  group: production-deploy
  # 取消正在运行的部署（只保留最新的）
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: ./deploy.sh
```

### D.6 手动触发（workflow_dispatch）

```yaml
name: Manual Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deploy to which environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      version:
        description: 'Version to deploy (e.g., v1.0.0)'
        required: true
        type: string
      dry-run:
        description: 'Dry run (no actual deploy)'
        required: false
        default: false
        type: boolean

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.version }}

      - name: Deploy to ${{ inputs.environment }}
        if: ${{ !inputs.dry-run }}
        run: |
          echo "Deploying ${{ inputs.version }} to ${{ inputs.environment }}"
          ./deploy.sh --env ${{ inputs.environment }}

      - name: Dry run
        if: ${{ inputs.dry-run }}
        run: echo "Dry run: would deploy ${{ inputs.version }} to ${{ inputs.environment }}"
```

### D.7 通知集成

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm build

      # Slack 通知
      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "❌ Build failed for ${{ github.repository }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Build Failed*\nRepository: `${{ github.repository }}`\nBranch: `${{ github.ref_name }}`\nCommit: `${{ github.sha }}`\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Details>"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 附录 E：Docker 深入解析

### E.1 多阶段构建详解

AI-CLI-Mobile 的 Dockerfile 采用了三阶段构建，让我们详细分析每一阶段的作用和原理。

```dockerfile
# ============================================================
# Stage 1: deps — 安装所有依赖（包括 devDependencies）
# ============================================================
FROM node:20-bookworm-slim AS deps

# 启用 corepack 并准备 pnpm
# corepack 是 Node.js 内置的包管理器管理工具
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# 安装编译工具（node-pty 等原生模块需要）
# build-essential: gcc, g++, make
# python3: node-gyp 需要
# git: 某些包的安装脚本需要
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先只复制依赖相关文件（利用 Docker 缓存层）
# 如果这些文件没变，就不需要重新安装依赖
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/ packages/
COPY apps/ apps/

# 安装所有依赖
RUN pnpm install --frozen-lockfile

# ============================================================
# Stage 2: build — 编译 TypeScript
# ============================================================
FROM deps AS build

# 运行 turbo build，编译所有包的 TypeScript
RUN pnpm build

# ============================================================
# Stage 3: runtime — 最小化生产镜像
# ============================================================
FROM node:20-bookworm-slim AS runtime

# tini: PID 1 进程初始化器
# - 正确转发信号（SIGTERM 等）
# - 回收僵尸进程
# tmux: 终端会话持久化
# python3: CLI 工具运行时依赖
# ca-certificates: TLS 证书
# 然后删除编译器和 pip，防止被用于构建攻击
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini tmux python3 ca-certificates \
    && apt-get purge -y gcc g++ make \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /usr/bin/pip* /usr/bin/pip3* /usr/local/bin/pip*

# 创建非 root 用户（安全最佳实践）
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# 从 build 阶段只复制编译产物（不复制源代码）
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/

# 只安装生产依赖（不含 devDependencies）
COPY --from=build /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json /app/turbo.json ./
RUN corepack enable && corepack prepare pnpm@8.15.4 --activate \
    && pnpm install --frozen-lockfile --prod \
    && pnpm store prune

# 切换到非 root 用户
USER appuser

# 使用 tini 作为 PID 1 进程
# 这确保了信号正确转发和僵尸进程回收
ENTRYPOINT ["tini", "--"]

# 启动应用
CMD ["node", "apps/server/dist/index.js"]
```

### 多阶段构建的优势

```mermaid
graph LR
    subgraph "不做多阶段构建"
        A1["源代码"] --> A2["编译工具"] --> A3["devDeps"] --> A4["编译产物"] --> A5["生产依赖"]
        A5 --> A6["❌ 所有层都在最终镜像中
镜像巨大：1.2GB+\n包含源代码和编译器"]
    end

    subgraph "多阶段构建"
        B1["Stage 1: 安装依赖"] --> B2["Stage 2: 编译"] --> B3["Stage 3: 只复制产物"]
        B3 --> B4["✅ 最终镜像只有运行时必需品
镜像精简：200MB\n不含源代码和编译器"]
    end

    style A6 fill:#f44336,stroke:#333,color:#fff
    style B4 fill:#4CAF50,stroke:#333,color:#fff
```

### E.2 Docker 镜像优化技巧

| 技巧 | 说明 | 效果 |
|------|------|------|
| **使用 slim 基础镜像** | `node:20-bookworm-slim` vs `node:20` | 减少 200MB+ |
| **合并 RUN 指令** | 每个 RUN 创建一层，合并减少层数 | 减少 50MB+ |
| **清理缓存** | `rm -rf /var/lib/apt/lists/*` | 减少 30MB+ |
| **多阶段构建** | 编译阶段和运行阶段分离 | 减少 500MB+ |
| **只复制需要的文件** | COPY 特定文件而非整个目录 | 减少重建时间 |
| **.dockerignore** | 排除 node_modules、.git 等 | 减少构建上下文大小 |
| **使用 BuildKit 缓存** | `cache-from: type=gha` | 加速 CI 构建 |

### E.3 .dockerignore 文件

```bash
# .dockerignore

# Git
.git
.gitignore

# 依赖（会在 Docker 内重新安装）
node_modules

# 构建产物
*.tsbuildinfo
dist
.next
.turbo

# IDE
.vscode
.idea
*.swp

# 文档
*.md
docs
LICENSE

# 测试
e2e
coverage

# CI/CD
.github
.gitlab-ci.yml

# Docker 自身
Dockerfile
docker-compose*.yml
docker

# 环境变量（敏感信息）
.env
.env.*
!.env.example
```

### E.4 Docker Compose 详解

```yaml
# docker-compose.yml
version: '3.8'

services:
  # ========== 应用服务 ==========
  app:
    build:
      context: .
      dockerfile: docker/Dockerfile
      # 构建参数
      args:
        NODE_ENV: production
    image: ai-cli-mobile:latest
    container_name: ai-cli-mobile
    ports:
      - "${PORT:-3000}:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - TZ=Asia/Shanghai
    # 重启策略
    restart: unless-stopped
    # 健康检查
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
    # 日志配置
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    # 安全配置
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
    # 网络
    networks:
      - app-network

# 自定义网络
networks:
  app-network:
    driver: bridge
```

### E.5 Docker 安全最佳实践

```mermaid
graph TB
    subgraph "Docker 安全清单"
        S1["✅ 使用非 root 用户"]
        S2["✅ 使用 tini 作为 PID 1"]
        S3["✅ 只读文件系统"]
        S4["✅ 限制资源（CPU/内存）"]
        S5["✅ 删除不必要的工具"]
        S6["✅ 使用 slim 基础镜像"]
        S7["✅ 定期扫描镜像漏洞"]
        S8["✅ 使用 --no-new-privileges"]
        S9["✅ 不在镜像中存储密钥"]
        S10["✅ 使用 .dockerignore"]
    end

    style S1 fill:#4CAF50,stroke:#333,color:#fff
    style S9 fill:#f44336,stroke:#333,color:#fff
```

---

## 附录 F：Git 分支策略与发布流程

### F.1 常见分支策略

```mermaid
graph LR
    subgraph "Git Flow"
        GF_MAIN["main"] --> GF_DEV["develop"]
        GF_DEV --> GF_FEAT["feature/*"]
        GF_DEV --> GF_REL["release/*"]
        GF_REL --> GF_MAIN
        GF_MAIN --> GF_HOT["hotfix/*"]
        GF_HOT --> GF_MAIN
    end

    subgraph "GitHub Flow"
        GH_MAIN["main"] --> GH_FEAT["feature branch"]
        GH_FEAT --> GH_PR["Pull Request"]
        GH_PR --> GH_MAIN
    end

    subgraph "Trunk Based"
        TB_MAIN["main (trunk)"] --> TB_SHORT["short-lived branches"]
        TB_SHORT --> TB_MAIN
    end
```

### 分支策略对比

| 策略 | 复杂度 | 适用场景 | 发布节奏 | AI-CLI-Mobile 推荐 |
|------|--------|---------|---------|-------------------|
| **Git Flow** | 高 | 大型项目，多版本并行 | 按版本发布 | ❌ 过于复杂 |
| **GitHub Flow** | 低 | 持续部署的 Web 应用 | 持续发布 | ✅ 推荐 |
| **Trunk Based** | 中 | 高性能团队，Feature Flags | 持续发布 | ⚠️ 需要 Feature Flags |

### F.2 GitHub Flow 详解（推荐）

```mermaid
sequenceDiagram
    participant Dev as 开发者
    participant Main as main 分支
    participant Feat as feature 分支
    participant CI as CI 流水线
    participant Rev as 审查者

    Dev->>Main: git checkout -b feature/terminal-persistence
    Dev->>Feat: 开发功能...
    Dev->>Feat: git commit (多次)
    Dev->>Feat: git push origin feature/terminal-persistence
    Dev->>Main: 创建 Pull Request
    CI->>CI: 自动运行测试
    CI-->>Main: ✅ 测试通过
    Rev->>Main: Code Review
    Rev->>Main: Approve
    Dev->>Main: Merge to main
    CI->>CI: 自动构建 Docker 镜像
    CI->>CI: 自动部署到生产
```

### F.3 发布流程

```bash
# 1. 确保 main 分支是最新的
git checkout main
git pull origin main

# 2. 运行本地检查
pnpm lint
pnpm test
pnpm build

# 3. 更新版本号
# 手动方式：
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# 4. 推送 tag（触发 CI 自动发布）
git push origin main --tags

# 5. CI 自动执行：
# - 构建 Docker 镜像
# - 推送到 GHCR
# - 生成 CHANGELOG
# - 创建 GitHub Release
```

---

## 附录 G：Monorepo CI/CD 特殊考量

### G.1 只测试变更的包

在 Monorepo 中，如果只修改了一个包，不需要测试所有包。

```yaml
# 智能检测变更的包
jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.changes.outputs.web }}
      server: ${{ steps.changes.outputs.server }}
      shared: ${{ steps.changes.outputs.shared }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: changes
        with:
          filters: |
            web:
              - 'apps/web/**'
              - 'packages/shared/**'
            server:
              - 'apps/server/**'
              - 'packages/shared/**'
            shared:
              - 'packages/shared/**'

  test-web:
    needs: detect-changes
    if: needs.detect-changes.outputs.web == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-project
      - run: pnpm --filter web test

  test-server:
    needs: detect-changes
    if: needs.detect-changes.outputs.server == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-project
      - run: pnpm --filter server test
```

### G.2 Turborepo 远程缓存

```yaml
# 在 CI 中使用 Turborepo 远程缓存
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
    steps:
      - uses: actions/checkout@v4
      - uses: ./.github/actions/setup-project
      - run: pnpm build
        # Turborepo 会自动使用远程缓存
      - run: pnpm test
```

### G.3 版本管理策略

```mermaid
graph TD
    subgraph "独立版本管理"
        IV1["packages/shared: v1.2.0"]
        IV2["apps/server: v2.1.0"]
        IV3["apps/web: v3.0.1"]
    end

    subgraph "统一版本管理"
        UV["所有包: v1.0.0"]
    end

    subgraph "锁定版本管理"
        LV1["packages/shared: v1.0.0"]
        LV2["apps/server: v1.0.0"]
        LV3["apps/web: v1.0.0"]
        LV1 --> LV2
        LV1 --> LV3
    end

    style IV1 fill:#4CAF50,stroke:#333,color:#fff
    style UV fill:#2196F3,stroke:#333,color:#fff
    style LV1 fill:#FF9800,stroke:#333,color:#fff
```

---

## 附录 H：性能优化技巧

### H.1 CI 流水线加速

| 优化手段 | 预期加速 | 实现复杂度 | 说明 |
|---------|---------|-----------|------|
| **依赖缓存** | 50-70% | 低 | 缓存 node_modules |
| **构建缓存（Turbo）** | 60-90% | 低 | 增量构建 |
| **Docker 层缓存** | 30-50% | 中 | 缓存 Docker 构建层 |
| **并行 Job** | 30-50% | 低 | 独立任务并行执行 |
| **只测试变更** | 40-60% | 中 | Monorepo 智能检测 |
| **远程缓存** | 50-80% | 中 | 团队共享构建缓存 |
| **自托管 Runner** | 20-40% | 高 | 无排队等待 |
| **Docker 预构建镜像** | 40-60% | 中 | 预装依赖的基础镜像 |

### H.2 缓存命中率监控

```bash
# Turborepo 缓存统计
turbo run build --summarize

# 查看缓存命中率
cat .turbo/runs/*.json | jq '.tasks[] | {taskId, cacheStatus, duration}'
```

### H.3 CI 成本优化

```mermaid
graph TD
    A["CI 成本分析"] --> B["计算时间"]
    A --> C["存储成本"]
    A --> D["网络传输"]

    B --> B1["优化：缓存 + 并行"]
    C --> C1["优化：定期清理缓存"]
    D --> D1["优化：本地缓存 + 压缩"]

    B1 --> E["💰 月度 CI 成本降低 60%"]
    C1 --> E
    D1 --> E

    style E fill:#4CAF50,stroke:#333,color:#fff
```

---

## 附录 I：常见面试题

### I.1 基础概念

**Q1: CI 和 CD 有什么区别？**

A: CI（持续集成）是频繁合并代码并自动验证；CD 可以是持续交付（随时可部署）或持续部署（自动部署）。CI 关注代码质量，CD 关注交付速度。

**Q2: 为什么需要 CI/CD？**

A: 减少人工错误、加速反馈循环、提高代码质量、降低发布风险、实现快速迭代。

**Q3: 什么是蓝绿部署？**

A: 维护两个完全相同的环境（蓝和绿），一个对外服务，另一个部署新版本。验证无误后切换流量。回滚只需切回原环境。

### I.2 工具使用

**Q4: GitHub Actions 中 `needs` 和 `if` 的区别？**

A: `needs` 定义 Job 之间的依赖关系（必须先完成）；`if` 定义 Job 执行的条件（是否运行）。两者可以组合使用。

**Q5: 为什么 Docker 要用多阶段构建？**

A: 分离编译环境和运行环境，最终镜像不包含源代码和编译工具，更小更安全。

**Q6: Husky 的 `prepare` 脚本有什么作用？**

A: `prepare` 在 `pnpm install` 后自动执行，用于初始化 Husky Git Hooks。这样新成员克隆仓库后运行 install 就自动配置好了。

### I.3 实践问题

**Q7: 如何处理 CI 中的 flaky tests（不稳定测试）？**

A: 1) 识别不稳定测试；2) 添加重试机制；3) 隔离外部依赖；4) 修复根本原因；5) 将不稳定测试标记为 `skip` 并创建 issue。

**Q8: Monorepo 中如何只测试变更的包？**

A: 使用路径过滤（dorny/paths-filter）检测变更的文件路径，只对受影响的包运行测试。Turborepo 的缓存也能自动跳过未变更的包。

**Q9: 如何回滚一次有问题的部署？**

A: 1) 蓝绿部署：切换流量回旧环境；2) Docker：重新部署旧版本镜像（通过 SHA tag）；3) Kubernetes：`kubectl rollout undo`；4) Git：`git revert` 然后重新触发 CI。

---

## 附录 J：进阶学习资源

### 推荐阅读

| 资源 | 类型 | 链接 | 适合阶段 |
|------|------|------|----------|
| GitHub Actions 官方文档 | 文档 | docs.github.com/actions | 入门 |
| Docker 官方教程 | 教程 | docs.docker.com/get-started | 入门 |
| The Phoenix Project | 书籍 | - | 理解 DevOps 文化 |
| Accelerate | 书籍 | - | 度量 DevOps 能力 |
| Continuous Delivery | 书籍 | - | 深入 CD 实践 |
| Kubernetes in Action | 书籍 | - | K8s 进阶 |
| Terraform Up & Running | 书籍 | - | IaC 实践 |

### 推荐工具

| 类别 | 工具 | 用途 |
|------|------|------|
| CI/CD | GitHub Actions | GitHub 原生 CI/CD |
| CI/CD | GitLab CI | GitLab 原生 CI/CD |
| 容器 | Docker | 容器化 |
| 容器编排 | Kubernetes | 大规模容器管理 |
| IaC | Terraform | 基础设施即代码 |
| 监控 | Prometheus + Grafana | 指标收集和可视化 |
| 日志 | Loki + Grafana | 日志聚合 |
| 镜像扫描 | Trivy | Docker 镜像漏洞扫描 |
| 依赖更新 | Renovate / Dependabot | 自动更新依赖 |
| 密钥管理 | HashiCorp Vault | 密钥存储 |
| 服务网格 | Istio | 微服务通信管理 |
| Feature Flags | LaunchDarkly | 功能开关管理 |

---

## 总结

本篇我们全面学习了 CI/CD 与 DevOps 的核心知识：

```mermaid
mindmap
  root((CI/CD & DevOps))
    CI/CD 基础
      持续集成
      持续交付
      持续部署
    CI 工具
      GitHub Actions
      GitLab CI
      Jenkins
    代码质量
      ESLint
      Prettier
      Stylelint
      TypeScript
    Git 工作流
      Husky
      lint-staged
      Conventional Commits
      SemVer
    部署策略
      蓝绿部署
      金丝雀发布
      滚动更新
    构建工具
      Turborepo
      Docker
    DevOps 文化
      自动化
      可观测性
      安全左移
      IaC
```

> 📖 **关键要点**：
> 1. **CI/CD 的核心**是自动化——从代码提交到部署上线，尽可能减少人工干预
> 2. **代码质量**是基础——ESLint + Prettier + lint-staged 在提交前就把问题拦住
> 3. **Git Hooks** 是本地 CI——Husky 让团队规范成为自动执行的代码
> 4. **Turborepo** 让 Monorepo 构建更快——智能缓存 + 并行执行
> 5. **部署策略**决定发布风险——蓝绿部署适合关键业务，滚动更新适合一般服务
> 6. **DevOps 是文化**——不只是工具，更是协作方式和思维方式的转变

> 🎯 **学习建议**：
> 1. 先在自己的项目中配置 GitHub Actions + Husky + lint-staged
> 2. 编写单元测试和集成测试
> 3. 学习 Docker 容器化
> 4. 尝试不同的部署策略
> 5. 关注 DORA 指标，持续改进

---

---

## 附录 K：完整 CI/CD Pipeline 实战模板

### K.1 生产级 GitHub Actions 完整配置

以下是一个适用于中大型项目的完整 CI/CD 配置模板：

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
    tags: ['v*']
  pull_request:
    branches: [main, develop]

# 全局环境变量
env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8.15.4'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

# 全局并发控制
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ============================================================
  # Job 1: 变更检测（Monorepo 优化）
  # ============================================================
  changes:
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.filter.outputs.web }}
      server: ${{ steps.filter.outputs.server }}
      shared: ${{ steps.filter.outputs.shared }}
      docker: ${{ steps.filter.outputs.docker }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            web:
              - 'apps/web/**'
              - 'packages/shared/**'
              - 'pnpm-lock.yaml'
            server:
              - 'apps/server/**'
              - 'packages/shared/**'
              - 'pnpm-lock.yaml'
            shared:
              - 'packages/shared/**'
            docker:
              - 'docker/**'
              - 'Dockerfile'

  # ============================================================
  # Job 2: 代码质量检查
  # ============================================================
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Security audit
        run: pnpm audit --audit-level moderate
        continue-on-error: true

      - name: Lint all packages
        run: pnpm lint

      - name: Type check
        run: pnpm build

      - name: Check formatting
        run: pnpm prettier --check .

  # ============================================================
  # Job 3: 单元测试
  # ============================================================
  unit-test:
    needs: quality
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3]
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests (shard ${{ matrix.shard }})
        run: pnpm test -- --shard=${{ matrix.shard }}/3

      - name: Upload coverage
        if: matrix.shard == 1
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  # ============================================================
  # Job 4: E2E 测试
  # ============================================================
  e2e-test:
    needs: quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Build
        run: pnpm build

      - name: Run E2E tests
        run: pnpm e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7

  # ============================================================
  # Job 5: Docker 构建
  # ============================================================
  docker:
    needs: [quality, unit-test, e2e-test]
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      attestations: write
      id-token: write
    outputs:
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          # 构建参数
          build-args: |
            NODE_VERSION=${{ env.NODE_VERSION }}
            PNPM_VERSION=${{ env.PNPM_VERSION }}

      - name: Generate artifact attestation
        uses: actions/attest-build-provenance@v2
        with:
          subject-name: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          subject-digest: ${{ steps.build.outputs.digest }}
          push-to-registry: true

  # ============================================================
  # Job 6: 部署
  # ============================================================
  deploy:
    needs: docker
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://ai-cli-mobile.example.com
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/ai-cli-mobile
            docker compose pull
            docker compose up -d --remove-orphans
            docker system prune -f
            
            # 健康检查
            for i in $(seq 1 30); do
              if curl -sf http://localhost:3000/health > /dev/null; then
                echo "✅ Health check passed"
                exit 0
              fi
              echo "Waiting for health check... ($i/30)"
              sleep 2
            done
            echo "❌ Health check failed"
            exit 1

      - name: Notify success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ Deployment successful!\nVersion: ${{ github.sha }}\nEnvironment: production"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Notify failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "❌ Deployment failed!\nVersion: ${{ github.sha }}\nRun: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### K.2 CI/CD 流水线执行时序

```mermaid
sequenceDiagram
    participant Dev as 开发者
    participant GH as GitHub
    participant CI as CI Runner
    participant GHCR as GHCR
    participant Server as 生产服务器
    participant Slack as Slack

    Dev->>GH: git push main
    GH->>CI: 触发 Workflow

    par 并行执行
        CI->>CI: quality: lint + type check
    and
        CI->>CI: changes: 检测变更
    end

    quality-->>CI: ✅ 通过

    par 并行执行
        CI->>CI: unit-test: 运行单元测试
    and
        CI->>CI: e2e-test: 运行 E2E 测试
    end

    unit-test-->>CI: ✅ 通过
    e2e-test-->>CI: ✅ 通过

    CI->>CI: docker: 构建镜像
    CI->>GHCR: 推送镜像
    GHCR-->>CI: ✅ 推送成功

    CI->>Server: 部署
    Server->>Server: docker compose up -d
    Server->>Server: 健康检查
    Server-->>CI: ✅ 部署成功

    CI->>Slack: ✅ 部署成功通知
```

### K.3 部署回滚脚本

```bash
#!/bin/bash
# deploy-rollback.sh

set -e

# 获取当前运行的镜像版本
current=$(docker inspect --format='{{.Config.Image}}' ai-cli-mobile 2>/dev/null || echo "unknown")
echo "当前版本: $current"

# 获取上一个版本（通过 GHCR tag 历史）
prev_version=$(curl -s \
  -H "Authorization: Bearer $GHCR_TOKEN" \
  "https://ghcr.io/v2/user/ai-cli-mobile/tags/list" \
  | jq -r '.tags[] | select(startswith("sha-"))' \
  | head -2 | tail -1)

if [ -z "$prev_version" ]; then
  echo "❌ 找不到上一个版本"
  exit 1
fi

echo "回滚到: $prev_version"
read -p "确认回滚？(y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  # 更新 docker-compose.yml 中的镜像版本
  sed -i "s|image:.*|image: ghcr.io/user/ai-cli-mobile:$prev_version|" docker-compose.yml
  
  # 重新部署
  docker compose pull
  docker compose up -d --remove-orphans
  
  # 健康检查
  for i in $(seq 1 30); do
    if curl -sf http://localhost:3000/health > /dev/null; then
      echo "✅ 回滚成功，健康检查通过"
      exit 0
    fi
    sleep 2
  done
  
  echo "❌ 回滚后健康检查失败"
  exit 1
fi

echo "回滚已取消"
```

---

## 附录 L：安全扫描与合规

### L.1 依赖安全扫描

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    # 每周一早上 9 点运行
    - cron: '0 9 * * 1'
  push:
    branches: [main]
  pull_request:

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: moderate

  codeql:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript-typescript
      - uses: github/codeql-action/analyze@v3

  trivy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t scan-target -f docker/Dockerfile .
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'scan-target'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'CRITICAL,HIGH'
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

### L.2 密钥泄露检测

```yaml
  secret-detection:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
```

### L.3 SBOM（软件物料清单）

```yaml
  sbom:
    runs-on: ubuntu-latest
    needs: docker
    steps:
      - uses: actions/checkout@v4
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          image: ghcr.io/${{ github.repository }}:latest
          format: spdx-json
          output-file: sbom.spdx.json
      - uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.spdx.json
```

---

## 附录 M：监控与告警配置

### M.1 Prometheus 指标端点

```typescript
// apps/server/src/metrics.ts
import { FastifyInstance } from 'fastify';
import { Counter, Histogram, Gauge, register } from 'prom-client';

// 请求计数器
const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

// 请求延迟直方图
const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

// WebSocket 连接数
const wsConnections = new Gauge({
  name: 'ws_active_connections',
  help: 'Number of active WebSocket connections',
});

// 终端会话数
const terminalSessions = new Gauge({
  name: 'terminal_active_sessions',
  help: 'Number of active terminal sessions',
});

export async function metricsRoutes(app: FastifyInstance) {
  // Prometheus 指标端点
  app.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
```

### M.2 Grafana Dashboard 配置示例

```json
{
  "dashboard": {
    "title": "AI-CLI-Mobile",
    "panels": [
      {
        "title": "请求速率",
        "type": "graph",
        "targets": [{
          "expr": "rate(http_requests_total[5m])",
          "legendFormat": "{{method}} {{path}}"
        }]
      },
      {
        "title": "响应时间 P99",
        "type": "graph",
        "targets": [{
          "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
          "legendFormat": "P99"
        }]
      },
      {
        "title": "活跃 WebSocket 连接",
        "type": "stat",
        "targets": [{
          "expr": "ws_active_connections"
        }]
      },
      {
        "title": "错误率",
        "type": "graph",
        "targets": [{
          "expr": "rate(http_requests_total{status=~'5..'}[5m]) / rate(http_requests_total[5m]) * 100",
          "legendFormat": "Error %"
        }]
      }
    ]
  }
}
```

### M.3 告警规则

```yaml
# alert-rules.yml (Prometheus AlertManager)
groups:
  - name: ai-cli-mobile
    rules:
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~'5..'}[5m]) 
          / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "P99 latency is {{ $value }}s"

      - alert: ServiceDown
        expr: up{job="ai-cli-mobile"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service is down"

      - alert: HighMemoryUsage
        expr: |
          process_resident_memory_bytes / 1024 / 1024 > 400
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanize }}MB"
```

---

## 附录 N：GitHub Actions 工作流模板库

### N.1 PR 自动标签

```yaml
# .github/workflows/labeler.yml
name: Auto Label

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  label:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/labeler@v5
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
```

```yaml
# .github/labeler.yml
frontend:
  - changed-files:
    - any-glob-to-any-file: 'apps/web/**'

backend:
  - changed-files:
    - any-glob-to-any-file: 'apps/server/**'

documentation:
  - changed-files:
    - any-glob-to-any-file: ['**/*.md', 'docs/**']

docker:
  - changed-files:
    - any-glob-to-any-file: ['docker/**', 'Dockerfile', 'docker-compose*.yml']

ci:
  - changed-files:
    - any-glob-to-any-file: '.github/**'
```

### N.2 Stale PR/Issue 自动关闭

```yaml
# .github/workflows/stale.yml
name: Close Stale Issues and PRs

on:
  schedule:
    - cron: '0 0 * * *'

jobs:
  stale:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v9
        with:
          stale-issue-message: >
            This issue has been automatically marked as stale because it has not had
            recent activity. It will be closed in 7 days if no further activity occurs.
          stale-pr-message: >
            This PR has been automatically marked as stale because it has not had
            recent activity. It will be closed in 7 days if no further activity occurs.
          days-before-stale: 30
          days-before-close: 7
          stale-issue-label: 'stale'
          stale-pr-label: 'stale'
```

### N.3 Release 自动生成

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate changelog
        id: changelog
        uses: orhun/git-cliff-action@v4
        with:
          config: cliff.toml
          args: --latest --strip header
        env:
          OUTPUT: CHANGELOG.md

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          body_path: CHANGELOG.md
          generate_release_notes: true
          files: |
            dist/**
```

---

## 附录 O：术语表

| 术语 | 英文 | 含义 |
|------|------|------|
| 持续集成 | Continuous Integration | 频繁合并代码并自动验证 |
| 持续交付 | Continuous Delivery | 代码随时可部署 |
| 持续部署 | Continuous Deployment | 代码自动部署到生产 |
| 流水线 | Pipeline | 自动化执行的一系列步骤 |
| 工作流 | Workflow | CI/CD 的完整流程定义 |
| 运行器 | Runner | 执行 CI/CD 任务的机器 |
| 制品 | Artifact | 构建过程的输出文件 |
| 缓存 | Cache | 加速构建的临时存储 |
| 镜像 | Image | Docker 的不可变文件系统包 |
| 容器 | Container | Docker 镜像的运行实例 |
| 基础镜像 | Base Image | 构建其他镜像的基础 |
| 多阶段构建 | Multi-stage Build | 分离编译和运行环境 |
| 蓝绿部署 | Blue-Green Deployment | 两个环境切换部署 |
| 金丝雀发布 | Canary Release | 逐步扩大新版本流量 |
| 滚动更新 | Rolling Update | 逐个替换旧版本实例 |
| 回滚 | Rollback | 恢复到上一个版本 |
| 健康检查 | Health Check | 验证服务是否正常运行 |
| 存活探针 | Liveness Probe | 检查容器是否还在运行 |
| 就绪探针 | Readiness Probe | 检查容器是否可以接收流量 |
| 沙箱 | Sandbox | 隔离的安全执行环境 |
| 密钥 | Secret | 加密存储的敏感信息 |
| SBOM | Software Bill of Materials | 软件物料清单 |
| IaC | Infrastructure as Code | 基础设施即代码 |
| DORA | DevOps Research and Assessment | DevOps 研究与评估 |
| MTTR | Mean Time to Recovery | 平均恢复时间 |
| SLA | Service Level Agreement | 服务等级协议 |
| SLO | Service Level Objective | 服务等级目标 |
| SLI | Service Level Indicator | 服务等级指标 |

---

---

## 附录 P：测试高级技巧

### P.1 Mock 与 Stub

在单元测试中，我们经常需要模拟外部依赖：

```typescript
// 测试中的 Mock 示例
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TerminalManager } from '../terminal-manager';
import { DockerService } from '../docker-service';

// Mock 整个模块
vi.mock('../docker-service', () => ({
  DockerService: {
    createContainer: vi.fn(),
    removeContainer: vi.fn(),
  },
}));

describe('TerminalManager', () => {
  let manager: TerminalManager;

  beforeEach(() => {
    // 每个测试前重置 mock
    vi.clearAllMocks();
    manager = new TerminalManager();
  });

  it('should create a terminal session', async () => {
    // 设置 mock 返回值
    const mockContainer = { id: 'abc123', exec: vi.fn() };
    vi.mocked(DockerService.createContainer).mockResolvedValue(mockContainer as any);

    const session = await manager.createSession({ cols: 80, rows: 24 });

    expect(session.id).toBeDefined();
    expect(DockerService.createContainer).toHaveBeenCalledOnce();
    expect(DockerService.createContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.any(String),
      })
    );
  });

  it('should handle container creation failure', async () => {
    vi.mocked(DockerService.createContainer).mockRejectedValue(
      new Error('Docker daemon not running')
    );

    await expect(
      manager.createSession({ cols: 80, rows: 24 })
    ).rejects.toThrow('Docker daemon not running');
  });

  it('should remove container on session cleanup', async () => {
    const mockContainer = { id: 'abc123' };
    vi.mocked(DockerService.createContainer).mockResolvedValue(mockContainer as any);
    vi.mocked(DockerService.removeContainer).mockResolvedValue(undefined);

    const session = await manager.createSession({ cols: 80, rows: 24 });
    await manager.destroySession(session.id);

    expect(DockerService.removeContainer).toHaveBeenCalledWith('abc123');
  });
});
```

### P.2 快照测试（Snapshot Testing）

快照测试用于验证输出格式不发生意外变化：

```typescript
import { describe, it, expect } from 'vitest';
import { formatTerminalOutput } from '../formatter';

describe('formatTerminalOutput', () => {
  it('should format ANSI colored text correctly', () => {
    const input = '\x1b[31mError: connection failed\x1b[0m';
    const result = formatTerminalOutput(input);
    
    // 快照测试：第一次运行会创建快照文件
    // 后续运行会与快照对比
    expect(result).toMatchSnapshot();
  });

  it('should format table output correctly', () => {
    const input = `NAME          STATUS    AGE
web-pod-1     Running   5d
web-pod-2     Running   3d
db-pod-1      Running   7d`;
    
    expect(formatTerminalOutput(input)).toMatchSnapshot();
  });
});
```

### P.3 参数化测试

```typescript
import { describe, it, expect } from 'vitest';
import { parseSemVer, isValidVersion } from '../version';

describe('parseSemVer', () => {
  // 参数化测试：一组输入输出对
  it.each([
    ['1.0.0', { major: 1, minor: 0, patch: 0 }],
    ['2.3.4', { major: 2, minor: 3, patch: 4 }],
    ['0.1.0-alpha.1', { major: 0, minor: 1, patch: 0, prerelease: 'alpha.1' }],
    ['1.0.0-beta.2', { major: 1, minor: 0, patch: 0, prerelease: 'beta.2' }],
    ['1.0.0-rc.1+build.123', { major: 1, minor: 0, patch: 0, prerelease: 'rc.1', build: 'build.123' }],
  ])('should parse %s correctly', (input, expected) => {
    expect(parseSemVer(input)).toEqual(expected);
  });
});

describe('isValidVersion', () => {
  it.each([
    ['1.0.0', true],
    ['0.0.1', true],
    ['v1.0.0', false],  // 不带 v 前缀
    ['1.0', false],     // 必须三段
    ['1.0.0.0', false], // 不能四段
    ['abc', false],     // 非数字
    ['', false],        // 空字符串
  ])('isValidVersion(%s) should be %s', (input, expected) => {
    expect(isValidVersion(input)).toBe(expected);
  });
});
```

### P.4 测试覆盖率最佳实践

```mermaid
graph TD
    subgraph "覆盖率类型"
        LINES["📊 行覆盖率
哪些代码行被执行了"]
        FUNCS["📊 函数覆盖率
哪些函数被调用了"]
        BRANCHES["📊 分支覆盖率
if/else 的每个分支是否都被测试"]
        STMTS["📊 语句覆盖率
哪些语句被执行了"]
    end

    subgraph "覆盖率目标"
        HIGH["🟢 80%+ : 优秀"]
        MED["🟡 60-80% : 良好"]
        LOW["🔴 < 60% : 需要改进"]
    end

    LINES --> HIGH
    BRANCHES --> HIGH

    style HIGH fill:#4CAF50,stroke:#333,color:#fff
    style MED fill:#FF9800,stroke:#333,color:#fff
    style LOW fill:#f44336,stroke:#333,color:#fff
```

| 覆盖率类型 | 说明 | 重要性 |
|-----------|------|--------|
| **行覆盖率** | 哪些代码行被执行 | ⭐⭐⭐ |
| **函数覆盖率** | 哪些函数被调用 | ⭐⭐⭐ |
| **分支覆盖率** | if/else 每个分支是否测试 | ⭐⭐⭐⭐⭐ |
| **语句覆盖率** | 哪些语句被执行 | ⭐⭐⭐ |

> 💡 **分支覆盖率最重要**：只看行覆盖率会遗漏未测试的条件分支。
> 例如 `if (a && b)` 可能在一行内，但有 4 种组合需要测试。

### P.5 测试命名规范

```typescript
// ❌ 不好的命名
describe('TerminalManager', () => {
  it('test1', () => { /* ... */ });
  it('should work', () => { /* ... */ });
  it('bug fix', () => { /* ... */ });
});

// ✅ 好的命名
describe('TerminalManager', () => {
  describe('createSession', () => {
    it('should create a session with valid dimensions', () => { /* ... */ });
    it('should throw an error when dimensions are zero', () => { /* ... */ });
    it('should limit concurrent sessions to maxSessions', () => { /* ... */ });
    it('should clean up resources when session creation fails', () => { /* ... */ });
  });

  describe('destroySession', () => {
    it('should remove the Docker container', () => { /* ... */ });
    it('should emit a session:destroyed event', () => { /* ... */ });
    it('should handle non-existent session id gracefully', () => { /* ... */ });
  });
});
```

### P.6 测试文件组织

```
apps/server/src/
├── terminal/
│   ├── terminal-manager.ts
│   ├── session.ts
│   └── __tests__/
│       ├── terminal-manager.test.ts    # 单元测试
│       └── session.test.ts             # 单元测试
├── routes/
│   ├── health.ts
│   └── __tests__/
│       └── health.test.ts              # 路由测试
└── __tests__/
    ├── integration.test.ts             # 集成测试
    └── fixtures/
        ├── mock-terminal.ts            # 测试固定数据
        └── mock-docker.ts              # Mock 服务

e2e/
├── auth.spec.ts                        # E2E 测试
├── terminal.spec.ts                    # E2E 测试
└── fixtures/
    ├── test-user.json                  # 测试用户数据
    └── helper.ts                       # E2E 工具函数
```

---

---

## 附录 Q：CI/CD 反模式与常见陷阱

### Q.1 反模式列表

```mermaid
graph TD
    subgraph "CI/CD 反模式 ❌"
        A1["❌ 只在发布前运行测试"]
        A2["❌ CI 流水线超过 30 分钟"]
        A3["❌ 手动部署到生产环境"]
        A4["❌ 忽略 CI 失败继续开发"]
        A5["❌ 在 CI 中安装大量依赖"]
        A6["❌ 不缓存依赖和构建产物"]
        A7["❌ 使用 latest 标签"]
        A8["❌ 硬编码环境变量"]
    end

    subgraph "正确做法 ✅"
        B1["✅ 每次提交都运行测试"]
        B2["✅ CI 在 10 分钟内完成"]
        B3["✅ 一键/自动部署"]
        B4["✅ 修复 CI 失败是最高优先级"]
        B5["✅ 利用缓存减少安装时间"]
        B6["✅ 缓存 node_modules 和构建产物"]
        B7["✅ 使用精确的版本标签"]
        B8["✅ 使用 Secrets 管理敏感信息"]
    end

    A1 --> B1
    A2 --> B2
    A3 --> B3
    A4 --> B4

    style A1 fill:#f44336,stroke:#333,color:#fff
    style B1 fill:#4CAF50,stroke:#333,color:#fff
```

| 反模式 | 问题 | 正确做法 |
|--------|------|----------|
| **Snowflake Server** | 服务器手动配置，无法重现 | 使用 Docker + IaC 确保一致性 |
| **手动部署** | 人为错误，不可重复 | 自动化部署脚本或 CI/CD |
| **长生命周期分支** | 合并冲突多，集成困难 | 短生命周期分支，频繁合并 |
| **测试不充分** | Bug 流入生产环境 | 金字塔模型：多单元测试，少 E2E |
| **无回滚计划** | 出问题无法恢复 | 每次部署保留上一版本，随时可回滚 |
| **环境配置不一致** | "在我机器上能跑" | Docker + 环境变量管理 |
| **忽略安全扫描** | 依赖漏洞被利用 | CI 中集成安全扫描 |
| **提交信息混乱** | 无法追溯变更原因 | Conventional Commits 规范 |

### Q.2 CI 流水线优化清单

如果 CI 流水线太慢，按以下顺序优化：

```mermaid
flowchart TD
    A["CI 太慢了！"] --> B{"缓存配置了吗？"}
    B -->|"没有"| B1["添加依赖缓存
预计加速 50-70%"]
    B -->|"有"| C{"任务并行了吗？"}
    C -->|"没有"| C1["拆分独立 Job 并行执行
预计加速 30-50%"]
    C -->|"有"| D{"Monorepo 变更检测？"}
    D -->|"没有"| D1["只测试变更的包
预计加速 40-60%"]
    D -->|"有"| E{"远程缓存？"}
    E -->|"没有"| E1["配置 Turborepo 远程缓存
预计加速 50-80%"]
    E -->|"有"| F["考虑自托管 Runner
或升级机器配置"]

    style B1 fill:#4CAF50,stroke:#333,color:#fff
    style C1 fill:#4CAF50,stroke:#333,color:#fff
    style D1 fill:#4CAF50,stroke:#333,color:#fff
    style E1 fill:#4CAF50,stroke:#333,color:#fff
    style F fill:#FF9800,stroke:#333,color:#fff
```

### Q.3 Git Hooks 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Hook 不执行 | `.husky/` 权限问题 | `chmod +x .husky/*` |
| Hook 执行太慢 | 对全项目运行检查 | 使用 lint-staged 只检查暂存文件 |
| CI 中 Hook 报错 | CI 环境没有 Git Hooks | 使用 `--no-verify` 或条件跳过 |
| 新成员 Hook 不生效 | 没有运行 `pnpm install` | `prepare` 脚本自动处理 |
| `commitlint` 报错 | 提交信息格式不对 | 遵循 Conventional Commits |
| `lint-staged` 不修复 | 配置中没有 `--fix` | 确保命令包含 `--fix` 参数 |

### Q.4 Docker 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 构建太慢 | 没有利用层缓存 | 调整 COPY 顺序，先复制依赖文件 |
| 镜像太大 | 包含了不需要的文件 | 使用多阶段构建 + .dockerignore |
| 容器启动失败 | 环境变量缺失 | 使用 env_file 或 secrets |
| 权限问题 | 使用 root 用户 | 创建非 root 用户并切换 |
| 时区不对 | 默认 UTC | 设置 `TZ=Asia/Shanghai` |
| DNS 解析失败 | 网络配置问题 | 检查 Docker network 配置 |

---

## 附录 R：从零搭建完整 CI/CD（Step by Step）

### R.1 第一步：配置 ESLint + Prettier

```bash
# 1. 安装依赖
pnpm add -D eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser

# 2. 创建配置文件
cat > eslint.config.js << 'EOF'
import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'prefer-const': 'error',
    },
  },
];
EOF

# 3. 测试
pnpm eslint src/
```

### R.2 第二步：配置 Husky + lint-staged

```bash
# 1. 安装依赖
pnpm add -D husky lint-staged

# 2. 初始化 Husky
pnpm exec husky init

# 3. 配置 lint-staged（在 package.json 中）
# "lint-staged": {
#   "*.ts": ["eslint --fix", "prettier --write"],
#   "*.{json,md}": ["prettier --write"]
# }

# 4. 配置 pre-commit hook
echo 'pnpm lint-staged' > .husky/pre-commit

# 5. 测试
echo 'console.log("test")' > test.ts
git add test.ts
git commit -m 'test'
# lint-staged 会自动运行
```

### R.3 第三步：配置 Conventional Commits

```bash
# 1. 安装依赖
pnpm add -D @commitlint/cli @commitlint/config-conventional

# 2. 创建配置
echo "module.exports = { extends: ['@commitlint/config-conventional'] };" > commitlint.config.js

# 3. 配置 commit-msg hook
echo 'npx --no -- commitlint --edit $1' > .husky/commit-msg

# 4. 测试
git commit -m 'bad message'  # ❌ 会被拒绝
git commit -m 'feat: add feature'  # ✅ 会成功
```

### R.4 第四步：配置 GitHub Actions

```bash
# 1. 创建工作流目录
mkdir -p .github/workflows

# 2. 创建 CI 配置
cat > .github/workflows/ci.yml << 'EOF'
name: CI
on: [push, pull_request]
jobs:
  lint-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
EOF

# 3. 提交并推送
git add .
git commit -m 'ci: add GitHub Actions workflow'
git push
```

### R.5 第五步：添加 Docker 支持

```bash
# 1. 创建 Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF

# 2. 创建 .dockerignore
cat > .dockerignore << 'EOF'
node_modules
.git
*.md
.env
EOF

# 3. 本地测试
docker build -t myapp .
docker run -p 3000:3000 myapp
```

### R.6 第六步：自动部署

```yaml
# 在 .github/workflows/ci.yml 中添加
deploy:
  needs: lint-and-test
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy
      run: |
        # 你的部署命令
        echo "Deploying..."
```

### 完整路线图

```mermaid
flowchart LR
    S1["Step 1
ESLint
Prettier"] --> S2["Step 2
Husky
lint-staged"]
    S2 --> S3["Step 3
Conventional
Commits"]
    S3 --> S4["Step 4
GitHub
Actions"]
    S4 --> S5["Step 5
Docker"]
    S5 --> S6["Step 6
Auto
Deploy"]

    style S1 fill:#E8F5E9,stroke:#333
    style S6 fill:#FF9800,stroke:#333,color:#fff
```

> 📖 **建议**：每完成一步都提交代码，确保每步都能正常工作后再进行下一步。

---

> 🔥 下一篇我们将学习：Docker 容器化与部署实践。

---

## 26. GitHub Actions 高级特性

### 26.1 矩阵构建（Matrix Strategy）

矩阵构建允许在多个环境组合中并行运行作业。

```yaml
name: 矩阵构建示例
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      # 即使某个矩阵失败也继续运行其他
      fail-fast: false
      matrix:
        node-version: [18, 20, 22]
        os: [ubuntu-latest, windows-latest, macos-latest]
        # 排除特定组合
        exclude:
          - os: macos-latest
            node-version: 18
        # 包含额外的组合
        include:
          - os: ubuntu-latest
            node-version: 22
            experimental: true

    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test
      # experimental 标记的允许失败
      - name: 实验性测试
        if: matrix.experimental
        continue-on-error: true
        run: npm run test:experimental
```

**矩阵构建效果（9 个并行作业）：**

| | ubuntu-latest | windows-latest | macos-latest |
|------|:---:|:---:|:---:|
| Node 18 | ✅ | ✅ | ❌ 排除 |
| Node 20 | ✅ | ✅ | ✅ |
| Node 22 | ✅ 实验性 | ✅ | ✅ |

### 26.2 可复用工作流（Reusable Workflows）

```yaml
# .github/workflows/reusable-deploy.yml - 可复用部署工作流
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      node-version:
        required: false
        type: string
        default: '20'
    secrets:
      DEPLOY_TOKEN:
        required: true
    outputs:
      deploy-url:
        description: "部署后的 URL"
        value: ${{ jobs.deploy.outputs.url }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    outputs:
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm run build
      - name: 部署
        id: deploy
        run: |
          echo "deploying to ${{ inputs.environment }}"
          echo "url=https://${{ inputs.environment }}.example.com" >> $GITHUB_OUTPUT
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

```yaml
# .github/workflows/main.yml - 调用可复用工作流
name: CI/CD Pipeline
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test

  deploy-staging:
    needs: test
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
    secrets:
      DEPLOY_TOKEN: ${{ secrets.STAGING_TOKEN }}

  deploy-production:
    needs: deploy-staging
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
    secrets:
      DEPLOY_TOKEN: ${{ secrets.PROD_TOKEN }}
```

### 26.3 环境变量与密钥管理

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    # 使用环境级别的变量和保护规则
    environment: production
    
    env:
      # 仓库级环境变量
      NODE_ENV: production
      API_URL: ${{ vars.API_URL }}
    
    steps:
      - name: 使用密钥
        run: echo "Deploying..."
        env:
          # 仓库级密钥
          API_KEY: ${{ secrets.API_KEY }}
          # 环境级密钥
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

**变量/密钥作用域：**

| 作用域 | 设置位置 | 优先级 | 适用场景 |
|--------|---------|--------|---------|
| Repository | Settings → Secrets | 低 | 通用配置 |
| Environment | Settings → Environments | 中 | 分环境配置 |
| Organization | Org Settings → Secrets | 最低 | 多仓库共享 |
| Workflow `env` | YAML 文件中 | 最高（覆盖） | 构建参数 |

---

## 27. Docker 在 CI/CD 中的应用

### 27.1 多阶段构建

```dockerfile
# ---- 阶段 1: 构建 ----
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件（利用缓存）
COPY package*.json ./
RUN npm ci --production=false

# 复制源码并构建
COPY . .
RUN npm run build

# ---- 阶段 2: 生产镜像 ----
FROM node:20-alpine AS production

WORKDIR /app

# 仅复制构建产物和生产依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 使用非 root 用户运行
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser
USER appuser

EXPOSE 3000

CMD ["node", "dist/server.js"]
```

**镜像大小对比：**

| 方式 | 镜像大小 |
|------|---------|
| 无多阶段构建 | ~1.2 GB |
| 多阶段构建 | ~150 MB |
| 多阶段 + Alpine | ~120 MB |

### 27.2 Docker 层缓存优化

```yaml
# GitHub Actions 中的 Docker 缓存
name: Docker Build
on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_TOKEN }}
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: myapp:${{ github.sha }}
          # 启用 GitHub Actions 缓存
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

### 27.3 Docker Compose 用于集成测试

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.test
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    environment:
      DATABASE_URL: postgres://user:pass@db:5432/testdb
      REDIS_URL: redis://redis:6379
  
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: testdb
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d testdb"]
      interval: 5s
      timeout: 5s
      retries: 5
  
  redis:
    image: redis:7-alpine
```

```yaml
# 在 CI 中使用
jobs:
  integration-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: 运行集成测试
        run: |
          docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
          docker compose -f docker-compose.test.yml down -v
```

---

## 28. 自动化部署策略

### 28.1 蓝绿部署（Blue-Green Deployment）

```mermaid
graph TB
    subgraph 部署前
        LB1[负载均衡器] -->|100% 流量| BLUE1[🔵 蓝色环境<br/>v1.0 - 生产中]
        GREEN1[🟢 绿色环境<br/>v1.0 - 空闲] 
    end
    
    subgraph 部署中
        LB2[负载均衡器] -->|100% 流量| BLUE2[🔵 蓝色环境<br/>v1.0]
        GREEN2[🟢 绿色环境<br/>v2.0 - 部署新版本]
    end
    
    subgraph 切换后
        LB3[负载均衡器] -->|100% 流量| GREEN3[🟢 绿色环境<br/>v2.0 - 生产中]
        BLUE3[🔵 蓝色环境<br/>v1.0 - 空闲/回滚备用]
    end
```

**特点：**
- ✅ 零停机部署
- ✅ 快速回滚（切回旧环境）
- ❌ 需要双倍资源
- ❌ 数据库迁移需要兼容两个版本

### 28.2 金丝雀部署（Canary Deployment）

```mermaid
graph TB
    subgraph 阶段1 - 初始金丝雀
        LB1[负载均衡器] -->|95%| V1A[v1.0 实例 x10]
        LB1 -->|5%| V2A[v2.0 实例 x1]
    end
    
    subgraph 阶段2 - 扩大流量
        LB2[负载均衡器] -->|70%| V1B[v1.0 实例 x7]
        LB2 -->|30%| V2B[v2.0 实例 x3]
    end
    
    subgraph 阶段3 - 全量发布
        LB3[负载均衡器] -->|100%| V2C[v2.0 实例 x10]
    end
```

**金丝雀部署的监控检查点：**

| 指标 | 阈值 | 操作 |
|------|------|------|
| 错误率 | < 1% | 继续推进 |
| 错误率 | 1-5% | 暂停，人工检查 |
| 错误率 | > 5% | 自动回滚 |
| P99 延迟 | < 500ms | 继续推进 |
| P99 延迟 | > 500ms | 自动回滚 |

### 28.3 滚动更新（Rolling Update）

```mermaid
sequenceDiagram
    participant LB as 负载均衡器
    participant P1 as Pod v1
    participant P2 as Pod v1
    participant P3 as Pod v1
    participant P4 as Pod v1

    Note over P1,P4: 初始状态：4 个 v1 Pod

    rect rgb(255, 240, 240)
        Note over LB,P4: 步骤 1：启动 1 个 v2 Pod
        LB->>P1: 流量
        LB->>P2: 流量
        LB->>P3: 流量
        Note over P4: 启动 v2...
    end

    rect rgb(240, 255, 240)
        Note over LB,P4: 步骤 2：移除 1 个 v1 Pod
        LB->>P1: 流量
        LB->>P2: 流量
        LB->>P4: 流量（v2）
        Note over P3: 🔴 已移除
    end

    rect rgb(240, 240, 255)
        Note over LB,P4: 步骤 3-4：重复上述过程
        LB->>P4: 流量（v2）
        Note over P1,P2: 逐步替换为 v2
    end

    Note over P1,P4: 最终：4 个 v2 Pod
```

### 28.4 部署策略对比

| 策略 | 停机时间 | 资源需求 | 回滚速度 | 复杂度 | 风险 |
|------|---------|---------|---------|--------|------|
| 蓝绿部署 | 零 | 2x | ⚡ 极快 | 低 | 低 |
| 金丝雀部署 | 零 | 1.1x | ⚡ 快 | 高 | 极低 |
| 滚动更新 | 零 | 1.1x | 🟡 中等 | 中 | 低 |
| 重建部署 | 有停机 | 1x | ❌ 慢 | 低 | 高 |

---

## 29. 基础设施即代码（IaC）

### 29.1 什么是 IaC

```mermaid
graph LR
    subgraph 传统方式
        A["手动在控制台<br/>点击配置"] --> B["难以复现"]
        B --> C["配置漂移"]
        C --> D["环境不一致"]
    end
    
    subgraph IaC 方式
        E["编写代码定义<br/>基础设施"] --> F["版本控制"]
        F --> G["自动化部署"]
        G --> H["环境一致"]
    end
```

### 29.2 Terraform 简介

```hcl
# main.tf - Terraform 配置
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"
}

# 定义变量
variable "app_name" {
  default = "my-app"
}

# 创建 VPC
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "${var.app_name}-vpc"
  }
}

# 创建子网
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.app_name}-public-subnet"
  }
}

# 创建 ECS 服务
resource "aws_ecs_cluster" "app" {
  name = "${var.app_name}-cluster"
}

# 输出
output "vpc_id" {
  value = aws_vpc.main.id
}

output "cluster_name" {
  value = aws_ecs_cluster.app.name
}
```

**Terraform 工作流程：**

```bash
terraform init      # 初始化，下载 Provider
terraform plan      # 预览变更
terraform apply     # 执行变更
terraform destroy   # 销毁所有资源
terraform state list  # 查看已管理的资源
```

### 29.3 Pulumi 简介

Pulumi 使用真正的编程语言（TypeScript、Python、Go 等）定义基础设施。

```typescript
// index.ts - Pulumi 配置（TypeScript）
import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

// 创建 VPC
const vpc = new aws.ec2.Vpc("main", {
  cidrBlock: "10.0.0.0/16",
  tags: { Name: "my-app-vpc" }
});

// 创建 ECS 集群
const cluster = new aws.ecs.Cluster("app", {
  name: "my-app-cluster"
});

// 创建 RDS 数据库
const db = new aws.rds.Instance("database", {
  engine: "postgres",
  engineVersion: "16",
  instanceClass: "db.t3.micro",
  allocatedStorage: 20,
  dbName: "myapp",
  username: "admin",
  password: pulumi.secret("my-secure-password"),  // 加密存储
});

// 导出
export const vpcId = vpc.id;
export const clusterName = cluster.name;
export const dbEndpoint = db.endpoint;
```

### 29.4 Terraform vs Pulumi 对比

| 特性 | Terraform | Pulumi |
|------|-----------|--------|
| 语言 | HCL（领域特定语言） | TypeScript/Python/Go/C# |
| 学习曲线 | 较低 | 较低（如果你已会编程） |
| 生态系统 | 非常成熟 | 快速增长 |
| 状态管理 | 本地/S3/Terraform Cloud | Pulumi Cloud/S3/本地 |
| 模块复用 | Terraform Modules | npm/pip 包 |
| 条件/循环 | HCL 语法 | 完整编程语言能力 |
| 适合团队 | 运维团队 | 开发团队 |

---

## 30. DevOps 度量指标

### 30.1 DORA 四大指标

DORA（DevOps Research and Assessment）定义了四个关键指标来衡量软件交付效能。

```mermaid
graph TB
    subgraph DORA 四大指标
        A["🚀 部署频率<br/>Deployment Frequency"]
        B["⏱️ 变更前置时间<br/>Lead Time for Changes"]
        C["🔄 变更失败率<br/>Change Failure Rate"]
        D["🔧 服务恢复时间<br/>Time to Restore Service"]
    end
    
    A -->|"Elite: 按需部署<br/>多次/天"| E[高效能团队]
    B -->|"Elite: < 1小时"| E
    C -->|"Elite: 0-15%"| E
    D -->|"Elite: < 1小时"| E
```

### 30.2 四大指标详解

| 指标 | 定义 | Elite | High | Medium | Low |
|------|------|-------|------|--------|-----|
| **部署频率** | 代码部署到生产的频率 | 按需（多次/天） | 每天到每周 | 每周到每月 | 每月到每半年 |
| **变更前置时间** | 从提交代码到成功部署的时间 | < 1小时 | 1天-1周 | 1周-1月 | 1-6个月 |
| **变更失败率** | 导致服务降级的部署百分比 | 0-15% | 16-30% | 16-30% | 16-30% |
| **服务恢复时间** | 从服务故障到恢复的时间 | < 1小时 | < 1天 | 1天-1周 | 1周-6个月 |

### 30.3 如何度量这些指标

```javascript
// 度量示例：计算变更前置时间
function calculateLeadTime(pullRequests) {
  return pullRequests.map(pr => {
    const commitTime = new Date(pr.firstCommitAt);
    const deployTime = new Date(pr.deployedAt);
    const leadTimeHours = (deployTime - commitTime) / (1000 * 60 * 60);
    
    return {
      pr: pr.id,
      leadTimeHours: leadTimeHours.toFixed(2),
      status: leadTimeHours < 24 ? 'elite' :
              leadTimeHours < 168 ? 'high' :
              leadTimeHours < 720 ? 'medium' : 'low'
    };
  });
}

// 度量示例：计算部署频率
function calculateDeploymentFrequency(deploys, periodDays) {
  const count = deploys.length;
  const frequency = count / periodDays;
  
  return {
    totalDeploys: count,
    perDay: frequency.toFixed(2),
    level: frequency >= 1 ? 'elite' :
           frequency >= 0.14 ? 'high' :     // 每周一次
           frequency >= 0.03 ? 'medium' :    // 每月一次
           'low'
  };
}
```

### 30.4 提升 DORA 指标的实践

| 指标 | 提升策略 |
|------|---------|
| **部署频率** | Trunk-based 开发、自动化 CI/CD、功能开关、小批量交付 |
| **变更前置时间** | 减少审批层级、自动化测试、代码评审自动化、短生命周期分支 |
| **变更失败率** | 增加测试覆盖、自动化回归测试、代码审查、金丝雀部署 |
| **服务恢复时间** | 完善监控告警、自动化回滚、事故响应流程、故障演练 |

### 30.5 DevOps 成熟度模型

```mermaid
graph LR
    L1["Level 1<br/>初始级"] -->|"标准化流程"| L2["Level 2<br/>基础级"]
    L2 -->|"自动化 CI/CD"| L3["Level 3<br/>进阶级"]
    L3 -->|"全面监控+自愈"| L4["Level 4<br/>高效级"]
    L4 -->|"持续改进+AI"| L5["Level 5<br/>精英级"]
```

| 级别 | 特征 | DORA 水平 |
|------|------|----------|
| Level 1 - 初始 | 手动部署，无 CI/CD | Low |
| Level 2 - 基础 | 有 CI，手动部署 | Medium |
| Level 3 - 进阶 | CI/CD 自动化，基础设施即代码 | High |
| Level 4 - 高效 | 全面监控，自动化回滚，SRE 实践 | Elite |
| Level 5 - 精英 | AIOps，自愈系统，持续改进 | Elite+ |


---

## 31. GitHub Actions 实战模板

### 31.1 完整的 Node.js CI/CD 流水线

```yaml
name: Node.js CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ---- 代码质量检查 ----
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  # ---- 单元测试 ----
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage
      - name: Upload coverage
        if: matrix.node-version == 20
        uses: codecov/codecov-action@v3

  # ---- 构建 Docker 镜像 ----
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ---- 部署到 Staging ----
  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Staging
        run: |
          echo "Deploying ${{ github.sha }} to staging..."
          # kubectl set image deployment/app app=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

  # ---- 部署到 Production ----
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Production
        run: |
          echo "Deploying ${{ github.sha }} to production..."
```

### 31.2 GitHub Actions 缓存策略

```yaml
# npm 缓存
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'  # 自动缓存 ~/.npm

# 手动缓存
- uses: actions/cache@v3
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

# Docker 层缓存
- uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

---

## 32. Kubernetes 基础

### 32.1 核心概念

```mermaid
graph TB
    subgraph Kubernetes 集群
        subgraph Node 1
            P1[Pod - App v1]
            P2[Pod - App v1]
        end
        subgraph Node 2
            P3[Pod - App v2]
            P4[Pod - DB]
        end
        M[Master Node<br/>API Server / etcd / Scheduler]
        M -->|调度| P1
        M -->|调度| P3
        SVC[Service<br/>负载均衡] --> P1
        SVC --> P2
        SVC --> P3
    end
    IN[Ingress<br/>入口路由] --> SVC
    U[用户] --> IN
```

### 32.2 核心资源对象

| 资源 | 说明 | 类比 |
|------|------|------|
| **Pod** | 最小部署单元，包含一个或多个容器 | 一个"房间" |
| **Deployment** | 管理 Pod 的副本数和更新策略 | "管家" |
| **Service** | 提供稳定的网络访问入口 | "门牌号" |
| **Ingress** | HTTP/HTTPS 路由规则 | "门卫" |
| **ConfigMap** | 存储配置数据 | "配置文件" |
| **Secret** | 存储敏感数据 | "保险箱" |
| **PersistentVolume** | 持久化存储 | "硬盘" |

### 32.3 Deployment 配置示例

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 最多多出 1 个 Pod
      maxUnavailable: 0   # 不允许不可用
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: ghcr.io/myorg/my-app:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: password
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - app.example.com
    secretName: app-tls
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-app-service
            port:
              number: 80
```

---

## 33. 监控与可观测性

### 33.1 可观测性三大支柱

```mermaid
graph TB
    O[可观测性] --> M[Metrics 指标]
    O --> L[Logs 日志]
    O --> T[Traces 链路追踪]

    M --> M1["Prometheus + Grafana<br/>系统/应用指标"]
    L --> L1["ELK Stack / Loki<br/>集中式日志"]
    T --> T1["Jaeger / Zipkin<br/>分布式链路追踪"]
```

| 支柱 | 工具 | 用途 |
|------|------|------|
| **Metrics** | Prometheus, Grafana | CPU、内存、请求量、错误率等指标 |
| **Logs** | ELK (Elasticsearch+Logstash+Kibana), Loki | 应用日志收集和查询 |
| **Traces** | Jaeger, Zipkin, OpenTelemetry | 请求在多个服务间的调用链路 |

### 33.2 Prometheus 基础监控

```javascript
// Node.js 应用集成 Prometheus
const promClient = require('prom-client');

// 创建指标
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'HTTP 请求总数',
  labelNames: ['method', 'path', 'status']
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP 请求耗时',
  labelNames: ['method', 'path'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

// 中间件收集指标
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({ method: req.method, path: req.path, status: res.statusCode });
    httpRequestDuration.observe({ method: req.method, path: req.path }, duration);
  });
  
  next();
});

// 暴露 /metrics 端点
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.send(await promClient.register.metrics());
});
```

### 33.3 Docker Compose 监控栈

```yaml
# docker-compose.monitoring.yml
version: '3.8'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana-data:/var/lib/grafana

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./promtail.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

volumes:
  prometheus-data:
  grafana-data:
```


---

## 34. CI/CD 安全最佳实践

### 34.1 供应链安全

```mermaid
graph LR
    A[代码提交] --> B[依赖扫描]
    B --> C[容器扫描]
    C --> D[密钥扫描]
    D --> E[SAST 静态分析]
    E --> F[构建]
    F --> G[DAST 动态测试]
    G --> H[部署]
```

| 阶段 | 工具 | 检查内容 |
|------|------|---------|
| 代码提交 | `pre-commit`, `husky` | 代码风格、密钥泄露 |
| 依赖扫描 | `npm audit`, `snyk` | 已知漏洞 |
| 容器扫描 | `trivy`, `grype` | 镜像漏洞 |
| 密钥扫描 | `truffleHog`, `gitLeaks` | 硬编码密钥 |
| SAST | `semgrep`, `sonarqube` | 代码安全问题 |
| DAST | `owasp-zap` | 运行时漏洞 |

### 34.2 GitHub Actions 安全配置

```yaml
# 安全扫描工作流
name: Security Scan
on: [push, pull_request]

jobs:
  # 依赖漏洞扫描
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Audit dependencies
        run: npm audit --audit-level=high

  # 容器镜像扫描
  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .
      - name: Scan with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          severity: 'CRITICAL,HIGH'

  # 密钥扫描
  secret-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified

  # 代码安全分析
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/typescript p/nodejs
```

### 34.3 CI/CD 最佳实践

| 实践 | 说明 |
|------|------|
| **最小权限** | CI/CD 凭证只赋予必要的最小权限 |
| **固定版本** | 使用 Action 的 SHA 而非 Tag（防止供应链攻击） |
| **密钥轮转** | 定期更换 CI/CD 中使用的密钥和 Token |
| **审计日志** | 记录所有部署操作和审批记录 |
| **环境隔离** | 生产环境与测试环境使用不同的凭证 |
| **人工审批** | 生产部署需要人工审批（`environment` protection rules） |

```yaml
# ✅ 使用 SHA 固定 Action 版本
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1

# ❌ 不安全：使用 Tag 可能被篡改
- uses: actions/checkout@v4
```

---

## 35. 版本控制与发布管理

### 35.1 语义化版本（SemVer）

```mermaid
graph LR
    V["v1.2.3"] --> MAJ["主版本 1<br/>不兼容的 API 变更"]
    V --> MIN["次版本 2<br/>向后兼容的功能新增"]
    V --> PAT["补丁版本 3<br/>向后兼容的 Bug 修复"]
```

| 变更类型 | 版本变化 | 示例 |
|---------|---------|------|
| Bug 修复 | Patch (1.0.0 → 1.0.1) | 修复登录按钮无响应 |
| 新功能 | Minor (1.0.0 → 1.1.0) | 添加用户导出功能 |
| 破坏性变更 | Major (1.0.0 → 2.0.0) | 重构 API 接口 |

### 35.2 语义化发布工具

```bash
# 安装 standard-version
npm install -D standard-version

# 添加 npm scripts
# "release": "standard-version",
# "release:minor": "standard-version --release-as minor",
# "release:major": "standard-version --release-as major"

# 自动分析提交、更新版本号、生成 CHANGELOG
npm run release
# v1.2.0
# ## 1.2.0 (2024-01-15)
# ### Features
# * 添加用户导出功能 (abc1234)
# ### Bug Fixes
# * 修复登录超时问题 (def5678)
```

### 35.3 Git 工作流对比

| 工作流 | 复杂度 | 适合团队 | 特点 |
|--------|--------|---------|------|
| **Git Flow** | 高 | 大团队、发布周期长 | develop/main/hotfix/release 分支 |
| **GitHub Flow** | 低 | 小团队、持续部署 | main + feature 分支 |
| **Trunk-Based** | 低 | 高效能团队 | 主干开发、短生命周期分支 |
| **GitLab Flow** | 中 | 中等团队 | main + environment 分支 |

```mermaid
gitGraph
    commit id: "init"
    branch develop
    checkout develop
    commit id: "feature A"
    commit id: "feature B"
    branch release
    checkout release
    commit id: "fix bug"
    checkout main
    merge release id: "v1.0.0" tag: "v1.0.0"
    checkout develop
    merge release
    commit id: "feature C"
    checkout main
    commit id: "hotfix" tag: "v1.0.1"
    checkout develop
    merge main
```


---

## 36. 自动化测试策略

### 36.1 测试金字塔

```mermaid
graph TB
    subgraph 测试金字塔
        E2E["🔺 E2E 测试<br/>端到端测试（少量）"]
        I["🔶 集成测试<br/>API/组件集成（适量）"]
        U["🟩 单元测试<br/>函数/类（大量）"]
    end
    E2E -->|"慢、脆弱、贵"| SLOW["速度慢"]
    I -->|"中等速度"| MED["中等速度"]
    U -->|"快、稳定、便宜"| FAST["速度快"]
```

| 测试类型 | 比例 | 速度 | 成本 | 工具 |
|---------|------|------|------|------|
| **单元测试** | 70% | 毫秒级 | 低 | Jest, Vitest, Mocha |
| **集成测试** | 20% | 秒级 | 中 | Supertest, Testing Library |
| **E2E 测试** | 10% | 分钟级 | 高 | Playwright, Cypress |

### 36.2 CI 中的测试策略

```yaml
# 分层测试工作流
jobs:
  # 快速反馈：单元测试（PR 时触发）
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - name: Coverage check
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "❌ 代码覆盖率 ${COVERAGE}% 低于 80% 阈值"
            exit 1
          fi

  # 集成测试（合并到 main 时触发）
  integration-test:
    needs: unit-test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  # E2E 测试（部署到 staging 后触发）
  e2e-test:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run E2E tests
        run: npx playwright test
        env:
          BASE_URL: https://staging.example.com
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 37. 发布与版本管理自动化

### 37.1 Changesets 工作流

```bash
# 安装
npm install -D @changesets/cli

# 初始化
npx changeset init

# 添加变更记录
npx changeset
# 选择包、版本类型（major/minor/patch）、描述

# 发布
npx changeset version  # 更新版本号和 CHANGELOG
npx changeset publish  # 发布到 npm
```

### 37.2 自动化发布工作流

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org

      - run: npm ci
      - run: npm run build

      # 使用 Changesets 自动创建发布 PR
      - name: Create Release PR
        uses: changesets/action@v1
        with:
          publish: npm run release
          title: "chore: version packages"
          commit: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 38. 实用 CI/CD 模式

### 38.1 并行化测试

```yaml
# 将测试分片并行运行
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Run tests (shard ${{ matrix.shard }}/4)
        run: npx jest --shard=${{ matrix.shard }}/4 --coverage
      
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: coverage-${{ matrix.shard }}
          path: coverage/

  merge-coverage:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Download all coverage
        uses: actions/download-artifact@v3
      - name: Merge coverage reports
        run: npx nyc merge coverage/ .nyc_output/coverage.json
```

### 38.2 条件部署

```yaml
# 只在特定文件变更时部署
jobs:
  check-changes:
    runs-on: ubuntu-latest
    outputs:
      frontend: ${{ steps.changes.outputs.frontend }}
      backend: ${{ steps.changes.outputs.backend }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            frontend:
              - 'src/frontend/**'
              - 'package.json'
            backend:
              - 'src/backend/**'
              - 'Dockerfile'

  deploy-frontend:
    needs: check-changes
    if: needs.check-changes.outputs.frontend == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying frontend..."

  deploy-backend:
    needs: check-changes
    if: needs.check-changes.outputs.backend == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying backend..."
```



---

# CI/CD 与 DevOps（续）

## GitHub Actions 深度

### 自定义 Action 开发

GitHub Actions 允许你创建自定义 Action，可以在多个工作流中复用。自定义 Action 有三种类型：

| 类型 | 说明 | 优点 | 缺点 |
|---|---|---|---|
| JavaScript Action | 使用 Node.js 编写 | 灵活、启动快 | 需要 Node.js 运行时 |
| Docker Action | 使用 Docker 容器 | 可以使用任何语言 | 启动较慢 |
| Composite Action | 组合多个步骤 | 简单、无额外运行时 | 功能有限 |

**JavaScript Action 示例：**

```yaml
# action.yml - Action 定义文件
name: 'Custom Deploy Action'
description: '自动部署应用到指定环境'
author: 'Your Name'

inputs:
  environment:
    description: '部署环境 (dev/staging/prod)'
    required: true
    default: 'staging'
  version:
    description: '部署版本'
    required: true
  api-key:
    description: 'API 密钥'
    required: true

outputs:
  deploy-url:
    description: '部署后的访问地址'
  deploy-id:
    description: '部署 ID'

runs:
  using: 'node20'
  main: 'dist/index.js'
  post: 'dist/cleanup.js'  # 清理步骤

branding:
  icon: 'cloud'
  color: 'blue'
```

```javascript
// src/index.js - Action 主逻辑
const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');

async function run() {
  try {
    // 获取输入参数
    const environment = core.getInput('environment', { required: true });
    const version = core.getInput('version', { required: true });
    const apiKey = core.getInput('api-key', { required: true });

    // 获取上下文信息
    const { owner, repo } = github.context.repo;
    const sha = github.context.sha;

    core.info(`开始部署 ${repo} v${version} 到 ${environment}`);

    // 执行部署逻辑
    const deployId = await deploy({
      owner,
      repo,
      sha,
      environment,
      version,
      apiKey,
    });

    // 设置输出
    core.setOutput('deploy-id', deployId);
    core.setOutput('deploy-url', `https://${environment}.example.com`);

    // 保存状态（供 post 步骤使用）
    core.saveState('deployId', deployId);

    core.info(`部署成功！ID: ${deployId}`);
  } catch (error) {
    core.setFailed(`部署失败: ${error.message}`);
  }
}

async function deploy({ owner, repo, sha, environment, version, apiKey }) {
  // 实现部署逻辑
  const response = await fetch('https://api.example.com/deploy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repository: `${owner}/${repo}`,
      commit: sha,
      environment,
      version,
    }),
  });

  if (!response.ok) {
    throw new Error(`部署请求失败: ${response.statusText}`);
  }

  const data = await response.json();
  return data.deployId;
}

run();
```

```javascript
// src/cleanup.js - 清理逻辑
const core = require('@actions/core');

async function cleanup() {
  const deployId = core.getState('deployId');

  if (deployId) {
    core.info(`清理部署资源: ${deployId}`);
    // 执行清理逻辑
  }
}

cleanup();
```

**Composite Action 示例：**

```yaml
# action.yml - 复合 Action
name: 'Setup and Test'
description: '设置环境并运行测试'

inputs:
  node-version:
    description: 'Node.js 版本'
    required: true
    default: '20'
  package-manager:
    description: '包管理器 (npm/yarn/pnpm)'
    required: false
    default: 'npm'

runs:
  using: 'composite'
  steps:
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
        cache: ${{ inputs.package-manager }}

    - name: Install dependencies
      shell: bash
      run: |
        if [ "${{ inputs.package-manager }}" = "pnpm" ]; then
          npm install -g pnpm
          pnpm install --frozen-lockfile
        elif [ "${{ inputs.package-manager }}" = "yarn" ]; then
          yarn install --frozen-lockfile
        else
          npm ci
        fi

    - name: Run linter
      shell: bash
      run: npm run lint

    - name: Run tests
      shell: bash
      run: npm test -- --coverage

    - name: Upload coverage
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
```

### Reusable Workflows（可复用工作流）

```yaml
# .github/workflows/reusable-deploy.yml - 可复用工作流
name: Reusable Deploy Workflow

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
        description: '部署环境'
      version:
        required: true
        type: string
        description: '部署版本'
      node-version:
        required: false
        type: string
        default: '20'
    secrets:
      DEPLOY_TOKEN:
        required: true
      REGISTRY_PASSWORD:
        required: true
    outputs:
      deploy-url:
        description: '部署 URL'
        value: ${{ jobs.deploy.outputs.url }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    outputs:
      url: ${{ steps.deploy.outputs.url }}
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
          cache: 'npm'

      - run: npm ci
      - run: npm run build

      - name: Deploy
        id: deploy
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
        run: |
          ./scripts/deploy.sh ${{ inputs.environment }} ${{ inputs.version }}
          echo "url=https://${{ inputs.environment }}.example.com" >> $GITHUB_OUTPUT
```

**使用可复用工作流：**

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
      version: ${{ github.ref_name }}
      node-version: '20'
    secrets:
      DEPLOY_TOKEN: ${{ secrets.PROD_DEPLOY_TOKEN }}
      REGISTRY_PASSWORD: ${{ secrets.REGISTRY_PASSWORD }}
```

### 环境变量与密钥管理

**环境变量层次：**

| 层次 | 作用域 | 优先级 | 配置位置 |
|---|---|---|---|
| Workflow 级别 | 整个工作流 | 最低 | `env:` |
| Job 级别 | 单个 Job | 中 | `jobs.<id>.env:` |
| Step 级别 | 单个步骤 | 最高 | `steps.<id>.env:` |
| Repository Secrets | 整个仓库 | - | Settings → Secrets |
| Environment Secrets | 特定环境 | - | Settings → Environments |

```yaml
name: Environment Variables Demo

on: push

env:
  GLOBAL_VAR: "全局变量"
  NODE_ENV: "production"

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      JOB_VAR: "Job 级别变量"
    steps:
      - name: 使用变量
        env:
          STEP_VAR: "Step 级别变量"
        run: |
          echo "全局: $GLOBAL_VAR"
          echo "Job: $JOB_VAR"
          echo "Step: $STEP_VAR"
          echo "Secret: ${{ secrets.MY_SECRET }}"

      - name: 使用环境特定密钥
        if: github.ref == 'refs/heads/main'
        env:
          API_KEY: ${{ secrets.PROD_API_KEY }}
        run: echo "使用生产密钥"

  deploy-staging:
    runs-on: ubuntu-latest
    environment: staging  # 使用 staging 环境
    steps:
      - name: Deploy
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}  # staging 环境的密钥
        run: ./deploy.sh staging

  deploy-production:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.example.com
    steps:
      - name: Deploy
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}  # production 环境的密钥
        run: ./deploy.sh production
```

**密钥管理最佳实践：**

| 实践 | 说明 |
|---|---|
| 最小权限 | 只授予必要的权限 |
| 环境隔离 | 不同环境使用不同的密钥 |
| 定期轮换 | 定期更新密钥 |
| 审计日志 | 监控密钥使用情况 |
| 避免日志泄露 | 使用 `::add-mask::` 掩码敏感信息 |

---

## CI/CD 安全

### 安全扫描流程

```mermaid
graph TB
    subgraph "CI/CD 安全扫描流程"
        Code[代码提交] --> SAST[SAST 静态分析]
        SAST --> SCA[SCA 依赖扫描]
        SCA --> Secret[密钥扫描]
        Secret --> Build[构建镜像]
        Build --> Scan[镜像扫描]
        Scan --> Sign[镜像签名]
        Sign --> DAST[DAST 动态分析]
        DAST --> Deploy[部署]
        Deploy --> Monitor[运行时监控]
    end

    SAST --> |发现漏洞| Block1[阻止合并]
    SCA --> |高危依赖| Block2[阻止构建]
    Secret --> |泄露密钥| Block3[阻止提交]
    Scan --> |镜像漏洞| Block4[阻止部署]
    DAST --> |安全缺陷| Block5[阻止发布]
```

### SAST（静态应用安全测试）

```yaml
# GitHub Actions - SAST 扫描
name: Security Scanning

on: [push, pull_request]

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # CodeQL 分析
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v3
        with:
          languages: javascript, typescript
          queries: security-extended

      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v3

      # Semgrep 扫描
      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets
            p/owasp-top-ten

      # SonarCloud 扫描
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```

**常见 SAST 工具对比：**

| 工具 | 类型 | 免费额度 | 语言支持 | 特点 |
|---|---|---|---|---|
| CodeQL | GitHub 内置 | 公开仓库免费 | JS/TS/Python/Java/Go 等 | 深度分析，自定义查询 |
| Semgrep | 开源 | 基础版免费 | 20+ 语言 | 规则灵活，速度快 |
| SonarQube | 开源/商业 | 社区版免费 | 30+ 语言 | 全面的代码质量分析 |
| ESLint Security | 插件 | 免费 | JS/TS | 集成在 ESLint 中 |
| Bandit | 开源 | 免费 | Python | Python 专用 |

### SCA（软件组成分析）

```yaml
# 依赖安全扫描
jobs:
  sca:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # npm audit
      - name: npm audit
        run: npm audit --audit-level=high

      # Snyk 扫描
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      # Trivy 扫描（文件系统）
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          severity: 'CRITICAL,HIGH'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'
```

### 密钥扫描

```yaml
# 密钥泄露检测
jobs:
  secret-scanning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # GitLeaks 扫描
      - name: Run GitLeaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # TruffleHog 扫描
      - name: Run TruffleHog
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified

      # detect-secrets 扫描
      - name: Run detect-secrets
        uses: Yelp/detect-secrets-action@v1.0.0
        with:
          exclude_files: "package-lock.json,yarn.lock"
```

**密钥扫描工具对比：**

| 工具 | 类型 | 特点 |
|---|---|---|
| GitHub Secret Scanning | 内置 | 自动扫描推送的密钥 |
| GitLeaks | 开源 | 规则灵活，支持 pre-commit |
| TruffleHog | 开源 | 支持验证密钥是否有效 |
| detect-secrets | 开源 | Yelp 开发，baseline 管理 |
| Snyk Secrets | 商业 | 集成在 Snyk 平台 |

### 供应链安全

```yaml
# 供应链安全扫描
jobs:
  supply-chain:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 生成 SBOM
      - name: Generate SBOM
        uses: anchore/sbom-action@v0
        with:
          format: spdx-json
          output-file: sbom.spdx.json

      # 验证依赖完整性
      - name: Verify lockfile
        run: |
          npm ci --ignore-scripts
          npm audit signatures

      # 检查 Action 版本
      - name: Check Action versions
        uses: zgosalvez/github-actions-ensure-sha-pinned-actions@v3

      # 签名构建产物
      - name: Sign artifact
        uses: sigstore/cosign-installer@v3
      - run: cosign sign-blob --yes ./dist/app.zip > ./dist/app.sig
```

---

## 部署自动化

### ArgoCD GitOps 实践

```yaml
# ArgoCD ApplicationSet - 多环境部署
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: web-app
  namespace: argocd
spec:
  generators:
  - list:
      elements:
      - env: dev
        cluster: https://dev-cluster.example.com
        revision: develop
      - env: staging
        cluster: https://staging-cluster.example.com
        revision: main
      - env: production
        cluster: https://prod-cluster.example.com
        revision: main
  template:
    metadata:
      name: 'web-app-{{env}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/example/gitops-config.git
        targetRevision: '{{revision}}'
        path: 'apps/web-app/overlays/{{env}}'
      destination:
        server: '{{cluster}}'
        namespace: 'web-app-{{env}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
          - CreateNamespace=true
```

### FluxCD 配置

```yaml
# FluxCD GitRepository
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: web-app
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/example/gitops-config.git
  ref:
    branch: main
  secretRef:
    name: git-credentials
---
# FluxCD Kustomization
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: web-app-production
  namespace: flux-system
spec:
  interval: 10m
  path: ./apps/web-app/overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: web-app
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: web-app
      namespace: production
  timeout: 5m
```

**ArgoCD vs FluxCD 详细对比：**

| 特性 | ArgoCD | FluxCD |
|---|---|---|
| **架构** | 集中式控制平面 | 分布式组件 |
| **Web UI** | ✅ 内置丰富 UI | ❌ 需要 Weave GitOps |
| **CLI** | argocd CLI | flux CLI |
| **RBAC** | 内置精细 RBAC | 依赖 K8s RBAC |
| **多集群** | ✅ 原生支持 | ✅ 通过 Kustomization |
| **通知** | 内置 Notification Controller | 内置 Notification Controller |
| **SOPS 集成** | 需要插件 | ✅ 原生支持 |
| **OCI 支持** | ✅ Helm OCI | ✅ OCI Repository |
| **Health Assessment** | ✅ 内置 | ✅ healthChecks 字段 |
| **Sync Windows** | ✅ 维护窗口 | ❌ |
| **ApplicationSet** | ✅ 批量生成 Application | ❌ 需手动配置 |
| **学习曲线** | 中等 | 平缓 |
| **社区规模** | 较大 | 增长中 |
| **CNCF 状态** | Graduated | Graduated |

---

## 基础设施即代码

### Terraform 模块化

```hcl
# modules/vpc/main.tf
variable "environment" {
  description = "环境名称"
  type        = string
}

variable "cidr_block" {
  description = "VPC CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "可用区列表"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "${var.environment}-vpc"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.cidr_block, 8, count.index)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.environment}-private-${var.availability_zones[count.index]}"
  }
}

resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.cidr_block, 8, count.index + 100)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.environment}-public-${var.availability_zones[count.index]}"
  }
}

output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}
```

```hcl
# environments/production/main.tf
module "vpc" {
  source = "../../modules/vpc"

  environment        = "production"
  cidr_block         = "10.0.0.0/16"
  availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

module "eks" {
  source = "../../modules/eks"

  environment      = "production"
  vpc_id           = module.vpc.vpc_id
  subnet_ids       = module.vpc.private_subnet_ids
  cluster_version  = "1.29"
  node_groups = {
    general = {
      instance_types = ["m5.xlarge"]
      min_size       = 3
      max_size       = 10
      desired_size   = 5
    }
  }
}

module "rds" {
  source = "../../modules/rds"

  environment    = "production"
  vpc_id         = module.vpc.vpc_id
  subnet_ids     = module.vpc.private_subnet_ids
  instance_class = "db.r5.xlarge"
  engine         = "postgres"
  engine_version = "15"
  multi_az       = true
}
```

### Pulumi 编程语言 IaC

```typescript
// Pulumi - 使用 TypeScript 定义基础设施
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();
const environment = config.require('environment');
const vpcCidr = config.get('vpcCidr') || '10.0.0.0/16';

// 创建 VPC
const vpc = new aws.ec2.Vpc(`${environment}-vpc`, {
  cidrBlock: vpcCidr,
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: {
    Name: `${environment}-vpc`,
    Environment: environment,
    ManagedBy: 'pulumi',
  },
});

// 创建子网
const availabilityZones = ['us-east-1a', 'us-east-1b', 'us-east-1c'];

const privateSubnets = availabilityZones.map((az, index) => {
  return new aws.ec2.Subnet(`${environment}-private-${az}`, {
    vpcId: vpc.id,
    cidrBlock: pulumi.interpolate`${pulumi.output(vpcCidr).apply(cidr => {
      const parts = cidr.split('/');
      return `${parts[0].split('.').slice(0, 2).join('.')}.${index}.0/24`;
    })}`,
    availabilityZone: az,
    tags: {
      Name: `${environment}-private-${az}`,
    },
  });
});

// 创建 EKS 集群
const cluster = new aws.eks.Cluster(`${environment}-cluster`, {
  vpcConfig: {
    subnetIds: privateSubnets.map(s => s.id),
  },
  roleArn: eksRole.arn,
  version: '1.29',
});

// 导出资源 ID
export const vpcId = vpc.id;
export const clusterEndpoint = cluster.endpoint;
export const clusterName = cluster.name;
```

### IaC 最佳实践

| 实践 | 说明 |
|---|---|
| 状态管理 | 使用远程状态存储（S3 + DynamoDB） |
| 状态锁 | 启用状态锁防止并发修改 |
| 模块化 | 将可复用资源封装为模块 |
| 变量化 | 使用变量管理环境差异 |
| 计划审查 | `terraform plan` 输出必须审查 |
| 代码审查 | IaC 变更需要 PR 审查 |
| 标签管理 | 统一标签策略便于成本管理 |
| 安全扫描 | 使用 tfsec/checkov 扫描安全问题 |
| 文档生成 | 使用 terraform-docs 自动生成文档 |

---

## 可观测性集成

### CI/CD Pipeline 监控

```yaml
# CI/CD 可观测性配置
name: Observable Pipeline

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # 构建步骤
      - name: Build
        id: build
        run: |
          START_TIME=$(date +%s)
          npm run build
          END_TIME=$(date +%s)
          DURATION=$((END_TIME - START_TIME))
          echo "duration=$DURATION" >> $GITHUB_OUTPUT

      # 发送构建指标
      - name: Send metrics
        if: always()
        run: |
          curl -X POST "https://metrics.example.com/api/v1/series" \
            -H "Content-Type: application/json" \
            -d '{
              "series": [{
                "metric": "ci.build.duration",
                "points": [[ '${{ steps.build.outputs.duration }}' ]],
                "tags": ["repo:${{ github.repository }}", "branch:${{ github.ref_name }}"]
              }]
            }'

      # 发送通知
      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "❌ 构建失败: ${{ github.repository }}@${{ github.ref_name }}"
            }
```

### Prometheus 告警集成

```yaml
# CI/CD 告警规则
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cicd-alerts
  namespace: monitoring
spec:
  groups:
  - name: cicd
    rules:
    - alert: CIBuildFailureRate
      expr: |
        sum(rate(ci_build_total{status="failed"}[1h]))
        /
        sum(rate(ci_build_total[1h]))
        > 0.3
      for: 30m
      labels:
        severity: warning
      annotations:
        summary: "CI 构建失败率过高"
        description: "过去1小时构建失败率: {{ $value | humanizePercentage }}"

    - alert: CIDeploymentStuck
      expr: |
        time() - ci_deployment_timestamp{status="started"} > 1800
      labels:
        severity: warning
      annotations:
        summary: "部署卡住超过30分钟"
        description: "部署 {{ $labels.version }} 已运行超过30分钟"
```

### 日志聚合

```yaml
# CI/CD 日志收集配置
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build with structured logging
        run: |
          npm run build 2>&1 | while IFS= read -r line; do
            echo "{\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"level\":\"info\",\"message\":\"$line\",\"pipeline\":\"${{ github.workflow }}\",\"job\":\"build\"}"
          done | tee build.log

      - name: Upload logs
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: build-logs
          path: build.log
```

---

## 发布管理

### Release Notes 自动生成

```yaml
# 自动生成 Release Notes
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      # 使用 conventional-commits 生成 Release Notes
      - name: Generate Release Notes
        id: notes
        run: |
          # 获取上一个 tag
          PREV_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
          
          if [ -z "$PREV_TAG" ]; then
            CHANGES=$(git log --pretty=format:"- %s (%h)" HEAD)
          else
            CHANGES=$(git log --pretty=format:"- %s (%h)" ${PREV_TAG}..HEAD)
          fi
          
          # 分类变更
          FEATURES=$(echo "$CHANGES" | grep "^- feat" || true)
          FIXES=$(echo "$CHANGES" | grep "^- fix" || true)
          OTHER=$(echo "$CHANGES" | grep -v "^- feat" | grep -v "^- fix" || true)
          
          # 生成 Release Notes
          cat > release-notes.md << EOF
          ## 🚀 Release ${{ github.ref_name }}
          
          ### ✨ New Features
          ${FEATURES:-No new features}
          
          ### 🐛 Bug Fixes
          ${FIXES:-No bug fixes}
          
          ### 📦 Other Changes
          ${OTHER:-No other changes}
          
          ### 📦 Installation
          \`\`\`bash
          npm install my-package@${{ github.ref_name }}
          \`\`\`
          EOF

      # 创建 GitHub Release
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          body_path: release-notes.md
          draft: false
          prerelease: ${{ contains(github.ref_name, '-rc') }}
```

### CHANGELOG 维护

```yaml
# .github/workflows/changelog.yml
name: Update CHANGELOG

on:
  push:
    branches: [main]

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate CHANGELOG
        uses: orhun/git-cliff-action@v2
        with:
          config: cliff.toml
          args: --latest --strip header
        env:
          OUTPUT: CHANGELOG.md

      - name: Commit CHANGELOG
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add CHANGELOG.md
          git diff --staged --quiet || git commit -m "docs: update CHANGELOG.md [skip ci]"
          git push
```

**cliff.toml 配置：**

```toml
# git-cliff 配置
[changelog]
header = """
# Changelog\n
All notable changes to this project will be documented in this file.\n
"""
body = """
{% if version %}\
    ## [{{ version | trim_start_matches(pat="v") }}] - {{ timestamp | date(format="%Y-%m-%d") }}
{% else %}\
    ## [unreleased]
{% endif %}\
{% for group, commits in commits | group_by(attribute="group") %}
    ### {{ group | striptags | trim | upper_first }}
    {% for commit in commits %}
        - {% if commit.scope %}**{{ commit.scope }}:** {% endif %}\
            {{ commit.message | upper_first | trim }}\
            ([{{ commit.id | truncate(length=7, end="") }}]({{ commit.id }}))\
    {% endfor %}
{% endfor %}\n
"""

[git]
conventional_commits = true
filter_unconventional = true
split_commits = false

commit_parsers = [
  { message = "^feat", group = "✨ Features" },
  { message = "^fix", group = "🐛 Bug Fixes" },
  { message = "^doc", group = "📚 Documentation" },
  { message = "^perf", group = "⚡ Performance" },
  { message = "^refactor", group = "♻️ Refactoring" },
  { message = "^style", group = "🎨 Styling" },
  { message = "^test", group = "🧪 Tests" },
  { message = "^chore", group = "⚙️ Miscellaneous" },
  { message = "^ci", group = "🔧 CI/CD" },
]

# 版本标记
[tag_pattern = "v[0-9]*"]
```

### 版本标记策略

```yaml
# 自动版本标记
name: Auto Version

on:
  push:
    branches: [main]

jobs:
  version:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Determine version bump
        id: bump
        run: |
          # 获取最近的 tag
          LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
          
          # 获取自上次 tag 以来的提交
          COMMITS=$(git log ${LATEST_TAG}..HEAD --pretty=format:"%s")
          
          # 根据 conventional commits 确定版本升级类型
          if echo "$COMMITS" | grep -q "^feat"; then
            BUMP="minor"
          elif echo "$COMMITS" | grep -q "^fix"; then
            BUMP="patch"
          elif echo "$COMMITS" | grep -q "BREAKING CHANGE"; then
            BUMP="major"
          else
            BUMP="none"
          fi
          
          echo "bump=$BUMP" >> $GITHUB_OUTPUT
          echo "current=$LATEST_TAG" >> $GITHUB_OUTPUT

      - name: Create tag
        if: steps.bump.outputs.bump != 'none'
        run: |
          CURRENT=${{ steps.bump.outputs.current }}
          BUMP=${{ steps.bump.outputs.bump }}
          
          # 计算新版本号
          VERSION=$(echo $CURRENT | sed 's/^v//' | awk -F. -v bump=$BUMP '{
            if (bump == "major") printf "%d.0.0", $1+1;
            else if (bump == "minor") printf "%d.%d.0", $1, $2+1;
            else printf "%d.%d.%d", $1, $2, $3+1;
          }')
          
          # 创建并推送 tag
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag -a "v${VERSION}" -m "Release v${VERSION}"
          git push origin "v${VERSION}"
```

---

## CI/CD 最佳实践

### Pipeline 优化

| 优化策略 | 说明 | 效果 |
|---|---|---|
| 缓存依赖 | 缓存 node_modules、pip cache 等 | 构建时间减少 50%+ |
| 并行执行 | 独立任务并行运行 | 总时间减少 30-50% |
| 增量构建 | 只构建变更部分 | 构建时间减少 40%+ |
| 早期失败 | 快速检查放在前面 | 快速反馈 |
| 矩阵构建 | 多版本/多平台并行测试 | 覆盖更全面 |
| 条件执行 | 只在必要时运行特定步骤 | 节省资源 |

```yaml
# 优化的 CI Pipeline
name: Optimized CI

on: [push, pull_request]

jobs:
  # 快速检查（早期失败）
  quick-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  # 单元测试（并行）
  unit-tests:
    needs: quick-checks
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage

  # 集成测试
  integration-tests:
    needs: quick-checks
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration

  # E2E 测试
  e2e-tests:
    needs: [unit-tests, integration-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e

  # 安全扫描（并行）
  security:
    needs: quick-checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: github/codeql-action/analyze@v3

  # 构建（所有测试通过后）
  build:
    needs: [e2e-tests, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
```

### CI/CD 安全检查清单

| 检查项 | 说明 | 工具 |
|---|---|---|
| 依赖漏洞 | 检查已知漏洞 | npm audit, Snyk, Trivy |
| 密钥泄露 | 检查代码中的密钥 | GitLeaks, TruffleHog |
| 镜像安全 | 扫描容器镜像漏洞 | Trivy, Grype |
| 配置安全 | 检查 IaC 安全问题 | tfsec, checkov, kubesec |
| SBOM 生成 | 生成软件物料清单 | Syft, CycloneDX |
| 签名验证 | 验证依赖和镜像签名 | cosign, sigstore |
| 权限最小化 | CI/CD 权限最小化 | GitHub Environments |
| 审计日志 | 记录所有 CI/CD 操作 | GitHub Audit Log |

---

## 总结

本章节深入探讨了 CI/CD 与 DevOps 的高级主题：

| 主题 | 核心要点 |
|---|---|
| GitHub Actions 深度 | 自定义 Action 开发、Reusable Workflows、环境变量与密钥管理 |
| CI/CD 安全 | SAST/SCA/密钥扫描/供应链安全的完整安全扫描流程 |
| 部署自动化 | ArgoCD/FluxCD GitOps 实践与对比 |
| 基础设施即代码 | Terraform 模块化、Pulumi 编程语言 IaC |
| 可观测性集成 | CI/CD Pipeline 监控、告警、日志聚合 |
| 发布管理 | Release Notes 自动生成、CHANGELOG 维护、版本标记 |

> 💡 **关键建议**：CI/CD 不仅仅是一个工具，而是一种文化和实践。从小处开始，逐步建立自动化的构建、测试和部署流程。安全应该是内建的，而不是事后添加的。投资于可观测性，让你的 CI/CD 流程透明可追踪。


---

## CI/CD Pipeline 设计模式

### 构建管道模式

```mermaid
graph TB
    subgraph "快速反馈层"
        Lint[代码检查] --> |< 2min| TypeCheck[类型检查]
        TypeCheck --> |< 1min| UnitTest[单元测试]
    end

    subgraph "质量保障层"
        UnitTest --> |并行| IntegrationTest[集成测试]
        UnitTest --> |并行| SecurityScan[安全扫描]
        IntegrationTest --> |< 10min| Coverage[覆盖率报告]
    end

    subgraph "验证层"
        Coverage --> E2ETest[E2E 测试]
        SecurityScan --> E2ETest
        E2ETest --> |< 15min| PerformanceTest[性能测试]
    end

    subgraph "部署层"
        PerformanceTest --> BuildArtifact[构建产物]
        BuildArtifact --> DeployStaging[部署 Staging]
        DeployStaging --> SmokeTest[冒烟测试]
        SmokeTest --> DeployProd[部署生产]
    end
```

### Pipeline 并行化策略

```yaml
# 优化的并行 Pipeline
name: Parallel Pipeline

on: push

jobs:
  # 第一层：快速检查（串行，快速失败）
  stage-1-quick:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  # 第二层：并行测试
  stage-2-unit:
    needs: stage-1-quick
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --coverage

  stage-2-security:
    needs: stage-1-quick
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: github/codeql-action/analyze@v3

  stage-2-docker:
    needs: stage-1-quick
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - name: Build Docker image
        run: docker build -t app:${{ github.sha }} .
      - name: Scan image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'app:${{ github.sha }}'

  # 第三层：集成测试（依赖第二层）
  stage-3-integration:
    needs: [stage-2-unit, stage-2-security, stage-2-docker]
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
      redis:
        image: redis:7
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration

  # 第四层：部署（所有测试通过后）
  stage-4-deploy:
    needs: stage-3-integration
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: ./scripts/deploy.sh production ${{ github.sha }}
```

### 测试并行化

```yaml
# 测试分片并行
jobs:
  test-shards:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
        total-shards: [4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci

      # 使用 Jest 分片
      - name: Run tests (shard ${{ matrix.shard }}/${{ matrix.total-shards }})
        run: |
          npx jest --shard=${{ matrix.shard }}/${{ matrix.total-shards }} \
            --coverage \
            --coverageDirectory=coverage-${{ matrix.shard }}

      # 上传覆盖率
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-${{ matrix.shard }}
          path: coverage-${{ matrix.shard }}/

  merge-coverage:
    needs: test-shards
    runs-on: ubuntu-latest
    steps:
      # 下载所有覆盖率报告
      - uses: actions/download-artifact@v4
        with:
          pattern: coverage-*
          path: coverage/
          merge-multiple: true

      # 合并覆盖率
      - name: Merge coverage
        run: |
          npx nyc merge coverage/ coverage/merged.json
          npx nyc report --reporter=lcov --reporter=text
```

---

## CI/CD 环境管理

### 环境配置矩阵

```yaml
# 环境配置管理
name: Environment Management

on:
  workflow_dispatch:
    inputs:
      environment:
        description: '部署环境'
        required: true
        type: choice
        options:
          - dev
          - staging
          - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
      - uses: actions/checkout@v4

      # 加载环境配置
      - name: Load environment config
        id: config
        run: |
          CONFIG_FILE="config/${{ inputs.environment }}.json"
          echo "config=$(cat $CONFIG_FILE | jq -c .)" >> $GITHUB_OUTPUT

      # 使用环境变量
      - name: Configure environment
        run: |
          echo "API_URL=${{ fromJson(steps.config.outputs.config).api_url }}" >> $GITHUB_ENV
          echo "LOG_LEVEL=${{ fromJson(steps.config.outputs.config).log_level }}" >> $GITHUB_ENV
          echo "REPLICAS=${{ fromJson(steps.config.outputs.config).replicas }}" >> $GITHUB_ENV

      # 部署
      - name: Deploy
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
        run: |
          helm upgrade --install app ./charts/app \
            --namespace ${{ inputs.environment }} \
            --set env.API_URL=$API_URL \
            --set env.LOG_LEVEL=$LOG_LEVEL \
            --set replicaCount=$REPLICAS
```

**环境配置文件示例：**

```json
// config/dev.json
{
  "api_url": "https://api-dev.example.com",
  "log_level": "debug",
  "replicas": 1,
  "features": {
    "new_ui": true,
    "beta_api": true
  },
  "database": {
    "host": "db-dev.example.com",
    "pool_size": 5
  },
  "cache": {
    "ttl": 60
  }
}

// config/staging.json
{
  "api_url": "https://api-staging.example.com",
  "log_level": "info",
  "replicas": 2,
  "features": {
    "new_ui": true,
    "beta_api": false
  },
  "database": {
    "host": "db-staging.example.com",
    "pool_size": 10
  },
  "cache": {
    "ttl": 300
  }
}

// config/production.json
{
  "api_url": "https://api.example.com",
  "log_level": "warn",
  "replicas": 5,
  "features": {
    "new_ui": false,
    "beta_api": false
  },
  "database": {
    "host": "db.example.com",
    "pool_size": 20
  },
  "cache": {
    "ttl": 600
  }
}
```

---

## CI/CD 高级用法

### 条件执行与矩阵策略

```yaml
# 复杂条件执行
jobs:
  smart-pipeline:
    runs-on: ubuntu-latest
    steps:
      # 仅在特定文件变更时运行
      - name: Check for API changes
        id: check
        uses: dorny/paths-filter@v2
        with:
          filters: |
            api:
              - 'src/api/**'
            frontend:
              - 'src/frontend/**'
            database:
              - 'prisma/**'
            docker:
              - 'Dockerfile'
              - 'docker-compose.yml'

      # API 变更时运行 API 测试
      - name: Run API tests
        if: steps.check.outputs.api == 'true'
        run: npm run test:api

      # 前端变更时运行前端测试
      - name: Run frontend tests
        if: steps.check.outputs.frontend == 'true'
        run: npm run test:frontend

      # 数据库变更时运行迁移测试
      - name: Test database migrations
        if: steps.check.outputs.database == 'true'
        run: npm run test:migrations

      # Docker 变更时构建并推送镜像
      - name: Build and push Docker image
        if: steps.check.outputs.docker == 'true'
        run: docker build -t app:${{ github.sha }} .

  # 复杂矩阵策略
  cross-platform:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node-version: [18, 20, 22]
        exclude:
          - os: macos-latest
            node-version: 18
        include:
          - os: ubuntu-latest
            node-version: 20
            coverage: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm test

      - name: Upload coverage
        if: matrix.coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

### 动态配置

```yaml
# 动态生成 Job 配置
jobs:
  generate-matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4

      - name: Generate matrix
        id: set-matrix
        run: |
          # 根据变更的文件动态生成测试矩阵
          CHANGED_FILES=$(git diff --name-only HEAD^ HEAD)
          
          if echo "$CHANGED_FILES" | grep -q "src/frontend/"; then
            FRONTEND="true"
          else
            FRONTEND="false"
          fi
          
          if echo "$CHANGED_FILES" | grep -q "src/api/"; then
            API="true"
          else
            API="false"
          fi
          
          MATRIX=$(jq -n \
            --arg frontend "$FRONTEND" \
            --arg api "$API" \
            '{
              include: [
                (if $frontend == "true" then {test: "frontend", suite: "e2e"} else empty end),
                (if $api == "true" then {test: "api", suite: "integration"} else empty end)
              ]
            }')
          
          echo "matrix=$MATRIX" >> $GITHUB_OUTPUT

  run-tests:
    needs: generate-matrix
    if: needs.generate-matrix.outputs.matrix != '{"include":[]}'
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.generate-matrix.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:${{ matrix.test }} -- --suite=${{ matrix.suite }}
```

### 缓存策略

```yaml
# 高级缓存策略
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # npm 缓存
      - name: Cache npm dependencies
        uses: actions/cache@v4
        with:
          path: ~/.npm
          key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            ${{ runner.os }}-npm-

      # 构建缓存
      - name: Cache build output
        uses: actions/cache@v4
        with:
          path: dist/
          key: ${{ runner.os }}-build-${{ hashFiles('src/**') }}
          restore-keys: |
            ${{ runner.os }}-build-

      # TypeScript 缓存
      - name: Cache TypeScript
        uses: actions/cache@v4
        with:
          path: node_modules/.cache/
          key: ${{ runner.os }}-ts-${{ hashFiles('tsconfig.json') }}

      # Docker 层缓存
      - name: Build Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - run: npm ci
      - run: npm run build
```

---

## CI/CD 监控与告警

### 构建指标收集

```typescript
// CI/CD 指标收集脚本
interface CIMetrics {
  repo: string;
  branch: string;
  commit: string;
  workflow: string;
  job: string;
  status: 'success' | 'failure' | 'cancelled';
  duration: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

class CIMetricsCollector {
  private metrics: CIMetrics[] = [];

  record(metric: CIMetrics): void {
    this.metrics.push(metric);
    this.sendToBackend(metric);
  }

  private async sendToBackend(metric: CIMetrics): Promise<void> {
    try {
      await fetch('https://metrics.example.com/api/v1/ci', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.METRICS_TOKEN}`,
        },
        body: JSON.stringify(metric),
      });
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }

  getStats(): {
    totalBuilds: number;
    successRate: number;
    averageDuration: number;
    failureRate: number;
  } {
    const total = this.metrics.length;
    const success = this.metrics.filter(m => m.status === 'success').length;
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total;

    return {
      totalBuilds: total,
      successRate: (success / total) * 100,
      averageDuration: avgDuration,
      failureRate: ((total - success) / total) * 100,
    };
  }
}

// 使用示例
const collector = new CIMetricsCollector();

collector.record({
  repo: 'example/web-app',
  branch: 'main',
  commit: 'abc123',
  workflow: 'CI',
  job: 'build',
  status: 'success',
  duration: 120,
  timestamp: new Date(),
  metadata: {
    nodeVersion: '20',
    os: 'ubuntu-latest',
  },
});
```

### 告警规则

```yaml
# Prometheus 告警规则
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: cicd-alerts
  namespace: monitoring
spec:
  groups:
  - name: cicd-metrics
    rules:
    # 构建失败率告警
    - alert: HighBuildFailureRate
      expr: |
        sum(rate(ci_build_total{status="failed"}[1h]))
        /
        sum(rate(ci_build_total[1h]))
        > 0.2
      for: 30m
      labels:
        severity: warning
        team: devops
      annotations:
        summary: "CI 构建失败率超过 20%"
        description: "过去1小时构建失败率: {{ $value | humanizePercentage }}"

    # 构建时间过长告警
    - alert: SlowBuildDuration
      expr: |
        histogram_quantile(0.95, sum(rate(ci_build_duration_seconds_bucket[1h])) by (le))
        > 600
      for: 1h
      labels:
        severity: warning
        team: devops
      annotations:
        summary: "P95 构建时间超过 10 分钟"
        description: "当前 P95 构建时间: {{ $value | humanizeDuration }}"

    # 部署频率下降告警
    - alert: LowDeploymentFrequency
      expr: |
        sum(rate(ci_deployment_total{environment="production"}[7d]))
        < 0.1
      for: 1d
      labels:
        severity: info
        team: devops
      annotations:
        summary: "生产环境部署频率下降"
        description: "过去7天平均每天部署次数不足 0.1"

    # 变更失败率告警
    - alert: HighChangeFailureRate
      expr: |
        sum(rate(ci_deployment_total{status="failed"}[7d]))
        /
        sum(rate(ci_deployment_total[7d]))
        > 0.15
      for: 1d
      labels:
        severity: warning
        team: devops
      annotations:
        summary: "变更失败率超过 15%"
        description: "过去7天变更失败率: {{ $value | humanizePercentage }}"
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "CI/CD Metrics",
    "tags": ["cicd", "devops"],
    "panels": [
      {
        "title": "构建成功率",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(ci_build_total{status=\"success\"}[24h])) / sum(rate(ci_build_total[24h])) * 100",
            "legendFormat": "成功率"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                { "value": 0, "color": "red" },
                { "value": 80, "color": "yellow" },
                { "value": 95, "color": "green" }
              ]
            }
          }
        }
      },
      {
        "title": "构建时间趋势",
        "type": "timeseries",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum(rate(ci_build_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P50"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(ci_build_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P95"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(ci_build_duration_seconds_bucket[5m])) by (le))",
            "legendFormat": "P99"
          }
        ]
      },
      {
        "title": "部署频率",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(rate(ci_deployment_total[1h])) by (environment)",
            "legendFormat": "{{environment}}"
          }
        ]
      },
      {
        "title": "变更失败率",
        "type": "gauge",
        "targets": [
          {
            "expr": "sum(rate(ci_deployment_total{status=\"failed\"}[7d])) / sum(rate(ci_deployment_total[7d])) * 100",
            "legendFormat": "失败率"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "max": 100,
            "thresholds": {
              "steps": [
                { "value": 0, "color": "green" },
                { "value": 10, "color": "yellow" },
                { "value": 20, "color": "red" }
              ]
            }
          }
        }
      }
    ]
  }
}
```

---

## DORA 指标

### 四个关键指标

| 指标 | 说明 | 精英水平 | 高水平 | 中水平 | 低水平 |
|---|---|---|---|---|---|
| 部署频率 | 部署到生产的频率 | 按需（每天多次） | 每天-每周 | 每周-每月 | 每月-每半年 |
| 变更前置时间 | 从提交到部署的时间 | < 1小时 | 1天-1周 | 1周-1月 | 1月-6月 |
| 变更失败率 | 导致失败的部署比例 | 0-15% | 16-30% | 16-30% | 46-60% |
| 服务恢复时间 | 从故障到恢复的时间 | < 1小时 | < 1天 | 1天-1周 | 1周-1月 |

### DORA 指标实现

```typescript
// DORA 指标计算服务
interface DeploymentEvent {
  id: string;
  timestamp: Date;
  environment: string;
  status: 'success' | 'failure' | 'rollback';
  commitSha: string;
  commitTimestamp: Date;
  duration: number;
  rollbackTime?: Date;
}

class DORAMetrics {
  private deployments: DeploymentEvent[] = [];

  addDeployment(event: DeploymentEvent): void {
    this.deployments.push(event);
  }

  // 部署频率（每天部署次数）
  getDeploymentFrequency(days: number = 30): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentDeployments = this.deployments.filter(
      d => d.timestamp >= cutoff && d.environment === 'production'
    );

    return recentDeployments.length / days;
  }

  // 变更前置时间（从提交到部署的中位时间）
  getLeadTimeForChanges(): number {
    const leadTimes = this.deployments
      .filter(d => d.environment === 'production' && d.status === 'success')
      .map(d => d.timestamp.getTime() - d.commitTimestamp.getTime());

    if (leadTimes.length === 0) return 0;

    leadTimes.sort((a, b) => a - b);
    const mid = Math.floor(leadTimes.length / 2);
    return leadTimes.length % 2 !== 0
      ? leadTimes[mid]
      : (leadTimes[mid - 1] + leadTimes[mid]) / 2;
  }

  // 变更失败率
  getChangeFailureRate(days: number = 30): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const recentDeployments = this.deployments.filter(
      d => d.timestamp >= cutoff && d.environment === 'production'
    );

    if (recentDeployments.length === 0) return 0;

    const failures = recentDeployments.filter(d => d.status === 'failure').length;
    return failures / recentDeployments.length;
  }

  // 平均恢复时间
  getMeanTimeToRecovery(): number {
    const recoveryTimes = this.deployments
      .filter(d => d.status === 'rollback' && d.rollbackTime)
      .map(d => d.rollbackTime!.getTime() - d.timestamp.getTime());

    if (recoveryTimes.length === 0) return 0;

    return recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length;
  }

  // 获取 DORA 等级
  getDORALevel(): {
    deploymentFrequency: string;
    leadTime: string;
    changeFailureRate: string;
    recoveryTime: string;
    overall: string;
  } {
    const freq = this.getDeploymentFrequency();
    const leadTime = this.getLeadTimeForChanges();
    const failureRate = this.getChangeFailureRate();
    const recoveryTime = this.getMeanTimeToRecovery();

    const level = (value: number, thresholds: number[], labels: string[]): string => {
      for (let i = 0; i < thresholds.length; i++) {
        if (value <= thresholds[i]) return labels[i];
      }
      return labels[labels.length - 1];
    };

    return {
      deploymentFrequency: level(freq, [1, 0.5, 0.14], ['精英', '高', '中', '低']),
      leadTime: level(leadTime / (1000 * 60 * 60), [1, 24 * 7, 24 * 30], ['精英', '高', '中', '低']),
      changeFailureRate: level(failureRate * 100, [15, 30, 45], ['精英', '高', '中', '低']),
      recoveryTime: level(recoveryTime / (1000 * 60 * 60), [1, 24, 24 * 7], ['精英', '高', '中', '低']),
      overall: '计算中...',
    };
  }
}
```

---

## 总结

本章节涵盖了 CI/CD 与 DevOps 的高级主题：

| 主题 | 核心要点 |
|---|---|
| GitHub Actions 深度 | 自定义 Action、Reusable Workflows、环境变量与密钥管理 |
| CI/CD 安全 | SAST/SCA/密钥扫描/供应链安全完整流程 |
| 部署自动化 | ArgoCD/FluxCD GitOps 实践 |
| 基础设施即代码 | Terraform 模块化、Pulumi 编程语言 IaC |
| 可观测性集成 | Pipeline 监控、告警、日志聚合 |
| 发布管理 | Release Notes 自动生成、CHANGELOG、版本标记 |
| Pipeline 设计模式 | 并行化、分层、缓存策略 |
| 环境管理 | 多环境配置、动态配置 |
| 监控与告警 | 指标收集、Prometheus 告警、Grafana Dashboard |
| DORA 指标 | 部署频率、变更前置时间、变更失败率、恢复时间 |

> 💡 **最终建议**：CI/CD 是现代软件开发的基石。从简单开始，逐步完善。记住，最好的 CI/CD 是团队真正使用的 CI/CD。持续改进，让自动化成为团队文化的一部分。
