<div align="center">

<img alt="PureChat" height="112" src="./public/logos/purechat-appicon.svg" width="112" />

# PureChat

把你的 AI 助手接入微信和 QQ。

面向中文用户和小团队的开源自托管 AI 工作台，支持多模型、联网搜索、文件处理和私有部署。

[在线体验][online-demo-link] · [Vercel 部署][vercel-deploy-link] · [Docker 自托管](./docs/self-hosting/platform/docker.md) · [文档站][docs-site-link] · [讨论区][github-discussions-link]

[![][github-release-shield]][github-release-link]
[![][github-license-shield]][github-license-link]
[![][github-stars-shield]][github-stars-link]
[![][github-issues-shield]][github-issues-link]
[![][github-discussions-shield]][github-discussions-link]

</div>

<p align="center">
  <img src="./images/wechat-chat.png" alt="微信中与 PureChat 对话" width="280" />
  &nbsp;
  <img src="./images/qq-chat.png" alt="QQ 中与 PureChat 对话" width="280" />
</p>

<p align="center">
  <img src="./images/wechat-settings.png" alt="微信渠道设置" width="48%" />
  <img src="./images/qq-settings.png" alt="QQ 渠道设置" width="48%" />
</p>

## 目录

- [项目简介](#项目简介)
- [特性](#特性)
- [快速开始](#快速开始)
- [部署](#部署)
- [环境变量](#环境变量)
- [项目结构](#项目结构)
- [常用命令](#常用命令)
- [文档](#文档)
- [参与贡献](#参与贡献)
- [License](#license)

## 项目简介

PureChat（仓库名：[PureChatNext][repo-link]）让同一个 AI 助手同时服务于 **Web、微信和 QQ**。你可以直接使用 [在线体验][online-demo-link]，也可以把数据库、模型密钥、文件和聊天记录完整部署在自己的环境中。

与通用 ChatGPT Clone 相比，PureChat 优先解决中文用户的三个具体问题：

- **聊天入口不必迁移**：通过微信和 QQ Channel Gateway，在已有通讯工具中直接使用 AI
- **数据与成本可控**：支持自托管、自备模型 API Key、免费额度账本与用量明细
- **能力可以组合**：多模型、联网搜索、文件解析、Agent 和消息渠道共用一套工作台

技术栈：

- **前端**：Vite + React Router SPA，开发时运行在 `5174` 端口
- **服务端**：Next.js 16 BFF，负责 API、认证和生产环境的 SPA HTML 壳
- **数据层**：PostgreSQL + Drizzle ORM，可使用 Supabase、Neon 或本地 Docker
- **AI 能力**：Vercel AI SDK，支持 OpenAI、DeepSeek、PureChat / AI Gateway 等 Provider

生产环境以单个 Next.js 项目部署，SPA 静态资源与 API 共用同一域名。

```mermaid
flowchart LR
  WeChat[微信] --> Gateway[Channel Gateway]
  QQ[QQ] --> Gateway
  Web[Web SPA] --> Next[Next.js BFF]
  Gateway --> Next
  Next --> PG[(PostgreSQL)]
  Next --> LLM[OpenAI / DeepSeek / Gateway]
```

## 特性

### 微信与 QQ 渠道

在微信或 QQ 里扫码绑定后，即可私聊或群内 @ 助手，不必再打开单独的网页。

- 微信 iLink 扫码连接，并由 Channel Gateway 持续接收与回复消息
- QQ 扫码、WebSocket 与 Webhook 多种连接方式
- 渠道可选择 Agent、模型与 Provider，复用 Web 端能力
- 支持 `/agents`、`/new`、`/stop`、`/help` 等会话指令

配置说明见 [微信渠道](./docs/self-hosting/channels/wechat/setup.md) 与 [QQ 渠道](./docs/self-hosting/channels/qq/setup.md)。

### 多模型对话

- 流式输出与 Tool Calling
- 通过环境变量切换模型 Provider、API Key 和代理地址
- 支持 OpenAI、DeepSeek 等常用模型服务

### 用户认证

- 邮箱密码注册与登录
- 邮箱验证、魔法链接（需配置邮件服务）
- GitHub、Google、Apple、微信、飞书等 OAuth / SSO
- 个人资料、密码和关联账号管理

认证与邮件配置见 [邮箱服务与验证](./docs/self-hosting/auth/email.md)。

### 联网搜索与文件处理

- 搜索聚合：SearXNG、Search1API、Google、Brave 等
- 网页抓取：naive、Firecrawl、Tavily、Jina、Browserless 等
- 文档解析：PDF、DOCX、PPTX、Excel 等

详细配置见 [联网搜索与爬虫](./docs/self-hosting/features/online-search.md)。

### 模块化 Monorepo

项目使用 pnpm workspace，将共享能力拆分为 `@pure/*` 包，便于复用、测试和独立演进。核心包包括环境变量、数据库、模型目录、文件加载、网页爬虫、SSRF 安全请求和聊天渠道适配器。

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) 10（版本见 `package.json`）
- [Bun](https://bun.sh/)（开发脚本和部分迁移脚本使用）
- PostgreSQL；也可以使用项目提供的 Docker 依赖

### 1. 安装并配置

```bash
git clone https://github.com/Hyk260/PureChatNext.git
cd PureChatNext

pnpm install
cp .env.example .env.local
```

编辑 `.env.local`，至少准备：

```env
# 本地必须指向 SPA 端口
APP_URL=http://localhost:5174
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174

# 数据库（云数据库也可以）
DATABASE_DRIVER=neon
DATABASE_URL=postgresql://user:password@host:5432/database

# 生成方式见 .env.example
KEY_VAULTS_SECRET=your-random-secret
AUTH_SECRET=your-random-secret
JWKS_KEY='{"keys":[...]}'

# 至少配置一个可用的模型 Provider
OPENAI_API_KEY=your-api-key
```

密钥生成和完整变量说明见 [.env.example](./.env.example) 与 [环境变量配置](./docs/self-hosting/configuration/environment.md)。

### 2. 执行数据库迁移

```bash
pnpm db:migrate
```

### 3. 启动开发环境

```bash
# 推荐：并发启动 Next API / BFF（3000）与 Vite SPA（5174）
pnpm dev
```

打开 <http://localhost:5174>。`3000` 端口只提供 API / BFF，不是开发时的主 UI 入口。

如果需要使用 Alt+Shift 点击页面元素跳转源码：

```bash
pnpm dev:inspect
```

也可以分开启动：

```bash
pnpm dev:next  # Next API / BFF → http://localhost:3000
pnpm dev:spa   # Vite SPA → http://localhost:5174
```

### 使用 Docker 启动本地依赖

安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 后，可以一次启动 PostgreSQL、Redis、RustFS 和 SearXNG：

```bash
pnpm docker:setup:dev
pnpm dev:docker
pnpm db:migrate
pnpm dev
```

本地 Docker 连接信息会写入 `docker-compose/dev/.env`，并可按需同步到 `.env.local`。日常停止和重置：

```bash
pnpm dev:docker:down   # 停止，保留数据卷
pnpm dev:docker:reset  # 确认后删除开发数据并重建
```

## 部署

### Vercel

点击下方按钮克隆并创建 Vercel 项目，然后按环境变量文档补齐数据库、认证与模型配置：

[![Deploy with Vercel](https://vercel.com/button)][vercel-deploy-link]

项目按单个 Next.js 项目部署，仓库已包含 `vercel.json`。配置以下内容后即可上线：

1. 安装命令：`pnpm install`
2. 构建命令：`pnpm build`
3. 配置生产环境变量，至少包含数据库、认证密钥、`APP_URL` 和模型 Provider 密钥
4. 将 `ALLOWED_ORIGINS` 设置为正式前端域名，不要在生产环境使用 `*`
5. 在部署前或 CI 中执行 `pnpm db:migrate`

构建流程为 `build:spa` → 复制 SPA 产物 → `next build`。部署后的静态资源位于 `/_spa/**`，未匹配的 UI 路径会回退到 SPA HTML 壳。

### Docker 自托管

```bash
pnpm docker:setup:deploy

# 修改 docker-compose/deploy/.env 后，一条命令构建并启动
pnpm docker:deploy
```

首次生成配置后，请修改正式域名、`ALLOWED_ORIGINS` 和模型密钥。生产 Compose 会在应用启动前自动执行数据库迁移，健康检查地址为 `/api/health`。

完整说明见 [Docker 自托管](./docs/self-hosting/platform/docker.md)。

## 环境变量

环境变量由 `packages/env` 统一校验。常用配置如下：

| 变量 | 用途 | 说明 |
| --- | --- | --- |
| `APP_URL` | 应用对外地址 | 本地使用 `http://localhost:5174`，生产使用正式域名 |
| `ALLOWED_ORIGINS` | CORS 允许来源 | 本地通常包含 `http://localhost:3000,http://localhost:5174` |
| `DATABASE_DRIVER` | 数据库连接模式 | 云数据库使用 `neon`；本地 / Docker PostgreSQL 使用 `node` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | Supabase、Neon 或本地 PostgreSQL 均可 |
| `KEY_VAULTS_SECRET` | 敏感配置加密密钥 | 使用随机高强度密钥 |
| `AUTH_SECRET` / `JWKS_KEY` | 认证与 JWT 密钥 | 生成方式见 `.env.example` |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` | 模型 Provider 密钥 | 至少配置一个可用 Provider |
| `SEARCH_PROVIDERS` / `CRAWLER_IMPLS` | 搜索与爬虫链 | 不需要联网搜索时可以不配置 |
| `REDIS_URL` | 缓存与队列 | 使用 Docker 或托管 Redis 时配置 |
| `S3_*` | 文件对象存储 | 使用 RustFS、MinIO、S3 等兼容服务时配置 |

完整变量列表、认证、邮件、对象存储和联网搜索配置请查看 [环境变量详解](./docs/self-hosting/configuration/environment.md)。

## 项目结构

```text
PureChatNext/
├── apps/
│   ├── desktop/               # Electron 桌面应用
│   └── docs/                  # 独立 Next.js + Fumadocs 文档站
├── packages/                  # @pure/* 工作区包
│   ├── database/              # Drizzle Schema、Model 与迁移
│   ├── env/                   # 环境变量校验
│   ├── model-bank/            # 模型目录与定价
│   ├── file-loaders/          # PDF、DOCX、PPTX、Excel 等文档加载
│   ├── web-crawler/           # 网页爬虫实现
│   └── chat-adapter/          # QQ / 微信渠道适配器
├── src/
│   ├── spa/                   # Vite SPA 入口与 Router
│   ├── features/              # 业务 UI
│   ├── app/api/               # Next API 路由
│   ├── server/                # 服务端业务与搜索聚合
│   ├── libs/                  # 认证、中间件与工具
│   └── components/            # 通用 React 组件
├── docs/                      # 文档站与 GitHub 共用的公开 Markdown 内容源
└── scripts/                   # 开发、构建、迁移与 Docker 脚本
```

## 常用命令

```bash
# 开发
pnpm dev
pnpm dev:inspect
pnpm dev:next
pnpm dev:spa
pnpm dev:docs

# 构建与运行
pnpm build
pnpm build:docs
pnpm start

# 数据库
pnpm db:check
pnpm db:generate
pnpm db:migrate
pnpm db:studio

# 质量检查与测试
pnpm lint
pnpm exec vitest run --silent='passed-only'

# Docker
pnpm docker:validate
pnpm docker:deploy
pnpm dev:docker
pnpm dev:docker:down
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [公开文档站][docs-site-link] | 可搜索的正式文档、目录和页面导航 |
| [文档索引](./docs/README.md) | 全部公开文档与维护规范 |
| [快速开始](./docs/getting-started/quick-start.md) | 云数据库与本地开发配置 |
| [开发指南](./docs/development/README.md) | 数据库、质量检查与样式约定 |
| [自托管指南](./docs/self-hosting/README.md) | 部署、基础设施、功能与消息渠道 |
| [开发约定](./AGENTS.md) | AI Agent 与项目开发指南 |

## 参与贡献

欢迎提交 [Issue][github-issues-link]、参与 [Discussion][github-discussions-link] 或发起 Pull Request。开始前请阅读 [贡献指南](./CONTRIBUTING.md) 与 [安全政策](./SECURITY.md)。提交前请运行：

```bash
pnpm lint
pnpm exec vitest run --silent='passed-only'
```

如果修改了环境变量，请同步更新 `packages/env` 和 `.env.example`，并补充对应文档。

## License

本项目基于 [MIT License](./LICENSE) 开源。

Copyright © 2025–2026 [Hyk260][profile-link].

[github-discussions-link]: https://github.com/Hyk260/PureChatNext/discussions
[github-discussions-shield]: https://img.shields.io/github/discussions/Hyk260/PureChatNext?color=c084fc&labelColor=black&style=flat-square
[github-issues-link]: https://github.com/Hyk260/PureChatNext/issues
[github-issues-shield]: https://img.shields.io/github/issues/Hyk260/PureChatNext?color=ff80eb&labelColor=black&style=flat-square
[github-license-link]: https://github.com/Hyk260/PureChatNext/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square
[github-release-link]: https://github.com/Hyk260/PureChatNext/releases
[github-release-shield]: https://img.shields.io/github/v/release/Hyk260/PureChatNext?color=369eff&labelColor=black&logo=github&style=flat-square
[github-stars-link]: https://github.com/Hyk260/PureChatNext/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/Hyk260/PureChatNext?color=ffcb47&labelColor=black&style=flat-square
[online-demo-link]: https://next.purechat.cn
[docs-site-link]: https://docs.purechat.cn
[profile-link]: https://github.com/Hyk260
[repo-link]: https://github.com/Hyk260/PureChatNext
[vercel-deploy-link]: https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHyk260%2FPureChatNext
