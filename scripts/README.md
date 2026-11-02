# 脚本分类

优先通过根目录 `package.json` 的 pnpm 命令运行脚本；已有命令名称保持不变。

| 目录 | 职责 | 常用命令 |
| --- | --- | --- |
| `web/` | Web 开发启动、生产预览、SPA 产物复制及环境边界检查 | `pnpm dev`、`pnpm preview:prod`、`pnpm build:spa:copy` |
| `electron/` | Electron 开发启动、本地更新服务、COS 发行同步及进程工具 | `pnpm dev:desktop`、`pnpm dev:desktop:update-server`、`pnpm desktop:upload`；见[桌面端发布说明](electron/README.md) |
| `community/` | 社区 agent 和 skill 同步 | `pnpm agents:sync`、`pnpm skills:sync` |
| `lib/` | 数据库和环境加载等共享脚本工具 | 由调用脚本使用 |
| 根目录 | Docker、数据库、渠道、缓存清理和通用质量检查 | 按 `package.json` 对应命令运行 |

Electron 包自身的打包校验 hook 保留在 `apps/desktop/scripts/`。更新服务默认提供真实发布文件，模拟下载需显式使用 `--mode development`，详见 [桌面开发与更新说明](../apps/desktop/README.md)。

## 环境配置初始化

```bash
pnpm env:setup                           # 从 .env.example 创建 .env，或补全现有 .env
pnpm env:setup --file .env.local          # 补全本地覆盖文件
pnpm env:setup --file .env.production.local
pnpm env:setup --help
```

`env.mts` 自动生成 `AUTH_SECRET`、`KEY_VAULTS_SECRET`、`TOOL_APPROVAL_SECRET`、`CRON_SECRET` 与 RSA `JWKS_KEY`，保留所有非空配置。缺失字段会先复用 shell / CI 及其他根环境文件中的值。默认补上本地 `APP_URL` 与 `DATABASE_DRIVER=neon`，数据库连接和第三方服务凭据需自行填写。

文件权限设为 `0600`，终端不打印密钥；排他锁和原子写入避免并行初始化覆盖密钥。相对 `--file` 路径以仓库根目录为基准，目标文件名限定为 Git 忽略的 `.env`、`.env.local` 或 `.env.<环境>.local`。

此命令用于首次部署与配置补全，不能用于恢复丢失的旧密钥或轮换密钥。请备份配置文件，并在复用旧数据库或多实例部署时使用同一组密钥。完整说明见[环境变量配置](../docs/self-hosting/configuration/environment.md)。
