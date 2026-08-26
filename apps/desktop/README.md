# PureChat Desktop

本包是现有 Vite SPA 的 Electron 壳。路由与业务 UI 仍以 Web 应用为准。

## 开发

启动完整桌面开发环境：

```bash
pnpm dev:desktop
```

该命令会复用或启动共享 Next BFF（端口 `3000`），再启动 Electron 渲染进程（`http://127.0.0.1:5176`）。桌面渲染端口与浏览器 SPA 端口 `5174` 分开，避免冲突。渲染进程只监听 `127.0.0.1`，不会打印 `localhost` 地址。

若只启动 Electron 进程：

```bash
pnpm --filter purechat-desktop dev
```

此模式下需另行启动兼容的 Next BFF。同时跑多份实例时，可用 `PURECHAT_DESKTOP_VITE_PORT` 覆盖渲染端口。

## 构建与打包

```bash
pnpm build:desktop
pnpm package:desktop
pnpm package:desktop:mac
pnpm package:desktop:win
```

`build:desktop` 只编译主进程、preload 和渲染页。`package:desktop` 会再打出当前平台的未打包目录；macOS / Windows 安装包分别用 `package:desktop:mac` 和 `package:desktop:win`。

生产构建通过 `purechat://renderer` 协议加载打包后的渲染页。首次启动可在界面配置服务地址；开发调试也可使用桌面进程环境变量 `PURECHAT_DESKTOP_REMOTE_URL`。打包后的 `/api` 请求由 Electron 主进程通过 session 代理，保留现有移除浏览器来源头的兼容行为。该行为不等于完整的桌面认证方案；Cookie、OAuth 和重启恢复需要安装包端到端验收。

打包会自动检查 ASAR：只允许应用 manifest 和构建产物，拒绝 `node_modules`、环境文件、sourcemap 和缺失入口，归档预算为 64 MiB（不含 Electron Framework）。未来引入外置原生依赖时必须同步调整精确白名单和验证，不要直接关闭检查。

```bash
pnpm --filter purechat-desktop test
pnpm exec eslint apps/desktop/src/ apps/desktop/scripts/
pnpm --filter purechat-desktop typecheck
```

OAuth PKCE、本地数据库、本地模型运行时与 MCP 进程管理刻意留作后续工作。当前桥只暴露安全边界，便于后续接入这些能力，而不把 Electron 引入 Web 应用。
