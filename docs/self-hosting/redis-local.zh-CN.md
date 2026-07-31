# 本地 Redis 管理

PureChatNext 可使用 Redis 保存 Better Auth 次级存储、微信渠道上下文和其他缓存数据。本地 Redis 采用手动启停，不随 `pnpm dev` 自动启动。

## 当前约定

- Redis：Homebrew 安装，默认路径 `/opt/homebrew/opt/redis`
- 连接地址：`redis://127.0.0.1:6379`
- 数据目录：外置 SSD `/Volumes/MacOs/RedisData`
- 项目配置：`config/redis.local.conf`
- 日志文件：`/Volumes/MacOs/RedisData/redis.log`
- PID 文件：`/Volumes/MacOs/RedisData/redis.pid`
- 持久化：RDB + AOF，AOF 每秒同步
- 内存上限：2GB，达到上限后使用 `allkeys-lru` 淘汰旧键
- 网络：仅监听本机 `127.0.0.1` 和 `::1`

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

控制脚本还支持以下临时覆盖变量：

| 变量                        | 默认值                                  | 用途                 |
| --------------------------- | --------------------------------------- | -------------------- |
| `PURECHAT_REDIS_DATA_DIR`   | `/Volumes/MacOs/RedisData`              | 数据、日志和 PID 目录 |
| `PURECHAT_REDIS_CONFIG`     | `config/redis.local.conf`               | Redis 配置文件       |
| `PURECHAT_REDIS_HOST`       | `127.0.0.1`                             | 状态检测地址         |
| `PURECHAT_REDIS_PORT`       | `6379`                                  | 本地监听端口         |

例如临时使用其他端口：

```bash
PURECHAT_REDIS_PORT=6380 pnpm redis:start
```

## 启停和状态检测

启动前先连接外置 SSD，并确认它挂载为 `/Volumes/MacOs`。

```bash
pnpm redis:start
pnpm redis:status
pnpm redis:restart
pnpm redis:stop
```

`redis:status` 在 Redis 正常运行时返回退出码 `0`，未运行时返回 `1`。状态输出包括版本、PID、监听地址、数据目录、内存限制和 AOF 设置。

控制脚本只会停止数据目录与 `PURECHAT_REDIS_DATA_DIR` 一致的 Redis。如果端口被其他 Redis 或非 Redis 服务占用，脚本会拒绝启停，避免误操作。

## 应用连接检查

启动 Redis 后可以写入测试数据并回读：

```bash
pnpm redis:status
bun scripts/redis-seed.ts
```

也可以直接检查：

```bash
/opt/homebrew/opt/redis/bin/redis-cli PING
# PONG
```

## 外置 SSD 注意事项

拔出或卸载 SSD 前必须先停止 Redis：

```bash
pnpm redis:stop
```

同时使用本地 PostgreSQL 时，可以一次停止两个服务：

```bash
pnpm local:services:stop
```

不要在 Redis 运行时强制拔盘，否则 AOF/RDB 写入可能失败。重新连接 SSD 后，先确认挂载点仍为 `/Volumes/MacOs`，再执行 `pnpm redis:start`。

## 常见故障

### 外置卷未挂载

脚本提示 `外置卷未挂载` 时，检查 Finder 中的磁盘名称以及以下命令：

```bash
mount | grep '/Volumes/MacOs'
```

如果磁盘名称变化，可恢复原名称，或者通过 `PURECHAT_REDIS_DATA_DIR` 指定新路径。

### 端口被占用

```bash
lsof -nP -iTCP:6379 -sTCP:LISTEN
```

不要直接结束未知进程。确认它是否为需要保留的 Redis，再决定使用其他端口或停止旧实例。

### Redis 启动失败

查看日志：

```bash
tail -n 100 /Volumes/MacOs/RedisData/redis.log
```

重点检查数据目录写权限、SSD 剩余空间以及配置文件语法。
