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

### APP_URL

应用对外根地址，用作 better-auth `baseURL`、认证邮件链接、OAuth `redirectURI` 等。

| 环境 | 推荐值 | 说明 |
|------|--------|------|
| 本地开发 | `http://localhost:5174` | UI 在 Vite SPA；邮件/OAuth 链接同源，`/api` 经 Vite 代理到 Next `:3000` |
| 生产 | 正式域名（如 `https://next.purechat.cn`） | 前后端同域，见 `.env.production` |

**不要**在本地把 `APP_URL` 设为 `http://localhost:3000`：邮件点开后会落在 Next 壳而不是 SPA，重置密码 / 验证邮箱体验会错乱。

端口对照：

| 端口 | 角色 | 何时使用 |
|------|------|----------|
| `5174` | Vite SPA（本地 UI） | 浏览器打开站点、`APP_URL`、邮件落地 |
| `3000` | Next API / BFF | `/api/*`、curl 直打接口；不当主站入口 |

修改后需重启 Next（`pnpm dev:next` 或 `pnpm dev`）。

### CODE_INSPECTOR

本地开发可选。设为 `1` 时，在 Vite SPA（与 Next Turbopack）启用 [code-inspector](https://github.com/zh-lx/code-inspector)：按住 **Alt+Shift** 点击页面元素，在 Cursor 中打开对应源码。

- 默认关闭（降低编译与内存开销）
- 临时开启推荐：`pnpm dev:inspect`（等价于 `CODE_INSPECTOR=1 pnpm dev`，完整 Next + SPA）
- 也可写入 `.env.local`：`CODE_INSPECTOR=1` 后重启开发进程

### NEXT_PUBLIC_SUPABASE_URL
Supabase 项目的 URL，格式通常是：`https://xxxxx.supabase.co`

### NEXT_PUBLIC_SUPABASE_ANON_KEY
Supabase 的匿名/公开密钥，用于客户端访问。

### ALLOWED_ORIGINS
允许跨域请求的源地址。在生产环境中，应该设置为你的实际域名。

示例：
- 开发环境：`http://localhost:3000,http://localhost:5174`（需同时包含 Next 与 SPA）
- 生产环境：`https://yourdomain.com,https://www.yourdomain.com`

### DATABASE_URL
Supabase PostgreSQL 数据库连接字符串，用于 Drizzle ORM 迁移和数据库操作。
- 格式：`postgresql://postgres:[密码]@db.[项目引用].supabase.co:5432/postgres`
- 可以从 Supabase 项目设置的 Database → Connection string 中获取
- 支持直接连接（端口 5432）或连接池模式（端口 6543，推荐用于生产环境）

### NODE_ENV
运行环境，通常为 `development` 或 `production`。

### 微信 iLink 渠道

见 [docs/self-hosting/wechat-channel.zh-CN.md](./self-hosting/wechat-channel.zh-CN.md)。协议层在 `@pure/chat-adapter-wechat`（Vercel Chat SDK）。关键变量：`KEY_VAULTS_SECRET`（凭证加密）、`REDIS_URL`、`CRON_SECRET` / `WECHAT_WEBHOOK_SECRET`、`APP_URL`、以及服务端 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`。本地轮询：`pnpm wechat:gateway`。

### QQ 开放平台渠道

见 [docs/self-hosting/qq-channel.zh-CN.md](./self-hosting/qq-channel.zh-CN.md)。协议层在 `@pure/chat-adapter-qq`。凭证按绑定加密存储（`KEY_VAULTS_SECRET`）；内部 WS 转发可用 `QQ_WEBHOOK_SECRET` / `CRON_SECRET`。WebSocket：`pnpm qq:gateway`；Webhook：公网回调 + Ed25519 验证。

## 安全提示

⚠️ **重要**：
- `.env.local` 文件已添加到 `.gitignore`，不会被提交到 Git
- 不要在生产环境中使用 `NEXT_PUBLIC_*` 前缀暴露敏感信息
- `ALLOWED_ORIGINS` 不要在生产环境中使用 `*`
- `DATABASE_URL` 包含敏感数据库密码，切勿提交到版本控制系统

