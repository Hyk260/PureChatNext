# 环境变量配置指南

## 创建环境变量文件

在项目根目录创建 `.env.local` 文件，并添加以下配置：

```env
# Supabase 配置
# 从 Supabase 项目设置中获取这些值
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# 数据库连接（用于 Drizzle ORM）
# Supabase 数据库连接字符串格式：
# postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
# 或者使用连接池（推荐）：
# postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# 本地 Docker PostgreSQL（pnpm dev:docker）改用：
# DATABASE_DRIVER=node
# DATABASE_URL=postgresql://purechat:purechat@127.0.0.1:5432/purechat
# 密码需与 docker-compose/dev/.env 中 POSTGRES_PASSWORD 一致

# 应用对外地址（本地统一 SPA 端口）
APP_URL=http://localhost:5174

# CORS 配置
# 允许的源（多个用逗号分隔，* 表示允许所有源）
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174

# Node 环境
NODE_ENV=development
```

## 获取 Supabase 配置

1. 登录 [Supabase](https://supabase.com)
2. 创建新项目或选择现有项目
3. 进入项目设置（Settings）
4. 点击 API 选项卡
5. 复制以下信息：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. 点击 **Database** 选项卡
7. 在 **Connection string** 部分选择 **URI** 或 **Transaction mode** (连接池模式)
8. 复制连接字符串并替换密码占位符 → `DATABASE_URL`
   - 格式示例：`postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
   - 或者使用连接池：`postgresql://postgres.xxxxx:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres`

## 配置说明

### APP\_URL

应用对外根地址，用作 better-auth `baseURL`、认证邮件链接、OAuth `redirectURI` 等。

| 环境     | 推荐值                                    | 说明                                                                    |
| -------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| 本地开发 | `http://localhost:5174`                   | UI 在 Vite SPA；邮件/OAuth 链接同源，`/api` 经 Vite 代理到 Next `:3000` |
| 生产     | 正式域名（如 `https://next.purechat.cn`） | 前后端同域，见 `.env.production`                                        |

**不要**在本地把 `APP_URL` 设为 `http://localhost:3000`：邮件点开后会落在 Next 壳而不是 SPA，重置密码 / 验证邮箱体验会错乱。

端口对照：

| 端口   | 角色                | 何时使用                              |
| ------ | ------------------- | ------------------------------------- |
| `5174` | Vite SPA（本地 UI） | 浏览器打开站点、`APP_URL`、邮件落地   |
| `3000` | Next API / BFF      | `/api/*`、curl 直打接口；不当主站入口 |
| `3210` | Docker 生产应用     | 仅回环监听，由 Nginx/Caddy 反向代理   |

修改后需重启 Next（`pnpm dev:next` 或 `pnpm dev`）。

### CODE\_INSPECTOR

本地开发可选。设为 `1` 时，在 Vite SPA（与 Next Turbopack）启用 [code-inspector](https://github.com/zh-lx/code-inspector)：按住 **Alt+Shift** 点击页面元素，在 Cursor 中打开对应源码。

- 默认关闭（降低编译与内存开销）
- 临时开启推荐：`pnpm dev:inspect`（等价于 `CODE_INSPECTOR=1 pnpm dev`，完整 Next + SPA）
- 也可写入 `.env.local`：`CODE_INSPECTOR=1` 后重启开发进程

### VITE\_DEVTOOLS

本地开发可选。设为 `1` 时，在 Vite SPA 启用 [@vitejs/devtools](https://devtools.vite.dev/guide/)（嵌入式浮动面板；`vite build` 时还会开启 Rolldown `devtools` 并写出分析产物）。

- 默认关闭
- 临时开启：`VITE_DEVTOOLS=1 pnpm dev:spa`（或写入 `.env.local` 后重启）
- 生产构建请勿开启（避免把 DevTools 产物打进 `public/_spa`）

### NEXT\_PUBLIC\_SUPABASE\_URL

Supabase 项目的 URL，格式通常是：`https://xxxxx.supabase.co`

### NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY

Supabase 的匿名/公开密钥，用于客户端访问。

### ALLOWED\_ORIGINS

允许跨域请求的源地址。在生产环境中，应该设置为你的实际域名。

示例：

- 开发环境：`http://localhost:3000,http://localhost:5174`（需同时包含 Next 与 SPA）
- 生产环境：`https://yourdomain.com,https://www.yourdomain.com`

### DATABASE\_URL

PostgreSQL 数据库连接字符串，用于 Drizzle ORM 迁移和数据库操作。

- Supabase：`postgresql://postgres:[密码]@db.[项目引用].supabase.co:5432/postgres`
- 本地 Docker：`postgresql://purechat:purechat@127.0.0.1:5432/purechat`（默认与 `docker-compose/dev/.env.example` 一致）
- 生产 Docker：由 Compose 注入 `postgresql:5432` 内部地址，不应在宿主机 `.env.local` 中改写为该服务名
- Supabase 支持直接连接（5432）或连接池（6543）；本地实例使用 5432

### DATABASE\_DRIVER

控制 `postgres-js` 是否强制启用 SSL：

- 云托管 PostgreSQL（Supabase、Neon 等）：`DATABASE_DRIVER=neon`
- 本机或明确无需 SSL 的 PostgreSQL：`DATABASE_DRIVER=node`

本地 Docker 启停与连接说明见 [本地 PostgreSQL 管理](./self-hosting/postgresql-local.zh-CN.md)。

### Docker 内部服务地址

开发时从宿主机运行应用，因此 PostgreSQL、Redis、RustFS 与 SearXNG 使用 `127.0.0.1` 加映射端口。生产应用与依赖位于同一 Compose 网络，使用 `postgresql:5432`、`redis:6379`、`rustfs:9000` 与 `searxng:8080`；这些端口不会发布到宿主机。

生产密钥与内部 URL 由 `pnpm docker:setup:deploy` 和生产 Compose 管理，不要把 `docker-compose/deploy/.env` 提交到仓库。完整说明见 [Docker 自托管与数据迁移](./self-hosting/docker.zh-CN.md)。

### NODE\_ENV

运行环境，通常为 `development` 或 `production`。

### 微信 iLink 渠道

见 [docs/self-hosting/wechat-channel.zh-CN.md](./self-hosting/wechat-channel.zh-CN.md)。`KEY_VAULTS_SECRET` 为必填，用于加密凭证与 `context_token`；回复还需服务端 `OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`。本地运行 `pnpm wechat:gateway`；Docker 默认启动独立 Gateway；Vercel 默认不支持且不配置 Cron。

### QQ 开放平台渠道

见 [docs/self-hosting/qq-channel.zh-CN.md](./self-hosting/qq-channel.zh-CN.md)。协议层在 `@pure/chat-adapter/qq`。凭证按绑定加密存储（`KEY_VAULTS_SECRET`）；内部 WS 转发可用 `QQ_WEBHOOK_SECRET` / `CRON_SECRET`。WebSocket：`pnpm qq:gateway`；Webhook：公网回调 + Ed25519 验证。

## 安全提示

⚠️ **重要**：

- `.env.local` 文件已添加到 `.gitignore`，不会被提交到 Git
- 不要在生产环境中使用 `NEXT_PUBLIC_*` 前缀暴露敏感信息
- `ALLOWED_ORIGINS` 不要在生产环境中使用 `*`
- `DATABASE_URL` 包含敏感数据库密码，切勿提交到版本控制系统
