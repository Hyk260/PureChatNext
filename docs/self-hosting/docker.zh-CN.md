# Docker 自托管

PureChatNext 同时支持 Vercel 与 Docker 自托管。Docker 生产方案包含应用、PostgreSQL、Redis、RustFS 和 SearXNG，HTTPS 由宿主机上的 Nginx 或 Caddy 提供。

## 本地开发依赖

```bash
pnpm docker:setup:dev
pnpm dev:docker
pnpm db:migrate
```

开发服务只监听 `127.0.0.1`。端口、镜像与 Redis 内存上限可在 `docker-compose/dev/.env` 修改。`pnpm dev:docker` 结束后会打印 PostgreSQL、Redis、RustFS、SearXNG 的入口与凭证位置。

```bash
pnpm docker:validate
pnpm dev:docker:down
pnpm dev:docker:reset       # 交互确认后删除全部开发卷
pnpm dev:docker:reset -- --yes
```

`dev:docker:reset` 会删除 PostgreSQL、Redis、RustFS 的全部开发数据。日常停止只使用 `dev:docker:down`。

## 生产部署

生成生产配置：

```bash
pnpm docker:setup:deploy
```

该命令生成 `docker-compose/deploy/.env`，包含随机 PostgreSQL/Redis/RustFS 密码、鉴权密钥与 JWKS。已有文件不会被覆盖。随后必须修改：

- `APP_URL`：正式 HTTPS 地址；
- `ALLOWED_ORIGINS`：与正式地址一致；
- 至少一个模型 Provider 密钥；
- 如需固定供应链版本，将 RustFS/SearXNG 镜像改为验证过的 tag 或 digest。

启动：

```bash
docker compose \
  --env-file docker-compose/deploy/.env \
  -f docker-compose/deploy/docker-compose.yml \
  up -d --build --wait
```

应用启动前会等待 PostgreSQL、获取 advisory lock 并自动执行 Drizzle migration；迁移失败时应用不会启动。健康检查为 `GET /api/health`。

生产 Compose 不暴露 PostgreSQL、Redis、RustFS 或 SearXNG 端口，RustFS bucket 也不会设置匿名读取策略；文件经应用鉴权代理访问。应用只监听宿主机 `127.0.0.1:3210`。Nginx 示例：

```nginx
server {
  listen 443 ssl http2;
  server_name chat.example.com;

  ssl_certificate /path/to/fullchain.pem;
  ssl_certificate_key /path/to/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3210;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 备份、恢复与升级

数据库备份：

```bash
docker compose --env-file docker-compose/deploy/.env -f docker-compose/deploy/docker-compose.yml \
  exec -T postgresql pg_dump -U purechat -d purechat --format=custom --no-owner > purechat.dump
```

Redis 使用 AOF + RDB 持久化；可在备份卷前执行：

```bash
docker compose --env-file docker-compose/deploy/.env -f docker-compose/deploy/docker-compose.yml \
  exec redis redis-cli --no-auth-warning -a '<REDIS_PASSWORD>' BGSAVE
```

RustFS 数据位于 `purechat-deploy_rustfs_data`，应通过 `mc mirror` 或独立卷快照备份。数据库、Redis 与对象存储备份必须放在 Docker 卷之外。

升级前先备份，再拉取代码并执行：

```bash
docker compose --env-file docker-compose/deploy/.env -f docker-compose/deploy/docker-compose.yml \
  up -d --build --wait
```

不要对生产 Compose 执行 `down -v`，也不要运行全局 `docker system prune --volumes`。

## 故障排查

```bash
docker compose --env-file docker-compose/deploy/.env -f docker-compose/deploy/docker-compose.yml ps
docker compose --env-file docker-compose/deploy/.env -f docker-compose/deploy/docker-compose.yml logs -f app
curl --fail http://127.0.0.1:3210/api/health
```

应用日志停在 `[Database] waiting for PostgreSQL` 时检查数据库健康与密码；迁移报 schema 不一致时按 [Drizzle 指南](../drizzle-setup.zh-CN.md#迁移失败) 修复，禁止清卷绕过。
