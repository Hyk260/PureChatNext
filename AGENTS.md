# PureChatNext 开发指南

面向 AI coding agent 的本仓库开发约定。

## 技术栈

- **SPA + Next BFF**：业务 UI 走 Vite + react-router；Next.js 16 只保留 API / auth / 生产 SPA HTML 壳（同域部署）
- React 19 + TypeScript；UI：Tailwind CSS 4 + `@lobehub/ui` / antd（按需）
- better-auth + Drizzle ORM + PostgreSQL（Supabase）
- Vercel AI SDK（`@ai-sdk/*`、`ai`），聊天入口见 `src/app/api/chat/route.ts`
- 环境变量：`@t3-oss/env-core`，集中在 `packages/env/src/`，通过 `@/envs/*` 别名引用
- Monorepo：pnpm workspace，内部包 `@pure/*`
- 测试：Vitest（根目录 + 各 package 独立配置）
- 日志：`debug` 包，命名空间约定见 `.cursor/rules/debug-usage.md`

脚本运行可用本机 `bun`（`dev` / `build` 链路）；包管理仍仅用 `pnpm`。

## 项目结构

```plaintext
PureChatNext/
├── packages/                  # @pure/* 工作区包
│   ├── database/              # Drizzle schema、models、migrations（@pure/database）
│   ├── env/                   # 环境变量校验（auth、tools、serverDB 等）
│   ├── types/                 # 共享类型（search、crawler、files 等）
│   ├── model-bank/            # 模型目录与定价（purehub / openai / deepseek）
│   ├── utils/                 # 共享工具（apiKey、jina 等）
│   ├── file-loaders/          # 文档加载（pdf、docx、pptx、excel…）
│   ├── web-crawler/           # 网页爬虫多实现（naive、firecrawl、tavily…）
│   ├── ssrf-safe-fetch/       # SSRF 安全 fetch 封装
│   ├── ui/                    # UI 原语（暂桥接 @lobehub/ui，逐步自研替换）
│   ├── chat-adapter-wechat/   # 微信 iLink + Vercel Chat SDK Adapter
│   └── chat-adapter-qq/       # QQ 开放平台 + Vercel Chat SDK Adapter
├── src/
│   ├── spa/                   # Vite SPA 入口与 Router（迁移中）
│   ├── features/              # 业务 UI（供 SPA 路由挂载）
│   ├── app/                   # Next：API / auth / 生产 SPA 壳；历史 page 逐步退役
│   │   └── api/               # REST API（auth、chat、rest-api、read-file…）
│   ├── server/                # 服务端业务（search 搜索聚合等）
│   ├── libs/                  # better-auth、工具、中间件
│   ├── components/            # 通用 React 组件
│   └── styles/                # 全局样式
├── docs/                      # 人类可读文档（快速开始、环境、Drizzle、联网搜索）
├── scripts/                   # 项目脚本（文件名统一使用 kebab-case）
│   ├── copy-spa-build.mjs     # SPA 构建产物复制脚本
│   └── shell/                 # Shell 脚本（kebab-case）
└── tests/                     # Vitest setup
```

## 领域约定

### Monorepo 包

- 新增共享逻辑优先放入 `packages/`，命名 `@pure/<name>`
- 根 `package.json` 通过 `workspace:*` 引用；修改 package 后无需单独 publish
- 各 package 自带 `vitest.config.ts`，测试在 package 目录内运行

### 环境变量

- 定义在 `packages/env/src/`（如 `auth.ts`、`tools.ts`、`serverDB.ts`）
- 业务代码通过 `import { toolsEnv } from '@/envs/tools'` 访问，**不要**直接散落 `process.env`
- 新增 env 字段：在对应 env 模块加 zod schema + runtimeEnv 映射
- 详细说明见 `docs/env-setup.zh-CN.md`；联网搜索/爬虫见 `docs/self-hosting/online-search.zh-CN.md`

### 搜索与爬虫

- 搜索聚合：`src/server/search/`，`SearchService` 按 `SEARCH_PROVIDERS` 环境变量链式调用多 provider
- 新增 search provider：在 `src/server/search/impls/<name>/` 实现并注册到 `impls/index.ts`
- 网页爬取：`packages/web-crawler/`，`CRAWLER_IMPLS` 控制实现优先级
- 对外暴露：`/api/rest-api` 等路由（见 `src/app/api/rest-api/route.ts`）

### 数据库（Drizzle）

- Schema：`packages/database/src/schemas/`（`@pure/database/schemas`）
- Model 层：`packages/database/src/models/`（`@pure/database/models/*`）
- 常用命令：

```bash
pnpm db:check      # 校验配置
pnpm db:generate   # 生成迁移
pnpm db:migrate    # 执行迁移
pnpm db:studio     # Drizzle Studio
```

- 完整流程见 `docs/drizzle-setup.zh-CN.md`

### API 路由

- 认证相关：`src/app/api/auth/`（register、login、logout、github OAuth）
- 鉴权中间件：`src/libs/auth/middleware.ts`（JWT `verifyAuth`）
- 请求边界：`src/proxy.ts`（Next.js 16 Proxy；CORS + `/api/rest-api` JWT；勿改回 `middleware.ts`）
- CORS：`src/libs/utils/cors.ts`，需配置 `ALLOWED_ORIGINS`（本地含 Vite `5174`）
- 错误处理：复用 `src/libs/errors.ts` 中的 `ChatSDKError` 等

## 开发

### 启动开发环境

```bash
pnpm install          # 安装依赖（包管理仍用 pnpm）
pnpm dev / bun run dev  # 启动脚本并发 Next + Vite SPA（需本机 bun）
pnpm dev:inspect      # 同上，并启用 code-inspector（Alt+Shift 点击跳转源码）
pnpm dev:next         # 仅 Next API / BFF（http://localhost:3000）
pnpm dev:spa          # 仅 Vite SPA（http://localhost:5174，代理 /api → Next）
pnpm build            # build:spa → copy → build:next（Vercel 同此；见 vercel.json）
pnpm start            # 生产启动（端口 3210）
pnpm gateway          # 运行 gateway 脚本
pnpm lint             # ESLint
```

- 本地开发：浏览器访问 **SPA 端口** `http://localhost:5174`（不要依赖线上 Debug Proxy）；Next 在 `3000`
- 本地 **`APP_URL=http://localhost:5174`**（邮件/OAuth 与 SPA 同源，`/api` 经 Vite 代理）；生产用正式域名。详见 `docs/env-setup.zh-CN.md` 的 APP\_URL 一节
- 生产同域：Vite 产物在 `public/_spa/**`（`next.config` 长缓存）；HTML 由 `src/app/spa/[[...path]]/route.ts` 注入 `__SERVER_CONFIG__`；未匹配 UI 路径经 `rewrites.fallback` → `/spa`
- Vercel：单项目；`installCommand` / `buildCommand` 见根目录 `vercel.json`；环境变量不变
- 回滚：`main` 仍为改造前纯 Next App Router，直到 SPA 分支稳定
- 环境变量：复制 `.env.example` 为 `.env.local`，参考 `docs/quick-start.zh-CN.md`
- SPA 改造进度：`docs/spa-migration-checklist.md`
- **不要**提交 `.env`、`.env.local` 等含密钥文件；本地 `build:spa:copy` 会改写 `spaHtmlTemplate.generated.ts`，勿提交构建后的 HTML

### Git 工作流

- 主分支：`main`
- 提交信息风格：中文描述 + conventional 前缀（如 `feat:`、`refactor:`、`chore:`）
- PR 目标分支：`main`

### 包管理

- **仅使用 `pnpm`**（`packageManager: pnpm@10.33.4`）
- 根目录与各 package 各自维护 `package.json`

### 测试

```bash
# 根目录（src/server 等，排除 packages/**）
pnpm exec vitest run --silent='passed-only' 'src/server/search/index.test.ts'

# 单个 workspace package
cd packages/web-crawler && pnpm test
cd packages/file-loaders && pnpm exec vitest run --silent='passed-only' 'src/loadFile.test.ts'
```

- 根 `vitest.config.ts` 的 `exclude` 含 `**/packages/**`，package 测试需在对应目录执行
- 优先 `vi.spyOn` 而非大范围 `vi.mock`

### 代码风格

- ESLint：`eslint.config.js`，强制顶层 type import：`import type { Foo }` + `import { Bar } from 'pkg'`（`@typescript-eslint/consistent-type-imports` + `import/consistent-type-specifier-style: prefer-top-level` + `import/no-duplicates`）
- 单文件超过 ~800 行时考虑拆分
- Debug 日志遵循 `.cursor/rules/debug-usage.md` 命名空间（如 `auth:*`、`db:*`）
- 修改范围：只做任务相关的最小 diff，不重构无关代码

## 延伸阅读

| 文档                                        | 用途                    |
| ------------------------------------------- | ----------------------- |
| `docs/quick-start.zh-CN.md`                 | 快速开始、Supabase 配置 |
| `docs/env-setup.zh-CN.md`                   | 环境变量详解            |
| `docs/drizzle-setup.zh-CN.md`               | 数据库迁移              |
| `docs/self-hosting/online-search.zh-CN.md`  | 联网搜索与爬虫配置      |
| `docs/self-hosting/wechat-channel.zh-CN.md` | 微信 iLink 扫码渠道     |
| `docs/self-hosting/qq-channel.zh-CN.md`     | QQ 开放平台机器人渠道   |
| `.cursor/rules/debug-usage.md`              | debug 日志规范          |
