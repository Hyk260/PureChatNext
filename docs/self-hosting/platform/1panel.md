---
title: 云服务器部署
description: 在线一条命令安装，或本机打包离线镜像；由 Nginx 提供 HTTPS 反代。
---

# 云服务器部署

生产只运行应用容器，连接宿主机已有的 PostgreSQL（必须）和 Redis（可选）；文件使用云对象存储，联网搜索使用云 API。HTTPS 由宿主机 Nginx 或 Caddy 提供。通用 Compose 说明见 [Docker 自托管](./docker.md)。

默认资源档案为 [`profiles/2g.env`](../../../docker-compose/deploy/profiles/2g.env)（应用内存上限 512m）。安装前请先启动 PostgreSQL 容器；Redis 与对象存储按需配置。

## 方式一：在线安装（推荐）

目标主机可访问 GHCR（或你指定的镜像仓库）时，无需本机打包：

```bash
curl -fsSL https://raw.githubusercontent.com/Hyk260/PureChatNext/main/docker-compose/deploy/install-online.sh \
  | sudo APP_URL=https://chat.example.com bash
```

脚本会把编排文件下载到 `/opt/purechat`（可用 `PURECHAT_HOME` 覆盖），拉取 `ghcr.io/hyk260/purechat-next`，生成 `.env` 并启动。

常用变量：

| 变量 | 说明 |
| --- | --- |
| `APP_URL` | 正式 HTTPS 地址（CORS 默认允许该地址，不必再配 `ALLOWED_ORIGINS`） |
| `PURECHAT_HOME` | 安装目录，默认 `/opt/purechat` |
| `PURECHAT_REF` | 下载编排文件用的 Git 引用，默认 `main`；发版后可改为 `v0.2.5` |
| `PURECHAT_IMAGE` | 应用镜像，默认 `ghcr.io/hyk260/purechat-next:latest` |
| `PURECHAT_VERSION` | 未设 `PURECHAT_IMAGE` 时的 tag |
| `PURECHAT_REFRESH` | 设为 `1` 时按 `PURECHAT_REF` 重新下载编排（保留 `.env`） |

临时用公网 IP（安全组放行 **3210**）：

```bash
curl -fsSL https://raw.githubusercontent.com/Hyk260/PureChatNext/main/docker-compose/deploy/install-online.sh \
  | sudo bash -s --
# 若已下载到 /opt/purechat：
sudo /opt/purechat/start-ip.sh
```

镜像由 GitHub Actions 在推送 `main` 或 `v*` tag 时发布到 GHCR。首次发布后请在 GitHub Packages 将 `purechat-next` 设为 **Public**，否则匿名 `docker pull` 会失败。

升级（保留 `.env`）：

```bash
sudo PURECHAT_REFRESH=1 PURECHAT_REF=main \
  PURECHAT_IMAGE=ghcr.io/hyk260/purechat-next:latest \
  /opt/purechat/install-online.sh up
```

或只更新镜像、不重下编排：

```bash
cd /opt/purechat
sudo PURECHAT_IMAGE=ghcr.io/hyk260/purechat-next:latest ./install.sh --online up
```

## 方式二：离线包

本机无外网构建能力、或目标主机不能拉镜像时使用。

```text
本机 pnpm docker:pack
  ↓ 首次 pnpm docker:upload -- --install --app-url https://chat.example.com
  ↓ 升级 pnpm docker:upload -- --up
反代 HTTPS → 127.0.0.1:3210
```

### 1. 本机打包

```bash
git clone https://github.com/Hyk260/PureChatNext.git
cd PureChatNext
pnpm install
pnpm docker:pack
```

默认导出 **linux/amd64** 离线包。Apple Silicon 上若本地镜像是 arm64，打包时会按 amd64 重新构建，并默认经镜像站拉取基础镜像（可用 `DOCKER_HUB_MIRROR`、`GHCR_MIRROR` 覆盖）。`--no-cn-mirror` 会跳过镜像站。离线包只含应用镜像，PostgreSQL 与 Redis 使用目标主机上已有的实例。完整参数（`--platform`、`--output` 等）见 [Docker 自托管 · 命令参考](./docker.md#离线包)。

`--skip-build` 只导出本机已有的 `purechat-next:local`，**不会**根据当前源码重建。刚打完包、只想再导出一次时才用：

```bash
pnpm docker:pack -- --skip-build
```

产物是 `dist/docker-offline/purechat-next-offline.tar`，内含：

- `purechat-next:local` 应用镜像
- 生产 Compose、`.env.example`、`2g` 档案
- `install.sh`、`start-ip.sh`

打包**不会**带上本机 `docker-compose/deploy/.env`。密钥在目标主机上生成。

### 2. 上传

不要把 SSH 私钥写进应用 `.env` 或 `packages/env`，那些是运行时配置。上传只用本机环境变量或 `docker-compose/deploy/upload.env`。

```bash
cp docker-compose/deploy/upload.env.example docker-compose/deploy/upload.env
chmod 600 docker-compose/deploy/upload.env
# 填写 PURECHAT_SSH_HOST，以及 PURECHAT_SSH_KEY_FILE 或 PURECHAT_SSH_KEY
pnpm docker:upload -- --install --app-url https://chat.example.com
```

也可不建文件，直接 export：

```bash
export PURECHAT_SSH_HOST=203.0.113.10
export PURECHAT_SSH_USER=root
export PURECHAT_SSH_KEY_FILE="$HOME/.ssh/id_ed25519"
# 或：export PURECHAT_SSH_KEY="$(cat ~/.ssh/id_ed25519)"
pnpm docker:upload -- --install --app-url https://chat.example.com
```

已安装过、只更新镜像时：

```bash
pnpm docker:upload -- --up
```

`--install` 会上传、解压到 `/opt/purechat` 并执行 `install.sh`。`--up` 同样上传并解压，再执行 `install.sh up`，**不会覆盖**已有 `.env`。只上传不解压用默认命令；`--extract` 只解压、不启动容器。

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `PURECHAT_SSH_HOST` | 是 | 服务器 IP 或域名；也可 `root@203.0.113.10` |
| `PURECHAT_SSH_USER` | 否 | 默认 `root` |
| `PURECHAT_SSH_PORT` | 否 | 默认 `22`；改了就要在安全组放行同一端口 |
| `PURECHAT_SSH_KEY_FILE` | 三选一 | 私钥路径，推荐 |
| `PURECHAT_SSH_KEY` | 三选一 | 私钥全文；单行可用 `\n`。不要提交、不要打印 |
| ssh-agent | 三选一 | 未设上面两项时使用；带口令的密钥请先 `ssh-add` |
| `PURECHAT_REMOTE_TAR` | 否 | root 默认 `/opt/purechat-next-offline.tar`；非 root 默认 `/tmp/...` |
| `PURECHAT_HOME` | 否 | 解压目录，默认 `/opt/purechat`（不要有空格） |
| `PURECHAT_SSH_EXTRA_OPTS` | 否 | 额外 ssh 参数，例如 `-J bastion` |

当前 shell 里已 export 的值优先于 `upload.env`。完整示例见 `docker-compose/deploy/upload.env.example`。也兼容旧文件名 `.upload.env`。

仍可手动 `scp`：

```bash
scp dist/docker-offline/purechat-next-offline.tar root@SERVER:/opt/purechat-next-offline.tar
```

建议解压到 `/opt/purechat`（路径不要有空格）。

### 上传所需的服务器权限

上传**只走 SSH**。云安全组和主机防火墙按下面放行即可。

| 端口 | 方向 | 谁访问 | 何时需要 |
| --- | --- | --- | --- |
| SSH（默认 **22**，或你改过的 `PURECHAT_SSH_PORT`） | 入站 | **仅你的出口 IP** | 上传、远程解压、远程 `install.sh` |
| **80 / 443** | 入站 | 公网 | 正式 HTTPS 反代。上传本身不需要 |
| **3210** | 入站 | 公网 | 仅 `start-ip.sh` 临时调试；正式环境不要开 |
| **5432 / 6379** | — | 不要对公网开放 | PostgreSQL / Redis 只给本机 Docker 网络 |

SSH 账号需要：

- 公钥登录（脚本使用 `BatchMode`，不支持交互输密码）
- **root**：可直接写 `/opt`、调用 Docker（1Panel 常见）
- **非 root**：对目标目录可写（tar 默认 `/tmp`），并且 `sudo -n` 免密，以便 `--extract` / `--install` / `--up` 解压到 `/opt/purechat` 和执行 `install.sh`
- 运行 `install.sh` 时能连接 Docker（用户在 `docker` 组，或使用 sudo）

建议：关闭密码登录，只放行你的 IP 访问 SSH，磁盘至少留出离线包两倍空间（约 300MB 量级，镜像解开后更大）。

#### 首次配置 SSH 公钥

端口通了但仍 `Permission denied (publickey,password)`，说明 SSH 服务正常，只是 **root 还没有你的公钥**。脚本不会弹出密码框。

**1Panel（推荐）**

1. 「基础配置」保持现状即可：连接端口 `22`、root 允许登录、**密钥认证**开启。密码认证可先留着，公钥通了再关。
2. 点顶部 **授权密钥**（不要用「密钥信息」——那是服务器自己的主机密钥，不是登录公钥）。
3. 本机执行 `cat ~/.ssh/id_ed25519.pub`，把整行（以 `ssh-ed25519` 开头）粘贴进去并保存。
4. 本机 `docker-compose/deploy/upload.env` 写上 `PURECHAT_SSH_KEY_FILE=~/.ssh/id_ed25519`，再执行 `pnpm docker:upload`。

「反向解析」建议关掉，只影响连接速度，不是这次失败的原因。

**命令行备用**（1Panel 终端或云厂商 VNC，root）：

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
echo 'ssh-ed25519 AAAA... 你的公钥整行' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
```

没有本机公钥时先生成：`ssh-keygen -t ed25519 -C "purechat-upload"`。私钥若有口令，先 `ssh-add ~/.ssh/id_ed25519`。

### 3. 安装

确认已安装 Docker 与 Compose。域名 A 记录解析到主机公网 IP（若使用域名）。

```bash
sudo mkdir -p /opt/purechat
sudo tar -xf /opt/purechat-next-offline.tar -C /opt/purechat
# 有域名（把 APP_URL 换成你的 HTTPS 地址）：
sudo APP_URL=https://chat.example.com /opt/purechat/install.sh
# 临时用公网 IP 调试：
sudo /opt/purechat/start-ip.sh
```

`start-ip.sh` 会探测公网 IP、写入 `APP_URL=http://IP:3210`、把应用绑到 `0.0.0.0`（需在安全组放行 **3210**）。Cookie / OAuth / 微信渠道在 HTTP+IP 下可能异常；正式环境请改用域名，并把 `APP_BIND_ADDRESS` 改回 `127.0.0.1`。

安装脚本会：检测应用镜像 → 生成或复用 `.env` → 在已运行的 PostgreSQL 容器中创建用户和数据库 `purechat`（若存在 Redis 则可选接入）→ 将应用加入共享 Docker 网络 → `docker compose up`。已有 `.env` 时不覆盖密钥。安装前请先启动 PostgreSQL。

网页聊天可把模型 Provider 密钥写入 `/opt/purechat/docker-compose/deploy/.env`（例如 `DEEPSEEK_API_KEY`）作为兜底；微信 / QQ 必须在设置页保存用户自己的密钥。然后：

```bash
sudo /opt/purechat/install.sh up
```

不要单独导入 `docker-compose.yml`：工作目录必须是解压后的离线包根目录。离线模式不要在目标主机上 `docker pull` 或 `docker build`。

启动后应用默认只监听 `127.0.0.1:3210`。容器会获取 advisory lock 并执行 Drizzle 迁移；迁移失败则应用不会起来。

```bash
cd /opt/purechat
sudo ./install.sh ps
curl --fail http://127.0.0.1:3210/api/health
```

## 配置反代与证书

1. 为正式域名创建反向代理，指到 `http://127.0.0.1:3210`。
2. 开启 WebSocket。
3. 申请 TLS 证书。
4. 在站点 Nginx 中使用：

```nginx
location / {
  proxy_pass http://127.0.0.1:3210;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection $connection_upgrade;
  proxy_buffering off;
  proxy_cache off;
  proxy_read_timeout 300s;
  proxy_send_timeout 300s;
}
```

`proxy_buffering off` 和 300s 超时是为了 AI 流式输出。

## 更新环境变量

只编辑 `/opt/purechat/docker-compose/deploy/.env`，不要在 1Panel 容器详情里改环境变量（下次 `up` 会被 `.env` 覆盖）。

环境变量在**创建容器时**注入。1Panel「重启」、`docker restart`、`./install.sh restart` 都不会加载新的 `.env`，必须重建容器：

```bash
cd /opt/purechat
sudo ./install.sh up --force-recreate
```

改完 `APP_URL`、对象存储、模型密钥、`DISABLE_REDIS` 等之后都用这一条。确认已进容器：

```bash
sudo ./install.sh exec app printenv APP_URL REDIS_URL DISABLE_REDIS
```

`up` 会重新探测 PostgreSQL / Redis，并可能改写 `REDIS_URL`、`REDIS_USERNAME`、`REDIS_PASSWORD`。

## 验收

1. 浏览器打开你的 `APP_URL`（例如 `https://chat.example.com`），页面可加载。
2. `https://chat.example.com/api/health`（换成你的域名）返回健康 JSON；未配置的可选依赖为 `skipped`。
3. 注册或登录后能发送一条短对话，流式输出完整结束。

## 升级与备份

升级前备份数据库（文件放到 Docker 卷之外，例如 `/opt/backups`）：

```bash
sudo mkdir -p /opt/backups
docker exec -T postgresql pg_dump -U purechat -d purechat --format=custom --no-owner \
  > /opt/backups/purechat-$(date +%F).dump
```

容器名以 `.env` 中的 `POSTGRES_CONTAINER` 为准，缺省多为 `postgresql`。

**在线**：见上文「升级」；会拉取新镜像并 `up`，**不要覆盖** `.env`。

**离线**：本机拉代码后执行 `pnpm docker:pack`（不要加 `--skip-build`），用 `pnpm docker:upload -- --up` 传到主机并解压（会覆盖镜像档案和 `install.sh`，**不要覆盖** `docker-compose/deploy/.env`）。也可手动：

```bash
sudo tar -xf /opt/purechat-next-offline.tar -C /opt/purechat
sudo /opt/purechat/install.sh up
```

`install.sh up` 会在应用镜像档案变化时重新 `docker load`，并 `--force-recreate` app 容器。只 `docker restart` 不会切换到新镜像，也不会加载新的 `.env`：容器创建时钉死了镜像 ID 和环境变量。改镜像或改 `.env` 都用 `sudo ./install.sh up --force-recreate`。

离线包本身不含 `.env`。不要在生产环境执行 `down -v` 或 `docker system prune --volumes`。

## 注意事项

- **离线上传密钥**：SSH 私钥只放本机 `upload.env` 或环境变量，不要写进服务器上的应用 `.env`。
- **渠道**：微信 / QQ Gateway 已打进 `app` 容器，仍要公网 HTTPS。见 [微信渠道](../channels/wechat/setup.md) 与 [QQ 渠道](../channels/qq/setup.md)。
- **邮件**：验证邮箱和重置密码需要 SMTP，见 [邮件服务](../auth/email.md)。
- **不要用公网 IP 当正式 APP_URL**：Cookie、CORS、证书和后续换域名都会出问题。
- **数据库**：使用专用用户和数据库 `purechat`，不要与其它应用共用同一套库。不要把 `5432`、`6379` 暴露到公网。
- **文件与搜索**：配置 S3 兼容对象存储；`SEARCH_PROVIDERS` 可填 tavily 等，默认不启用自建搜索。
- **健康检查失败**：应用日志停在 `[Database] waiting for PostgreSQL` 时，核对 `POSTGRES_HOST`（应为数据库容器名）和 `POSTGRES_PASSWORD`，并确认 PostgreSQL 已启动。
- **Redis `WRONGPASS`**：应用日志刷 `invalid username-password` 时，先确认 Redis 容器环境变量 `REDIS_PASSWORD` 与 `docker-compose/deploy/.env` 一致，再执行 `sudo ./install.sh up --force-recreate`。脚本会校验 ACL / 实例密码；认证失败则清空 `REDIS_URL`，应用降级运行。不需要 Redis 时可在 `.env` 设 `DISABLE_REDIS=1` 后同样重建容器。

## 常用命令

```bash
cd /opt/purechat

sudo ./install.sh ps
sudo ./install.sh logs --tail=100 app
sudo ./install.sh up --force-recreate
```
