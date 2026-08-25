# PureChatNext Agent 开发规则

本文件规定 AI coding agent 在本仓库中的实现边界、架构约束与验证要求。

## 适用范围与优先级

- 本文件适用于整个仓库；若子目录存在更具体的 `AGENTS.md`，以子目录规则为准。
- 只做当前任务相关的最小修改，不顺带重构、格式化或清理无关代码。
- 先阅读任务涉及的源码、测试和专项文档，再实施修改；不要仅凭目录名或既有知识推断行为。
- 文件末尾的 Next.js agent rules 由 Next.js 自动维护，必须原样保留。

## 必须遵守

- 包管理和依赖变更只使用 `pnpm`；允许使用 `bun run <script>` 执行已有脚本，但不得用 bun 安装依赖或修改 lockfile。
- 不提交 `.env`、`.env.local` 等密钥文件。
- 本地 `build:spa:copy` 会改写 `spaHtmlTemplate.generated.ts`，不要提交构建生成的 HTML。
- 新增环境变量必须集中定义在 `packages/env/src/`，包含 zod schema 与 `runtimeEnv` 映射；业务代码不要散落读取 `process.env`。
- 修改 Next.js 代码前，先阅读 `node_modules/next/dist/docs/` 中与任务相关的当前版本文档，并遵循其中的弃用提示。
- 提交或交付前执行与修改范围相称的测试和静态检查；不得用无关改动掩盖检查失败。
- 主分支和 PR 目标分支均为 `main`；提交信息使用 conventional 前缀加中文描述，例如 `feat: 增加模型筛选`。

## 架构不变量

- 业务 UI 使用 Vite SPA、React 19 和 react-router，主要位于 `src/spa/` 与 `src/features/`；样式与组件按需使用 Tailwind CSS 4、`@lobehub/ui` 和 antd。
- 主应用的 Next.js 16 只负责 API、认证和生产 SPA HTML 壳；不要把新业务页面迁回 Next.js 页面路由。`apps/docs/` 是独立部署的公开文档站，不属于主应用页面路由。
- 本地开发访问 `http://localhost:5174`；Vite 将 `/api` 代理到 `http://localhost:3000` 的 Next BFF。
- 本地 `APP_URL` 使用 `http://localhost:5174`；生产环境使用正式同域地址。
- 请求边界使用 `src/proxy.ts` 处理 CORS 和 `/api/rest-api` JWT，不要改回 `middleware.ts`。
- 生产 SPA 产物位于 `public/_spa/**`，HTML 由 `src/app/spa/[[...path]]/route.ts` 注入 `__SERVER_CONFIG__`。
- Monorepo 共享逻辑优先放入 `packages/`，内部包命名为 `@pure/<name>`，依赖使用 `workspace:*`。
- 聊天能力使用 Vercel AI SDK，服务端入口位于 `src/app/api/chat/route.ts`。

## 任务定位

| 任务 | 主要位置 | 说明 |
| --- | --- | --- |
| SPA 路由与入口 | `src/spa/` | Vite SPA、Router、认证入口 |
| 业务 UI | `src/features/` | 页面级功能与业务组件 |
| 通用组件与样式 | `src/components/`、`src/styles/` | 跨业务复用的 UI 与全局样式 |
| API 与认证 | `src/app/api/`、`src/libs/auth/` | Next BFF、better-auth、JWT |
| 服务端业务 | `src/server/` | 搜索、聊天与服务端模块 |
| 数据库 | `packages/database/` | Drizzle schema、models、migrations |
| 环境变量 | `packages/env/src/` | 按领域维护校验与导出 |
| 搜索与爬虫 | `src/server/search/`、`packages/web-crawler/` | 搜索 provider 与网页抓取实现 |
| 共享类型与工具 | `packages/types/`、`packages/utils/` | 跨 workspace 复用逻辑 |
| 文件解析 | `packages/file-loaders/` | PDF、Office、文本等加载器 |
| 公开文档站 | `apps/docs/`、`docs/` | 独立 Fumadocs 应用与共享 Markdown 内容源 |

## 领域约定

### 环境变量

- 业务代码通过 `@/envs/*` 对应入口访问环境变量。
- 新字段加入对应 env 模块，不要在业务模块重复声明校验规则。
- 配置方式见 `docs/self-hosting/configuration/environment.md`。

### 搜索与爬虫

- `SearchService` 按 `SEARCH_PROVIDERS` 配置依次调用 provider。
- 新增 provider 时，在 `src/server/search/impls/<name>/` 实现，并注册到 `impls/index.ts`。
- 网页抓取由 `packages/web-crawler/` 提供，`CRAWLER_IMPLS` 控制实现优先级。
- 配置和扩展方式见 `docs/self-hosting/features/online-search.md`。

### 数据库

- Schema 位于 `packages/database/src/schemas/`，model 位于 `packages/database/src/models/`。
- 数据库修改按需运行 `pnpm db:check`、`pnpm db:generate` 和 `pnpm db:migrate`。
- 完整迁移流程见 `docs/development/database/drizzle.md`。

### API

- 认证路由位于 `src/app/api/auth/`，鉴权逻辑复用 `src/libs/auth/middleware.ts`。
- CORS 逻辑复用 `src/libs/utils/cors.ts`，本地来源需要包含 Vite 的 `5174` 端口。
- API 错误优先复用 `src/libs/errors.ts` 中的 `ChatSDKError` 等现有类型。

## 测试与验证

### 测试文件组织

- 测试默认与被测源码就近放置。
- 若同一源码目录直属的 `*.test.ts` 与 `*.test.tsx` 文件达到 4 个，应在该目录创建 `__tests__/`，并将该目录下所有直属测试文件统一移入其中；统计时不递归包含子目录。
- 移动测试时同步检查相对 import、mock、fixture 和 snapshot 路径。
- package 级集成测试可继续放在 package 根目录的 `test/` 或 `tests/` 中。
- 不为满足本规则单独批量迁移无关旧目录；修改相关源码或测试时再渐进整理。

### 运行测试

```bash
# 根项目测试；根配置排除 packages/**
pnpm exec vitest run --silent='passed-only' '<test-file>'

# workspace package 测试；按对应 package.json 在 package 目录执行
pnpm test
pnpm exec vitest run --silent='passed-only' '<test-file>'
```

- 根 `vitest.config.ts` 不执行 `packages/**` 测试；package 测试应在对应目录按其 `package.json` 脚本和 Vitest 配置（如有）运行。
- 优先使用 `vi.spyOn`，避免无必要的大范围 `vi.mock`。
- 修改行为时优先运行直接相关测试，再根据影响范围扩大验证。
- 交付前运行 `pnpm lint`；该命令只检查，不自动格式化。检查说明见 `docs/development/quality/lint.md`。

## 代码风格

- 遵循 `eslint.config.mjs`；类型导入使用顶层 `import type`，不要把同一来源拆成重复 import。
- 新组件和简单静态样式默认使用 Tailwind CSS；复杂选择器、动画、SVG、滚动条或动态几何值可保留 `createStaticStyles`。
- 仅将跨页面高频且语义稳定的样式组合加入 `src/styles/utilities.css`；新增前先搜索仓库验证复用需求。
- Tailwind 细则见 `docs/development/styling/tailwind-guidelines.md` 与 `docs/development/styling/tailwind-migration.md`。
- 单文件接近或超过 800 行时评估拆分，但不要为控制行数进行无关重构。
- Debug 日志遵循 `.cursor/rules/debug-usage.md`，使用 `auth:*`、`db:*` 等领域命名空间。

## 常用命令

```bash
pnpm dev          # 同时启动 Next BFF 与 Vite SPA
pnpm dev:inspect  # 启用 code-inspector 的开发模式
pnpm dev:next     # 仅启动 Next，端口 3000
pnpm dev:spa      # 仅启动 Vite SPA，端口 5174
pnpm dev:docs     # 仅启动公开文档站，端口 3010
pnpm build        # 构建 SPA、复制产物并构建 Next
pnpm build:docs   # 构建独立文档站
pnpm lint         # lint、类型与仓库质量检查
```

首次配置参考 `docs/getting-started/quick-start.md`；微信和 QQ 渠道分别参考 `docs/self-hosting/channels/wechat/setup.md` 与 `docs/self-hosting/channels/qq/setup.md`。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
