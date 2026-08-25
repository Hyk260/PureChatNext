# 快速开始指南

## 1. 安装依赖

```bash
pnpm install
```

## 2. 配置 Supabase

### 2.1 创建 Supabase 项目

1. 访问 <https://supabase.com>
2. 注册/登录账号
3. 创建新项目
4. 等待项目创建完成（通常需要 1-2 分钟）

### 2.2 获取配置信息

1. 进入项目后，点击左侧菜单的 **Settings**（设置）
2. 点击 **API** 选项卡
3. 复制以下信息：
   - **Project URL** → 用作 `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → 用作 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 2.3 配置认证

1. 点击左侧菜单的 **Authentication**（认证）
2. 确保 **Email** 认证方式已启用（默认已启用）
3. 可以根据需要调整其他设置（如密码强度要求等）

## 3. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
APP_URL=http://localhost:5174
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5174
NODE_ENV=development
```

⚠️ **注意**：将上面的 URL 和 KEY 替换为你从 Supabase 获取的实际值。

本地 **`APP_URL` 统一为 `http://localhost:5174`**（不要写成 `:3000`）。邮件验证、重置密码、OAuth 回调会落在 SPA；`/api` 由 Vite 代理到 Next。详见 [环境变量 · APP\_URL](../self-hosting/configuration/environment.md#app_url)。

### 3.1 可选：本地依赖（Docker）

不使用云托管服务时，可用 Docker Compose 一次启动 PostgreSQL、Redis、RustFS（S3）和 SearXNG（需已安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)）：

```bash
# 一次性：创建 compose 侧环境变量（已有文件不会覆盖）
pnpm docker:setup:dev

# 启动全部本地依赖并等待健康检查
pnpm dev:docker
pnpm db:migrate
```

在 `.env.local` 中对齐连接信息（与 `docker-compose/dev/.env` 一致）：

```env
DATABASE_DRIVER=node
DATABASE_URL=postgresql://purechat:<URL 编码后的 POSTGRES_PASSWORD>@127.0.0.1:5432/purechat

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

常用命令：

```bash
pnpm dev:docker        # 启动
pnpm dev:docker:down   # 停止（保留数据卷）
pnpm dev:docker:reset  # 清空卷后重建并执行 db:migrate
```

`dev:docker:reset` 会要求输入确认并永久删除全部开发卷。旧本机数据迁移和生产部署见 [Docker 自托管与数据迁移](../self-hosting/platform/docker.md)；服务说明见 [本地 PostgreSQL](../self-hosting/infrastructure/postgresql.md)、[本地 Redis](../self-hosting/infrastructure/redis.md)、[联网搜索](../self-hosting/features/online-search.md)。

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

### Q: 提示 "Missing Supabase environment variables"

**A**: 确保已创建 `.env.local` 文件，并且环境变量名称正确。

### Q: CORS 错误

**A**: 检查 `.env.local` 中的 `ALLOWED_ORIGINS` 是否包含你的前端地址。

### Q: Token 过期

**A**: Token 会自动刷新，如果仍然失败，需要重新登录。

## 下一步

- 查看 [文档索引](../README.md) 了解全部公开文档
- 查看 [环境变量](../self-hosting/configuration/environment.md) 了解详细配置
- 开始开发你的应用功能！
