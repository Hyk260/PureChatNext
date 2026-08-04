# 本地 Redis 管理

PureChatNext 可使用 Redis 保存 Better Auth 次级存储、微信渠道上下文和其他缓存数据。本地 Redis 通过 Docker Compose 手动启停，不随 `pnpm dev` 自动启动；在 Windows / macOS / Linux 上用法相同。

## 前置条件

- 已安装并启动 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（或兼容的 Docker Engine + Compose V2）
- 若尚未准备 compose 环境变量，先执行：

```bash
pnpm docker:setup:dev
```

## 当前约定

- 镜像：`redis:8.8.1-alpine`（与旧 Homebrew Redis 8.8.1 保持同主版本）
- Compose 文件：`docker-compose/dev/docker-compose.yml`
- 容器名：`purechat-redis`
- 连接地址：`redis://127.0.0.1:6379`
- 持久化：RDB（`--save 60 1000`）+ AOF
- 认证：无密码（仅本地开发，端口只绑定 `127.0.0.1`）
- 数据：Docker named volume `redis_data`
- 内存：默认 `2gb`，淘汰策略 `allkeys-lru`（可在 Compose `.env` 调整）

## 环境变量

在 `.env.local` 中启用应用侧 Redis：

```env
REDIS_URL=redis://127.0.0.1:6379
REDIS_DATABASE=0
REDIS_TLS=0
REDIS_PREFIX=purechat
DISABLE_REDIS=0
```

本地实例不设置用户名、密码或 TLS，不应暴露到局域网或公网。

## 启停和状态检测

```bash
pnpm dev:docker         # 启动 PostgreSQL + Redis + RustFS + SearXNG
pnpm dev:docker:down    # 停止（保留数据卷）
pnpm dev:docker:reset   # 清空卷后重建并 db:migrate
```

单独查看 Redis：

```bash
docker compose -f docker-compose/dev/docker-compose.yml ps redis
docker compose -f docker-compose/dev/docker-compose.yml logs --tail=100 redis
```

## 应用连接检查

```bash
docker compose -f docker-compose/dev/docker-compose.yml exec redis redis-cli PING
# PONG

bun scripts/redis-seed.ts
```

## 常见故障

### 端口被占用

```bash
# macOS / Linux
lsof -nP -iTCP:6379 -sTCP:LISTEN

# Windows PowerShell
Get-NetTCPConnection -LocalPort 6379 -ErrorAction SilentlyContinue
```

### Redis 启动失败

```bash
docker compose -f docker-compose/dev/docker-compose.yml logs --tail=100 redis
```
