---
title: 本地 PostgreSQL 管理
description: 启动、连接、检查和维护 PureChatNext 使用的本地 PostgreSQL。
---

# 本地 PostgreSQL 管理

PureChatNext 可以直接连接本机 PostgreSQL，不需要为了数据库功能单独部署完整 Supabase。本地实例通过 Docker Compose 与 Redis / RustFS / SearXNG 一并管理，在 Windows / macOS / Linux 上用法相同。

## 前置条件

- 已安装并启动 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（或兼容的 Docker Engine + Compose V2）
- 一次性复制 compose 环境变量：

```bash
pnpm docker:setup:dev
```

## 当前约定

- 镜像：`postgres:17.10-alpine3.24`（固定多架构 digest）
- Compose 文件：`docker-compose/dev/docker-compose.yml`
- 容器名：由 Compose project 自动生成（不要依赖固定容器名）
- 连接地址：`127.0.0.1:5432`
- 数据库 / 用户：默认均为 `purechat`；密码由 `pnpm docker:setup:dev` 随机生成，实际值以 `docker-compose/dev/.env` 为准
- 数据：Docker named volume `postgres_data`

## 环境变量

### Compose 侧（`docker-compose/dev/.env`）

```dotenv
POSTGRES_DB=purechat
POSTGRES_USER=purechat
POSTGRES_PASSWORD=<从 docker-compose/dev/.env 读取>
```

### 应用侧（项目根 `.env.local`）

```dotenv
DATABASE_DRIVER=node
DATABASE_URL=postgresql://purechat:<URL 编码后的 POSTGRES_PASSWORD>@127.0.0.1:5432/purechat
```

`DATABASE_DRIVER=node` 会关闭本地连接的强制 SSL。`DATABASE_URL` 中的用户、库名、密码必须与 compose `.env` 一致。密码包含 `@`、`:`、`/`、`?`、`#` 或 `%` 时必须进行 URL 编码。不要提交 `.env.local` 或 `docker-compose/dev/.env`。

## 启停和日常使用

与 Redis / RustFS / SearXNG 一起启停：

```bash
pnpm dev:docker         # up -d --wait
pnpm db:migrate
pnpm dev:docker:down    # down（保留 named volume）
pnpm dev:docker:reset   # down -v 后重建，并执行 db:migrate
```

查看状态与日志：

```bash
docker compose -f docker-compose/dev/docker-compose.yml ps postgresql
docker compose -f docker-compose/dev/docker-compose.yml logs --tail=100 postgresql
docker compose -f docker-compose/dev/docker-compose.yml logs -f postgresql
```

`dev:docker:reset` 会删除全部本地 named volume（含 Postgres / Redis / RustFS），数据不可恢复。

## 图形工具连接

DBeaver Community、pgAdmin 4 或 Drizzle Studio 均可连接：

```text
Host: 127.0.0.1
Port: 5432
Database: purechat
Username: purechat
Password: docker-compose/dev/.env 中的 POSTGRES_PASSWORD
SSL: disable
```

打开项目自带的 Drizzle Studio：

```bash
pnpm db:studio
```

## 备份与恢复

```bash
docker compose -f docker-compose/dev/docker-compose.yml exec -T postgresql \
  pg_dump -U purechat -d purechat --format=custom --no-owner \
  > purechat-backup.dump
```

## 常见故障

### Docker 未运行

确认 Docker Desktop（或 daemon）已启动，再执行 `docker compose version`。

### 端口被占用

```bash
# macOS / Linux
lsof -nP -iTCP:5432 -sTCP:LISTEN

# Windows PowerShell
Get-NetTCPConnection -LocalPort 5432 -ErrorAction SilentlyContinue
```

### 启动失败

```bash
docker compose -f docker-compose/dev/docker-compose.yml logs --tail=100 postgresql
docker compose -f docker-compose/dev/docker-compose.yml ps
```
