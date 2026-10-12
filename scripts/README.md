# 脚本分类

优先通过根目录 `package.json` 的 pnpm 命令运行脚本；已有命令名称保持不变。

| 目录 | 职责 | 常用命令 |
| --- | --- | --- |
| `web/` | Web 开发启动、生产预览、SPA 产物复制及环境边界检查 | `pnpm dev`、`pnpm preview:prod`、`pnpm build:spa:copy` |
| `electron/` | Electron 开发启动、本地更新服务及专用进程工具 | `pnpm dev:desktop`、`pnpm dev:desktop:update-server` |
| `community/` | 社区 agent 和 skill 同步 | `pnpm agents:sync`、`pnpm skills:sync` |
| `lib/` | 数据库和环境加载等共享脚本工具 | 由调用脚本使用 |
| 根目录 | Docker、数据库、渠道、缓存清理和通用质量检查 | 按 `package.json` 对应命令运行 |

Electron 包自身的打包校验 hook 保留在 `apps/desktop/scripts/`。更新服务默认提供真实发布文件，模拟下载需显式使用 `--mode development`，详见 [桌面开发与更新说明](../apps/desktop/README.md)。
