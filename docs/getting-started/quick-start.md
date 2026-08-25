---
title: 快速开始指南
description: 安装 PureChatNext、配置本地环境并启动 Vite SPA 与 Next BFF。
---

# 快速开始指南

## 1. 安装依赖

```bash
pnpm install
```

## 2. 配置数据库

应用认证使用 better-auth，只需可用的 PostgreSQL（本地 Docker，或云托管如 [Supabase](https://supabase.com) 免费 Postgres、Neon 等均可）。

### 2.1 推荐：本地 Docker

需已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)：

```bash
# 一次性：创建 compose 侧环境变量（已有文件不会覆盖）
pnpm docker:setup:dev

# 启动全部本地依赖并等待健康检查
pnpm dev:docker
pnpm db:migrate
```

会一并启动 PostgreSQL、Redis、RustFS（S3）和 SearXNG。连接信息见下方环境变量示例，并与 `docker-compose/dev/.env` 保持一致。

### 2.2 可选：云托管 Postgres

也可使用 Supabase 免费 Postgres（或其它云托管实例）：

1. 访问 <https://supabase.com> 创建项目（或使用 Neon 等）
2. 在项目设置 → Database → Connection string 复制 URI
3. 将连接串写入 `.env.local` 的 `DATABASE_URL`（云托管通常设 `DATABASE_DRIVER=neon`）

更细的连接说明见 [环境变量配置](../self-hosting/configuration/environment.md) 与 [Drizzle 指南](../development/database/drizzle.md)。

## 3. 配置环境变量

在项目根目录创建 `.env.local`（也可从 `.env.example` 复制）：

```dotenv
APP_URL=http://localhost:5174
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174
NODE_ENV=development

# 本地 Docker PostgreSQL（与 docker-compose/dev/.env 一致）
DATABASE_DRIVER=node
DATABASE_URL=postgresql://purechat:<URL 编码后的 POSTGRES_PASSWORD>@127.0.0.1:5432/purechat

# 密钥生成方式见 .env.example
KEY_VAULTS_SECRET=your-random-secret
AUTH_SECRET=your-random-secret
JWKS_KEY='{"keys":[...]}'
```

本地 **`APP_URL` 统一为 `http://localhost:5174`**（不要写成 `:3000`）。邮件验证、重置密码、OAuth 回调会落在 SPA；`/api` 由 Vite 代理到 Next。详见 [环境变量 · APP\_URL](../self-hosting/configuration/environment.md#app_url)。

若使用本地 Docker 的 Redis / S3 / 搜索，可一并配置：

```dotenv
REDIS_URL=redis://127.0.0.1:6379
REDIS_PREFIX=purechat
DISABLE_REDIS=0

S3_ACCESS_KEY_ID=<docker-compose/dev/.env 中的 RUSTFS_ACCESS_KEY>
S3_SECRET_ACCESS_KEY=<docker-compose/dev/.env 中的 RUSTFS_SECRET_KEY>
S3_BUCKET=purechat
S3_ENDPOINT=http://localhost:9000
S3_ENABLE_PATH_STYLE=1
S3_SET_ACL=0
# S3_SET_ACL=0：对象私有，经应用鉴权代理访问（RustFS 必用）。详见 docs/self-hosting/configuration/environment.md

SEARCH_PROVIDERS=searxng
SEARXNG_URL=http://localhost:8180
```

常用 Docker 命令：

```bash
pnpm dev:docker        # 启动
pnpm dev:docker:down   # 停止（保留数据卷）
pnpm dev:docker:reset  # 清空卷后重建并执行 db:migrate
```

`dev:docker:reset` 会要求输入确认并永久删除全部开发卷。旧本机数据迁移和生产部署见 [Docker 自托管与数据迁移](../self-hosting/platform/docker.md)；服务说明见 [本地 PostgreSQL](../self-hosting/infrastructure/postgresql.md)、[本地 Redis](../self-hosting/infrastructure/redis.md)、[联网搜索](../self-hosting/features/online-search.md)。

### 3.1 可选：Supabase 客户端变量（仅测试）

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` **非必填**，仅在调试遗留 Supabase 客户端代码时需要，日常开发与认证流程可不配置。

## 4. 启动开发服务器

```bash
# 推荐：并发 Next（API :3000）+ Vite SPA（UI :5174）
pnpm dev

# 需要点击元素跳转源码时（启用 code-inspector，仍是完整 Next + SPA）
pnpm dev:inspect

# 或分终端
pnpm dev:next
pnpm dev:spa
```

浏览器访问 **http://localhost:5174**（SPA）。Next `:3000` 只作 API / BFF，不要当主 UI 入口。

> CORS：`.env.local` 的 `ALLOWED_ORIGINS` 需包含 `http://localhost:5174`（见上文示例）。\
> 修改 `APP_URL` 后需重启 `dev:next`。\
> `dev:inspect` / `CODE_INSPECTOR=1`：Alt+Shift 点击页面元素可在 Cursor 中打开对应源码；默认关闭以降低编译开销。\
> `VITE_DEVTOOLS=1`：启用 Vite DevTools 浮动面板；默认关闭。临时：`VITE_DEVTOOLS=1 pnpm dev:spa`。

## 5. 测试认证功能

1. 打开浏览器访问：`http://localhost:5174/signin`（或首页引导）
2. 尝试注册一个新账号
3. 注册成功后会自动登录
4. 测试获取当前用户信息
5. 测试登出功能

## 6. API 接口测试

你也可以使用 Postman、curl 或其他工具测试 API：

### 注册用户

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 获取当前用户（需要 token）

```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 常见问题

### Q: 登录时提示 "Invalid login credentials"

**A**: 检查邮箱和密码是否正确，或先使用注册接口创建账号。

### Q: 提示缺少 `DATABASE_URL` 或无法连接数据库

**A**: 确认已配置 `.env.local` 中的 `DATABASE_URL`，本地 Docker 需先执行 `pnpm dev:docker`，云托管需检查连接串与 `DATABASE_DRIVER`。

### Q: 提示 "Missing Supabase environment variables"

**A**: 这两个变量仅测试用、非必填。若未主动调用 Supabase 客户端，可忽略；需要时再在 `.env.local` 中配置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。

### Q: CORS 错误

**A**: 检查 `.env.local` 中的 `ALLOWED_ORIGINS` 是否包含你的前端地址。

### Q: Token 过期

**A**: Token 会自动刷新，如果仍然失败，需要重新登录。

## 下一步

- 查看 [文档索引](../README.md) 了解全部公开文档
- 查看 [环境变量](../self-hosting/configuration/environment.md) 了解详细配置
- 开始开发你的应用功能！
