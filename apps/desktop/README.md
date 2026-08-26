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
pnpm dev:desktop:renderer
```

此模式下需另行启动兼容的 Next BFF。同时跑多份实例时，可用 `PURECHAT_DESKTOP_VITE_PORT` 覆盖渲染端口。

## 打包

```bash
pnpm --dir apps/desktop package:dir
pnpm --dir apps/desktop package:mac
pnpm --dir apps/desktop package:win
```

生产构建通过 `purechat://renderer` 协议加载打包后的渲染页。使用打包产物前，请在桌面进程环境中设置 `PURECHAT_DESKTOP_REMOTE_URL`，或通过桌面桥配置远程服务。打包后的 `/api` 请求由 Electron 主进程代理并复用会话 Cookie，不要求远程服务额外放行 `purechat://renderer` Origin。

OAuth PKCE、本地数据库、本地模型运行时与 MCP 进程管理刻意留作后续工作。当前桥只暴露安全边界，便于后续接入这些能力，而不把 Electron 引入 Web 应用。
