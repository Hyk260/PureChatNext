<div align="center">

# PureChat

轻量、私密、可扩展的 AI 聊天应用。

基于 React、Vite SPA、Next.js BFF 与 Vercel AI SDK 构建，支持多模型对话、联网搜索、文档解析和自托管部署。

[快速开始](#快速开始) · [环境变量](#环境变量) · [文档](#文档) · [反馈问题][github-issues-link]

[![][github-release-shield]][github-release-link]
[![][github-license-shield]][github-license-link]
[![][github-stars-shield]][github-stars-link]
[![][github-issues-shield]][github-issues-link]

</div>

## 项目简介

PureChat（仓库名：PureChatNext）是一个面向自托管场景的 AI 聊天 Web 应用。

- **前端**：Vite + React Router SPA，开发时运行在 `5174` 端口
- **服务端**：Next.js 16 BFF，负责 API、认证和生产环境的 SPA HTML 壳
- **数据层**：PostgreSQL + Drizzle ORM，可使用 Supabase、Neon 或本地 Docker
- **AI 能力**：Vercel AI SDK，支持 OpenAI、DeepSeek、PureChat / AI Gateway 等 Provider

生产环境以单个 Next.js 项目部署，SPA 静态资源与 API 共用同一域名。

## 特性

### 多模型对话

- 流式输出与 Tool Calling
- 通过环境变量切换模型 Provider、API Key 和代理地址
- 支持 OpenAI、DeepSeek 等常用模型服务

### 用户认证

- 邮箱密码注册与登录
- 邮箱验证、魔法链接（需配置邮件服务）
- GitHub、Google、Apple、微信、飞书等 OAuth / SSO
- 个人资料、密码和关联账号管理

认证与邮件配置见 [邮箱服务与验证](./docs/self-hosting/auth/email.zh-CN.md)。

### 联网搜索与文件处理

- 搜索聚合：SearXNG、Search1API、Google、Brave 等
- 网页抓取：naive、Firecrawl、Tavily、Jina、Browserless 等
- 文档解析：PDF、DOCX、PPTX、Excel 等

详细配置见 [联网搜索与爬虫](./docs/self-hosting/online-search.zh-CN.md)。

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

密钥生成和完整变量说明见 [.env.example](./.env.example) 与 [环境变量配置](./docs/env-setup.zh-CN.md)。

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

项目按单个 Next.js 项目部署，仓库已包含 `vercel.json`。配置以下内容后直接部署：

1. 安装命令：`pnpm install`
2. 构建命令：`pnpm build`
3. 配置生产环境变量，至少包含数据库、认证密钥、`APP_URL` 和模型 Provider 密钥
4. 将 `ALLOWED_ORIGINS` 设置为正式前端域名，不要在生产环境使用 `*`
5. 在部署前或 CI 中执行 `pnpm db:migrate`

构建流程为 `build:spa` → 复制 SPA 产物 → `next build`。部署后的静态资源位于 `/_spa/**`，未匹配的 UI 路径会回退到 SPA HTML 壳。

### Docker 自托管

```bash
pnpm docker:setup:deploy

docker compose \
  --env-file docker-compose/deploy/.env \
  -f docker-compose/deploy/docker-compose.yml \
  up -d --build --wait
```

首次生成配置后，请修改正式域名、`ALLOWED_ORIGINS` 和模型密钥。生产 Compose 会在应用启动前自动执行数据库迁移，健康检查地址为 `/api/health`。

完整说明见 [Docker 自托管](./docs/self-hosting/docker.zh-CN.md)。

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

完整变量列表、认证、邮件、对象存储和联网搜索配置请查看 [环境变量详解](./docs/env-setup.zh-CN.md)。

## 项目结构

```text
PureChatNext/
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
├── docs/                      # 开发与自托管文档
└── scripts/                   # 开发、构建、迁移与 Docker 脚本
```

## 常用命令

```bash
# 开发
pnpm dev
pnpm dev:inspect
pnpm dev:next
pnpm dev:spa

# 构建与运行
pnpm build
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
pnpm dev:docker
pnpm dev:docker:down
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [快速开始](./docs/quick-start.zh-CN.md) | 云数据库与本地开发配置 |
| [环境变量](./docs/env-setup.zh-CN.md) | 全量配置说明 |
| [Drizzle 数据库](./docs/drizzle-setup.zh-CN.md) | Schema、迁移与数据库操作 |
| [Docker 自托管](./docs/self-hosting/docker.zh-CN.md) | 本地依赖、生产 Compose 与数据迁移 |
| [联网搜索](./docs/self-hosting/online-search.zh-CN.md) | 搜索 Provider 与网页爬虫 |
| [邮件服务](./docs/self-hosting/auth/email.zh-CN.md) | SMTP、Resend 与邮箱验证 |
| [本地 PostgreSQL](./docs/self-hosting/postgresql-local.zh-CN.md) | 本地数据库管理 |
| [本地 Redis](./docs/self-hosting/redis-local.zh-CN.md) | 本地缓存与队列 |
| [QQ 渠道](./docs/self-hosting/qq-channel.zh-CN.md) / [微信渠道](./docs/self-hosting/wechat-channel.zh-CN.md) | Channel Gateway 配置 |
| [开发约定](./AGENTS.md) | AI Agent 与项目开发指南 |

## 参与贡献

欢迎提交 [Issue][github-issues-link] 或 Pull Request。提交前请运行：

```bash
pnpm lint
pnpm exec vitest run --silent='passed-only'
```

如果修改了环境变量，请同步更新 `packages/env` 和 `.env.example`，并补充对应文档。

## License

本项目基于 [MIT License](./LICENSE) 开源。

Copyright © 2025 [Hyk260][profile-link].

[github-issues-link]: https://github.com/Hyk260/PureChatNext/issues
[github-issues-shield]: https://img.shields.io/github/issues/Hyk260/PureChatNext?color=ff80eb&labelColor=black&style=flat-square
[github-license-link]: https://github.com/Hyk260/PureChatNext/blob/main/LICENSE
[github-license-shield]: https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square
[github-release-link]: https://github.com/Hyk260/PureChatNext/releases
[github-release-shield]: https://img.shields.io/github/v/release/Hyk260/PureChatNext?color=369eff&labelColor=black&logo=github&style=flat-square
[github-stars-link]: https://github.com/Hyk260/PureChatNext/stargazers
[github-stars-shield]: https://img.shields.io/github/stars/Hyk260/PureChatNext?color=ffcb47&labelColor=black&style=flat-square
[profile-link]: https://github.com/Hyk260
