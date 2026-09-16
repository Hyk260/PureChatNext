---
title: Docker 自托管
description: 本地开发依赖、生产应用容器，以及 pnpm Docker 命令与参数说明。
---

# Docker 自托管

PureChatNext 同时支持 Vercel 与 Docker 自托管。本地开发用 Compose 启动 PostgreSQL、Redis、RustFS 和 SearXNG。生产只运行应用容器，连接宿主机已有的 PostgreSQL（必须）和 Redis（可选）；文件使用云对象存储，联网搜索使用云 API。HTTPS 由宿主机 Nginx 或 Caddy 提供。默认资源档案为 `2g`。

相关 `pnpm` 脚本的用途与参数见 [命令参考](#命令参考)。向脚本传参时，标志写在 `--` 后面，例如 `pnpm docker:pack -- --skip-build`。

## 本地开发依赖

```bash
pnpm docker:setup:dev
pnpm dev:docker
pnpm db:migrate
```

开发服务只监听 `127.0.0.1`。`pnpm docker:setup:dev` 会创建权限为 `0600` 的 `.env`，并为 PostgreSQL、RustFS、SearXNG 生成随机本地凭证；不要直接把 `.env.example` 复制成 `.env`。端口与镜像可在 `docker-compose/dev/.env` 修改。`pnpm dev:docker` 结束后会打印各服务入口与凭证位置。

```bash
pnpm docker:validate
pnpm dev:docker:down
pnpm dev:docker:reset       # 交互确认后删除全部开发卷
pnpm dev:docker:reset -- --yes
```

`dev:docker:reset` 会删除开发卷数据。日常停止只使用 `dev:docker:down`。

## 镜像构建命令

`Dockerfile` 的 builder 阶段执行 `pnpm run build:docker`，不要用普通 `pnpm build` 替代。后者只产出可运行的 Next 应用，不含容器启动时要用的迁移入口。

### `build:docker`

等价于 `pnpm build && pnpm run build:docker:migrate`：先走和 Vercel 相同的 SPA + Next standalone 构建，再打包容器启动用的迁移入口。本地一般不需要手跑；`docker compose ... up --build` 会在镜像里执行。

### `build:docker:migrate`

`scripts/build-docker-migrate.mjs` 用 esbuild 把迁移入口和 S3 bucket 初始化入口分别打成单文件（Node 22 ESM）。镜像再把它们拷成 `/app/docker-migrate.mjs` 与 `/app/docker-s3-init.mjs`。

必须单独 bundle：standalone 运行时没有完整 `node_modules` 和源码，启动前又要能连上 PostgreSQL、拿 advisory lock、跑 Drizzle SQL。打进一个文件后，容器入口可以是：

```sh
node /app/docker-s3-init.mjs && node /app/docker-migrate.mjs && exec node /app/server.js
```

迁移失败则进程退出，应用不会起来。逻辑说明见 [Drizzle 指南](../../development/database/drizzle.md)。

## 生产部署

生成生产配置（默认写入 `2g` 资源档案）：

```bash
pnpm docker:setup:deploy
```

该命令生成权限为 `0600` 的 `docker-compose/deploy/.env`，包含鉴权密钥、JWKS，以及应用使用的 `purechat` 数据库密码。已有文件不会被覆盖。随后请填写：

- `APP_URL`：正式 HTTPS 地址（CORS 默认允许该地址，不必再配一份相同的 `ALLOWED_ORIGINS`）
- 对象存储：`S3_ENDPOINT`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`
- 至少一个模型 Provider 密钥

云服务器上的 `install.sh` 会检测正在运行的 PostgreSQL 容器，创建用户和数据库 `purechat`；若存在 Redis 容器，则可选接入。本地 `pnpm docker:deploy` 不会创建这些用户，需要自行把 `POSTGRES_HOST` 指向可访问的 Postgres。

启动：

```bash
pnpm docker:deploy
```

该命令等价于使用生产 `.env` 执行 `docker compose up -d --build --wait`。后续升级也复用同一命令。

云服务器可访问 GHCR 时，推荐在线一条命令（无需本机构建）：

```bash
curl -fsSL https://raw.githubusercontent.com/Hyk260/PureChatNext/main/docker-compose/deploy/install-online.sh \
  | sudo APP_URL=https://chat.example.com bash
```

应用镜像：`ghcr.io/hyk260/purechat-next`（`main` / `v*` tag 由 CI 推送）。不便拉镜像时再本机打离线包：

```bash
pnpm docker:pack
pnpm docker:upload   # 连接信息见 docker-compose/deploy/upload.env.example
# 上传 dist/docker-offline/purechat-next-offline.tar 后：
# sudo APP_URL=https://chat.example.com /opt/purechat/install.sh
```

完整步骤见 [云服务器部署](./1panel.md)。

应用启动时：未配置 `S3_ENDPOINT` 则跳过建桶；随后获取 advisory lock 并执行 Drizzle 迁移。迁移失败时应用不会启动。`GET /api/health` 检查已配置的依赖；未配置的 Redis、对象存储或搜索显示为 `skipped`。

生产 Compose 只发布应用端口，默认监听 `127.0.0.1:3210`。PostgreSQL 与 Redis 使用宿主机已有实例，不要把 `5432`、`6379` 暴露到公网。应用容器以非 root 运行，启用只读 rootfs、tmpfs、最小 capabilities 和内存上限。

Channel Gateway 内置于 `app` 的 Next 进程，Compose 通过 `CHANNEL_GATEWAY_ENABLED=1` 开启。微信 / QQ 渠道需要 `KEY_VAULTS_SECRET`；模型密钥由用户在设置页加密保存。验收见 [微信渠道](../channels/wechat/setup.md)。

Nginx 示例：

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
docker exec -T postgresql pg_dump -U purechat -d purechat --format=custom --no-owner > purechat.dump
```

容器名以 `.env` 中的 `POSTGRES_CONTAINER` 为准。对象存储请在云厂商控制台备份。

能在本机构建时，升级前先备份，再拉取代码并执行 `pnpm docker:deploy`。云服务器在线安装用 `install-online.sh up`（或 `PURECHAT_REFRESH=1` 刷新编排）；离线主机使用 `pnpm docker:pack` 与 `./install.sh up`，见 [云服务器部署](./1panel.md)。

不要对生产 Compose 执行 `down -v`，也不要运行全局 `docker system prune --volumes`。

## 命令参考

| 命令 | 用途 |
| --- | --- |
| `docker:setup:dev` | 生成 `docker-compose/dev/.env`（随机本地凭证；已有文件不覆盖） |
| `dev:docker` | 启动 PostgreSQL、Redis、RustFS、SearXNG，并确保 RustFS bucket 存在 |
| `dev:docker:down` | 停止开发依赖，保留 named volume |
| `dev:docker:reset` | 删卷后重建，并执行 `db:migrate` |
| `build:docker` | 镜像 builder：SPA + Next + 容器启动用的迁移入口 |
| `build:docker:migrate` | 把迁移 / S3 初始化入口打成单文件 |
| `docker:setup:deploy` | 生成生产 `docker-compose/deploy/.env` |
| `docker:deploy` | 本机构建并启动生产 Compose |
| `docker:pack` | 打离线包（仅应用镜像） |
| `docker:upload` | 把离线包 SCP 到服务器 |
| `docker:validate` | 校验 Compose 配置与安装脚本语法 |
| `docker:verify:local` | 隔离环境冒烟：安全基线、健康检查、持久化 |

### 本地开发

`docker:setup:dev`、`dev:docker`、`dev:docker:down` 无额外参数。不要手抄 `docker-compose/dev/.env.example`。

`dev:docker:reset`：

| 参数 | 说明 |
| --- | --- |
| `--yes` | 跳过「输入 `DELETE`」确认。非 TTY（CI）必须带上，否则会失败 |

```bash
pnpm dev:docker:reset -- --yes
```

### 镜像构建

`build:docker` / `build:docker:migrate` 无额外参数。由 `Dockerfile` 的 builder 阶段调用，本地一般不用手跑。说明见上文 [镜像构建命令](#镜像构建命令)。

### 生产配置与启动

`docker:setup:deploy` 已有 `docker-compose/deploy/.env` 时不会覆盖。

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `--profile NAME` | `2g` | 叠加 `docker-compose/deploy/profiles/<NAME>.env`。仓库目前只有 `2g`（应用内存上限 512m） |

```bash
pnpm docker:setup:deploy
pnpm docker:setup:deploy -- --profile 2g
```

`docker:deploy` 默认 `docker compose up -d --build --wait`。

| 参数 | 说明 |
| --- | --- |
| `--no-build` | 不构建、不 pull，使用本机已有镜像（例如刚 `docker:pack` 打出的 `purechat-next:local`） |

```bash
pnpm docker:deploy -- --no-build
```

### 离线包

`docker:pack` 产物默认是 `dist/docker-offline/purechat-next-offline.tar`。打包步骤见 [云服务器部署 · 离线包](./1panel.md#方式二离线包)。

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `--platform` | `linux/amd64` | 导出架构。云服务器通常是 amd64；Apple Silicon 上默认仍按 amd64 重建 |
| `--skip-build` | 关 | 只导出已有 `purechat-next:local`，**不**按当前源码重建。升级不要加这个参数 |
| `--no-cn-mirror` | 关 | 不走 Docker Hub / GHCR 国内镜像站 |
| `--output DIR` | `dist/docker-offline` | 离线包输出目录 |
| `--app-only` | 可省略 | 生产包本来就只含应用镜像，加上只打印提示 |

```bash
pnpm docker:pack
pnpm docker:pack -- --skip-build
pnpm docker:pack -- --platform linux/amd64 --output dist/docker-offline
pnpm docker:pack -- --no-cn-mirror
```

拉基础镜像时可用环境变量覆盖镜像站：`DOCKER_HUB_MIRROR`（默认 `docker.m.daocloud.io`）、`GHCR_MIRROR`（默认 `ghcr.nju.edu.cn`）。

`docker:upload` 读取 `docker-compose/deploy/upload.env`（或当前 shell 里已 export 的变量），不要把 SSH 私钥写进应用 `.env`。连接变量见 [云服务器部署 · 上传](./1panel.md#2-上传)。

| 参数 | 说明 |
| --- | --- |
| `--file PATH` | 本地 tar，默认 `dist/docker-offline/purechat-next-offline.tar` |
| `--env-file PATH` | SSH 配置文件，默认 `docker-compose/deploy/upload.env` |
| `--host` / `--user` / `--port` | 覆盖 SSH 目标 |
| `--extract` | 上传后解压到 `PURECHAT_HOME`，不覆盖已有 `.env` |
| `--up` | 解压后执行 `install.sh up`（升级；服务器上须已有 `.env`） |
| `--dry-run` | 只打印将执行的命令 |

```bash
pnpm docker:upload
pnpm docker:upload -- --extract
pnpm docker:upload -- --up
pnpm docker:upload -- --host 203.0.113.10 --user root --dry-run
```

### 校验与冒烟

`docker:validate` 无参数。检查开发 / 生产 / 在线 overlay / 验证 overlay 的 Compose `config`，以及 `install.sh`、`install-online.sh`、`start-ip.sh` 的 bash 语法。CI 每次 PR 都会跑。

`docker:verify:local` 用临时 `.env` 和 `docker-compose.verify.yml` 拉起隔离的 app + PostgreSQL + Redis，检查安全基线、`GET /api/health`、迁移记录和重启后数据是否还在。默认会构建镜像，并用 Docker Scout 扫描 High/Critical。这是本机 / CI 冒烟，不是生产安装路径。

| 参数 | 说明 |
| --- | --- |
| `--skip-build` | 使用已有 `purechat-next:local`，不在验证里再构建 |
| `--platform ARCH` | 设 `DOCKER_DEFAULT_PLATFORM`，例如 `linux/amd64` |
| `--skip-scan` | 跳过 Scout 门禁，仅供隔离排障，不要当生产验收 |
| `--external-scan` | 跳过 Scout，改由外部扫描（CI 用 Trivy） |
| `--keep` | 结束后不删验证 project，便于看日志 |

```bash
pnpm docker:verify:local
pnpm docker:verify:local -- --keep
pnpm docker:verify:local -- --skip-build --external-scan --platform linux/amd64
```

## 故障排查

```bash
docker compose --env-file docker-compose/deploy/.env -f docker-compose/deploy/docker-compose.yml ps
docker compose --env-file docker-compose/deploy/.env -f docker-compose/deploy/docker-compose.yml logs -f app
curl --fail http://127.0.0.1:3210/api/health
```

云服务器改完 `docker-compose/deploy/.env` 后不要用 1Panel「重启」或 `docker restart`：环境变量在创建容器时注入。重建应用：

```bash
cd /opt/purechat
sudo ./install.sh up --force-recreate
```

说明见 [云服务器部署 · 更新环境变量](./1panel.md#更新环境变量)。

应用日志停在 `[Database] waiting for PostgreSQL` 时检查数据库健康与密码；迁移报 schema 不一致时按 [Drizzle 指南](../../development/database/drizzle.md#迁移失败) 修复，禁止清卷绕过。
