# 本地 PostgreSQL 管理

PureChatNext 可以直接连接本机 PostgreSQL，不需要为了数据库功能单独部署完整 Supabase。本项目的本地实例采用手动启停，数据库文件保存在外置 SSD。

## 当前约定

- PostgreSQL：Homebrew `postgresql@17`
- 程序目录：`/opt/homebrew/opt/postgresql@17/bin`
- 连接地址：`127.0.0.1:5432`
- 数据库/用户：`purechat`
- 数据目录：`/Volumes/MacOs/PostgreSQL/17/data`
- 日志目录：`/Volumes/MacOs/PostgreSQL/17/log`
- 备份目录：`/Volumes/MacOs/PostgreSQL/17/backups`
- 项目配置：`config/postgresql.local.conf`
- 认证：SCRAM-SHA-256
- 网络：仅监听本机 `127.0.0.1` 和 `::1`

外置 SSD 应使用 APFS，并启用文件所有权。数据库运行期间不要拔出或卸载磁盘。

## 环境变量

在 `.env.local` 中配置：

```env
DATABASE_DRIVER=node
DATABASE_URL=postgresql://purechat:<本地密码>@127.0.0.1:5432/purechat
```

`DATABASE_DRIVER=node` 会关闭本地连接的强制 SSL。密码包含 `@`、`:`、`/`、`?`、`#` 或 `%` 时必须进行 URL 编码。不要提交 `.env.local`。

控制脚本支持以下临时覆盖变量：

| 变量                   | 默认值                                           | 用途             |
| ---------------------- | ------------------------------------------------ | ---------------- |
| `POSTGRES_BIN_DIR`     | `/opt/homebrew/opt/postgresql@17/bin`             | PostgreSQL 程序   |
| `POSTGRES_DATA_DIR`    | `/Volumes/MacOs/PostgreSQL/17/data`               | 数据目录         |
| `POSTGRES_LOG_DIR`     | `/Volumes/MacOs/PostgreSQL/17/log`                | 日志目录         |
| `POSTGRES_CONFIG_FILE` | `config/postgresql.local.conf`                    | 基础配置文件     |
| `POSTGRES_HOST`        | `127.0.0.1`                                      | 状态检测地址     |
| `POSTGRES_PORT`        | `5432`                                           | 本地监听端口     |

## 启停和日常使用

连接外置 SSD 后执行：

```bash
pnpm db:local:start
pnpm db:local:status
pnpm db:migrate
```

其他管理命令：

```bash
pnpm db:local:restart  # 修改配置后重启
pnpm db:local:logs     # 最近 100 行日志
pnpm db:local:stop     # 拔盘或关机前优雅停止

# 持续查看日志
bash scripts/shell/local-postgres.sh logs --follow
```

关机或拔出外置 SSD 前，也可以一次停止 PostgreSQL 和 Redis：

```bash
pnpm local:services:stop
```

脚本会检查外置卷、数据目录、配置文件和 PostgreSQL 程序。重复启动或停止是安全的；`status` 会输出实际数据目录、配置文件和日志文件。

## PostgreSQL 基础配置

项目配置针对 Apple M4、16GB 内存的本地开发环境：

| 配置                    | 值               | 说明                         |
| ----------------------- | ---------------- | ---------------------------- |
| `listen_addresses`      | `localhost`      | 不暴露到局域网或公网         |
| `max_connections`       | `100`            | 本地开发连接上限             |
| `shared_buffers`        | `512MB`          | PostgreSQL 共享缓存           |
| `effective_cache_size`  | `4GB`            | 查询规划器可用缓存估计       |
| `work_mem`              | `8MB`            | 单个排序/哈希节点内存上限    |
| `maintenance_work_mem`  | `256MB`          | VACUUM、建索引等维护操作内存 |
| `wal_compression`       | `on`             | 降低 WAL 写入量              |
| `password_encryption`   | `scram-sha-256`  | 密码认证算法                 |
| `timezone`              | `Asia/Shanghai`  | 数据库会话默认时区           |

`fsync` 和 `full_page_writes` 保持开启，不要为了本地性能关闭数据安全选项。修改 `config/postgresql.local.conf` 后执行 `pnpm db:local:restart`。

## 图形工具连接

DBeaver Community、pgAdmin 4 或 Drizzle Studio 均可连接：

```text
Host: 127.0.0.1
Port: 5432
Database: purechat
Username: purechat
Password: .env.local 中 DATABASE_URL 使用的密码
SSL: disable
```

打开项目自带的 Drizzle Studio：

```bash
pnpm db:studio
```

## 备份与恢复

创建压缩备份：

```bash
DATABASE_URL="$(node --env-file=.env.local -e 'process.stdout.write(process.env.DATABASE_URL)')"

/opt/homebrew/opt/postgresql@17/bin/pg_dump \
  --format=custom \
  --no-owner \
  --file=/Volumes/MacOs/PostgreSQL/17/backups/purechat-$(date +%Y%m%d-%H%M%S).dump \
  "$DATABASE_URL"

unset DATABASE_URL
```

备份目录与数据库位于同一块 SSD，只能用于迁移和短期回滚。重要备份还应复制到另一块磁盘或可信云存储。

## 常见故障

### 外置卷未挂载

```bash
mount | grep '/Volumes/MacOs'
```

确认磁盘名称没有变化。路径变化时，可以恢复卷名或通过 `POSTGRES_DATA_DIR`、`POSTGRES_LOG_DIR` 临时覆盖。

### 端口被占用

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
```

不要直接结束未知进程。先确认它是不是需要保留的 PostgreSQL 实例。

### 启动失败

```bash
pnpm db:local:logs
```

重点检查 SSD 是否挂载、目录权限、剩余空间、配置文件语法，以及 PostgreSQL 主版本是否与数据目录一致。
