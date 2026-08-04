<div align="center"><a name="readme-top"></a>

# PureChat

轻量、私密、可拓展的 AI 聊天应用。

基于 Next.js 16 与 Vercel AI SDK 构建，支持多模型对话、联网搜索、文档解析与自托管部署。

[文档](#-文档) · [快速开始](#-快速开始) · [反馈问题][github-issues-link]

<!-- SHIELD GROUP -->

[![][github-release-shield]][github-release-link]
[![][github-license-shield]][github-license-link]
[![][github-stars-shield]][github-stars-link]
[![][github-issues-shield]][github-issues-link]

<sup>你的专属 AI 对话空间</sup>

</div>

<details>
<summary><kbd>目录</kbd></summary>

#### TOC

- [👋 项目简介](#-项目简介)
- [✨ 特性一览](#-特性一览)
  - [对话：多模型 AI 聊天](#对话多模型-ai-聊天)
  - [认证：灵活的用户体系](#认证灵活的用户体系)
  - [搜索：联网获取实时信息](#搜索联网获取实时信息)
  - [扩展：Monorepo 模块化架构](#扩展monorepo-模块化架构)
- [🛳 快速开始](#-快速开始)
  - [前置要求](#前置要求)
  - [本地开发](#本地开发)
  - [数据库迁移](#数据库迁移)
  - [部署到 Vercel](#部署到-vercel)
- [⚙️ 环境变量](#️-环境变量)
- [📦 工作区包](#-工作区包)
- [📁 项目结构](#-项目结构)
- [⌨️ 开发命令](#️-开发命令)
- [📚 文档](#-文档)
- [🤝 参与贡献](#-参与贡献)
- [📝 License](#-license)

<br/>

</details>

<br/>

## 👋 项目简介

PureChat（PureChatNext）是一个面向自托管场景的 AI 聊天 Web 应用。架构为 **Vite SPA（react-router）+ Next.js BFF**：业务 UI 走 SPA，Next 保留 API / auth / 生产 SPA HTML 壳，同域部署。

> \[!IMPORTANT]
>
> **收藏项目**，你将从 GitHub 上无延迟地接收所有发布通知～ ⭐️

<details><summary><kbd>Star History</kbd></summary>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Hyk260%2FPureChatNext&theme=dark&type=Date">
    <img src="https://api.star-history.com/svg?repos=Hyk260%2FPureChatNext&type=Date">
  </picture>
</details>

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ✨ 特性一览

### 对话：多模型 AI 聊天

基于 [Vercel AI SDK](https://sdk.vercel.ai/) 构建流式对话体验，支持 OpenAI、DeepSeek 等主流模型提供商，聊天入口位于 `/chat`。

- **流式响应**：实时输出 AI 回复，低延迟交互
- **多 Provider**：通过环境变量灵活切换模型与代理地址
- **Tool Calling**：可扩展工具调用能力

<div align="right">

[![][back-to-top]](#readme-top)

</div>

### 认证：灵活的用户体系

基于 [Better Auth](https://www.better-auth.com/) 实现完整用户认证，替代传统 JWT 手写逻辑，开箱即用。

- **邮箱注册 / 登录**：支持密码登录与邮箱验证
- **魔法链接**：免密登录（需配置邮件服务）
- **SSO 单点登录**：GitHub、Google、Apple、微信、飞书等 OAuth 提供商
- **个人资料管理**：头像、用户名、密码、关联账号等设置页

> 邮件服务配置见 [docs/self-hosting/auth/email.zh-CN.md](./docs/self-hosting/auth/email.zh-CN.md)

<div align="right">

[![][back-to-top]](#readme-top)

</div>

### 搜索：联网获取实时信息

内置搜索聚合与网页爬虫模块，让 AI 能够检索互联网并阅读网页内容。

- **多搜索引擎**：SearXNG、Search1API、Google、Brave 等，通过 `SEARCH_PROVIDERS` 链式调用
- **多爬虫实现**：naive、firecrawl、tavily、jina、browserless 等，通过 `CRAWLER_IMPLS` 配置
- **文档解析**：PDF、Word、Excel、PPT 等格式加载（`@pure/file-loaders`）

> 详细配置见 [docs/self-hosting/online-search.zh-CN.md](./docs/self-hosting/online-search.zh-CN.md)

<div align="right">

[![][back-to-top]](#readme-top)

</div>

### 扩展：Monorepo 模块化架构

采用 pnpm workspace 组织代码，核心能力拆分为 `@pure/*` 内部包，便于独立测试与复用。

- **环境变量校验**：`@pure/env`，基于 `@t3-oss/env-core` + Zod
- **类型安全**：TypeScript 全栈，Drizzle ORM 管理 PostgreSQL Schema
- **UI 组件**：Tailwind CSS 4 + `@lobehub/ui` / antd

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🛳 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) ≥ 20（见 `.nvmrc`）
- [pnpm](https://pnpm.io/) ≥ 10（见 `packageManager` 字段）
- PostgreSQL 17 数据库（可使用 [Supabase](https://supabase.com) 或项目提供的本地实例）

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/Hyk260/PureChatNext.git
cd PureChatNext

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 DATABASE_URL、OPENAI_API_KEY 等

# 可选：Docker 启动本地依赖（PostgreSQL / Redis / RustFS / SearXNG）
pnpm docker:setup:dev
pnpm dev:docker
pnpm db:migrate

# 启动开发（并发 Next :3000 + Vite SPA :5174，需本机 bun）
pnpm dev

# 需要 Alt+Shift 点击元素跳转源码时
pnpm dev:inspect

# 或分终端
pnpm dev:next   # API / BFF → http://localhost:3000
pnpm dev:spa    # UI → http://localhost:5174（/api 代理到 Next）
```

本地请打开 **<http://localhost:5174>**（SPA 端口）；不要依赖 Next `:3000` 上的业务页。

> \[!TIP]
>
> 完整环境变量说明见 [docs/env-setup.zh-CN.md](./docs/env-setup.zh-CN.md) 与 [docs/quick-start.zh-CN.md](./docs/quick-start.zh-CN.md)

### 数据库迁移

```bash
pnpm db:check       # 校验 Drizzle 配置
pnpm db:generate    # 根据 Schema 变更生成迁移文件
pnpm db:migrate     # 执行迁移
pnpm db:studio      # 打开 Drizzle Studio
```

迁移流程详见 [docs/drizzle-setup.zh-CN.md](./docs/drizzle-setup.zh-CN.md)。

### 部署到 Vercel

仍为**单项目**部署（Framework：Next.js）。仓库已含 `vercel.json`：

| 设置            | 值                                                |
| --------------- | ------------------------------------------------- |
| Install Command | `pnpm install`                                    |
| Build Command   | `pnpm build`（`build:spa` → copy → `next build`） |

环境变量与改造前相同，无需为 SPA 单独加一套。

部署前请确保：

1. 在平台环境变量中配置 `DATABASE_URL`、`OPENAI_API_KEY` 等必填项
2. 设置 `APP_URL` 为生产域名
3. 配置 `ALLOWED_ORIGINS` 为实际前端域名（生产环境勿使用 `*`）
4. 运行数据库迁移（可在 CI 或部署脚本中执行 `pnpm db:migrate`）

生产同域：静态资源 `/_spa/**`（长缓存）；未匹配 UI 路径 fallback 到 SPA HTML 壳。

### Docker 自托管

仓库同时提供可本地构建的生产镜像与完整 Compose：

```bash
pnpm docker:setup:deploy
# 修改 docker-compose/deploy/.env 中的域名和模型密钥
docker compose --env-file docker-compose/deploy/.env -f docker-compose/deploy/docker-compose.yml up -d --build --wait
```

完整说明见 [Docker 自托管](./docs/self-hosting/docker.zh-CN.md)。

<div align="right">
[![][back-to-top]](#readme-top)

</div>

## ⚙️ 环境变量

本项目通过 `packages/env` 集中管理环境变量校验。常用配置如下：

| 环境变量                       | 类型 | 描述                                 | 示例                                          |
| ------------------------------ | ---- | ------------------------------------ | --------------------------------------------- |
| `DATABASE_URL`                 | 必选 | PostgreSQL 连接字符串                | `postgresql://user:pass@host:5432/db`         |
| `DATABASE_DRIVER`              | 必选 | `neon` 强制 SSL；本地 PostgreSQL 用 `node` | `node`                                  |
| `KEY_VAULTS_SECRET`            | 必选 | 敏感信息加密密钥                     | `openssl rand -base64 32`                     |
| `OPENAI_API_KEY`               | 推荐 | OpenAI API 密钥                      | `sk-xxxxxx`                                   |
| `OPENAI_PROXY_URL`             | 可选 | OpenAI 代理地址                      | `https://api.openai.com/v1`                   |
| `DEEPSEEK_API_KEY`             | 可选 | DeepSeek API 密钥                    | `sk-xxxxxx`                                   |
| `APP_URL`                      | 推荐 | 应用对外地址（本地用 SPA）           | 本地 `http://localhost:5174`；生产正式域名    |
| `AUTH_SSO_PROVIDERS`           | 可选 | 启用的 OAuth 提供商                  | `github,wechat`                               |
| `AUTH_EMAIL_VERIFICATION`      | 可选 | 启用邮箱验证                         | `1`                                           |
| `AUTH_EMAIL_VERIFICATION_MODE` | 可选 | 注册验证方式：`otp`（默认）或 `link` | `otp`                                         |
| `AUTH_ENABLE_MAGIC_LINK`       | 可选 | 启用魔法链接登录                     | `1`                                           |
| `SEARCH_PROVIDERS`             | 可选 | 搜索引擎链                           | `searxng,brave`                               |
| `CRAWLER_IMPLS`                | 可选 | 爬虫实现链                           | `naive,firecrawl`                             |
| `ALLOWED_ORIGINS`              | 可选 | CORS 允许源                          | `http://localhost:3000,http://localhost:5174` |

> \[!NOTE]
>
> 完整变量列表见 [.env.example](./.env.example) 与 [docs/env-setup.zh-CN.md](./docs/env-setup.zh-CN.md)

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📦 工作区包

| 包名                    | 路径                       | 描述                                          |
| ----------------------- | -------------------------- | --------------------------------------------- |
| `@pure/env`             | `packages/env`             | 环境变量 Zod 校验与模块划分                   |
| `@pure/types`           | `packages/types`           | 共享 TypeScript 类型                          |
| `@pure/utils`           | `packages/utils`           | 通用工具函数                                  |
| `@pure/file-loaders`    | `packages/file-loaders`    | 文档加载（PDF、DOCX、PPTX、Excel 等）         |
| `@pure/web-crawler`     | `packages/web-crawler`     | 网页爬虫多实现（naive、firecrawl、tavily 等） |
| `@pure/ssrf-safe-fetch` | `packages/ssrf-safe-fetch` | SSRF 安全的 fetch 封装                        |

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📁 项目结构

```plaintext
PureChatNext/
├── packages/                  # @pure/* 工作区包
│   ├── env/                   # 环境变量校验
│   ├── types/                 # 共享类型
│   ├── utils/                 # 共享工具
│   ├── file-loaders/          # 文档加载
│   ├── web-crawler/           # 网页爬虫
│   └── ssrf-safe-fetch/       # 安全 fetch
├── src/
│   ├── spa/                   # Vite SPA 入口与 Router
│   ├── features/              # 业务 UI（供 SPA 路由挂载）
│   ├── app/                   # Next：API / auth / 生产 SPA 壳
│   │   ├── api/               # REST API（auth、chat、rest-api…）
│   │   └── spa/               # 生产 HTML 壳（注入 __SERVER_CONFIG__）
│   ├── routes/                # react-router 薄层 page / layout
│   ├── database/              # Drizzle schema、models、migrations
│   ├── server/                # 服务端业务（搜索聚合等）
│   ├── libs/                  # Better Auth、工具库
│   └── components/            # 通用 React 组件
├── docs/                      # 文档
└── scripts/                   # 项目脚本（文件名统一使用 kebab-case）
    ├── copy-spa-build.mjs     # SPA 构建产物复制脚本
    └── shell/                 # Shell 脚本（kebab-case）
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## ⌨️ 开发命令

```bash
pnpm dev              # Next :3000 + SPA :5174（UI 请用 5174）
pnpm dev:inspect      # 同上，并启用 code-inspector（Alt+Shift 点击跳转源码）
pnpm dev:next         # 仅 Next API / BFF
pnpm dev:spa          # 仅 Vite SPA
pnpm build            # build:spa → copy → next build
pnpm start            # 生产启动（端口 3210）
pnpm lint             # ESLint 检查
pnpm gateway          # 运行 gateway 脚本
pnpm docker:setup:dev # 创建本地 Docker 配置（不覆盖已有文件）
pnpm docker:validate  # 校验开发/生产 Compose
pnpm dev:docker       # 启动本地 Docker 依赖（PG / Redis / RustFS / SearXNG）
pnpm dev:docker:down  # 停止本地 Docker 依赖（保留数据卷）
pnpm dev:docker:reset # 确认后清空卷、重建并执行 db:migrate
pnpm db:migrate       # 执行数据库迁移
pnpm db:studio        # Drizzle Studio
```

测试（Vitest）：

```bash
# 根目录测试（排除 packages/**）
pnpm exec vitest run --silent='passed-only' 'src/server/search/index.test.ts'

# 单个 workspace package
cd packages/web-crawler && pnpm test
```

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📚 文档

| 文档                                                                                   | 说明                     |
| -------------------------------------------------------------------------------------- | ------------------------ |
| [docs/quick-start.zh-CN.md](./docs/quick-start.zh-CN.md)                               | 快速开始与 Supabase 配置 |
| [docs/env-setup.zh-CN.md](./docs/env-setup.zh-CN.md)                                   | 环境变量详解             |
| [docs/drizzle-setup.zh-CN.md](./docs/drizzle-setup.zh-CN.md)                           | 数据库迁移流程           |
| [docs/self-hosting/postgresql-local.zh-CN.md](./docs/self-hosting/postgresql-local.zh-CN.md) | 本地 PostgreSQL 管理 |
| [docs/self-hosting/redis-local.zh-CN.md](./docs/self-hosting/redis-local.zh-CN.md)     | 本地 Redis 管理          |
| [docs/self-hosting/docker.zh-CN.md](./docs/self-hosting/docker.zh-CN.md)              | Docker 自托管与生产部署  |
| [docs/self-hosting/online-search.zh-CN.md](./docs/self-hosting/online-search.zh-CN.md) | 联网搜索与爬虫配置       |
| [docs/self-hosting/auth/email.zh-CN.md](./docs/self-hosting/auth/email.zh-CN.md)       | 邮件服务与邮箱验证       |
| [AGENTS.md](./AGENTS.md)                                                               | AI Agent 开发约定        |

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 🤝 参与贡献

欢迎通过 [Issues][github-issues-link] 或 Pull Request 参与贡献。提交前请确保：

- 使用 `pnpm` 管理依赖
- 通过 `pnpm lint` 检查
- 环境变量变更同步更新 `packages/env` 与 `.env.example`

<div align="right">

[![][back-to-top]](#readme-top)

</div>

## 📝 License

Copyright © 2025 [Hyk260][profile-link].

本项目基于 [MIT License](./LICENSE) 开源。

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[github-issues-link]: https://github.com/Hyk260/PureChatNext/issues
[github-issues-shield]: https://img.shields.io/github/issues/Hyk260/PureChatNext?color=ff80eb&labelColor=black&style=flat-square
[github-license-link]: https://github.com/Hyk260/PureChatNext/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square
[github-release-link]: https://github.com/Hyk260/PureChatNext/releases
[github-release-shield]: https://img.shields.io/github/v/release/Hyk260/PureChatNext?color=369eff&labelColor=black&logo=github&style=flat-square
[github-stars-link]: https://github.com/Hyk260/PureChatNext/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/Hyk260/PureChatNext?color=ffcb47&labelColor=black&style=flat-square
[profile-link]: https://github.com/Hyk260
