---
title: 测试范围
description: 哪些代码需要测试，哪些简单页面不要写测试。
---

# 测试范围

测试用来锁住**会出错的逻辑**，不是给每个 `.tsx` 凑覆盖率。简单页面和薄封装写测试收益低：mock 掉 UI / session 后只剩「pending 出骨架、无用户跳登录、有用户渲染 children」，改一句文案或换个 fallback 就要重写。

细则与文件组织见仓库根目录 [AGENTS.md](../../../AGENTS.md) 的「测试与验证」。

## 不要写

- 静态页、布局壳、404 / 403 / StatusPage 这类只负责展示的页面。
- 路由 gate 的 JSX 分支（loading skeleton、`Navigate`、children）。例如 `RequireAuth`、`RequireAdmin`。
- 把 `@pure/ui` 整包 mock 掉，再断言文案、`data-testid` 或「渲染了 children」。

角色判断、回调 URL、API 鉴权等抽成 helper 或服务端入口后再测那些函数，不要测外包的页面壳。

## 要写

- 纯函数 / helper（如 `isAdminRole`、`resolveCallbackUrl`）。
- API 与鉴权边界（如 `withAdmin`、route handler）。
- 有状态、副作用或用户交互的逻辑（store、fetch、表单校验、错误边界分流）。

## Playwright 端到端冒烟测试

Web 与 Electron 的用例位于 `tests/e2e/smoke/`，共用根目录 `playwright.config.ts`。使用真实页面、表单与桌面 IPC，不 mock UI；根 Vitest 配置继续排除 `e2e`，两种测试独立运行。

首次运行先安装依赖和 Chromium（同时安装视频录制所需的 FFmpeg）：

```bash
pnpm install
pnpm exec playwright install chromium
```

桌面测试复用 `apps/desktop` 安装的 Electron。默认验收平台为 macOS；Linux 运行 Electron 需要可用的图形环境（如 Xvfb），Chromium 的系统依赖可通过 `pnpm exec playwright install --with-deps chromium` 安装。

```bash
pnpm test:e2e                      # Web 与 Electron
pnpm test:e2e --project=web        # 只执行 Web 用例
pnpm test:e2e --project=electron   # 只执行 Electron 用例
pnpm test:e2e --project=web --headed
pnpm test:e2e --project=electron --debug
pnpm test:e2e:ui                   # 交互式调试
pnpm test:e2e:report               # 打开 HTML 报告
```

运行器管理两个服务，筛选项目只筛选用例，仍会准备两个服务：

- Web 启动或复用 `http://localhost:5174` 的 Vite SPA，不启动 Next BFF。
- 桌面端先运行 `pnpm build:desktop`，再用测试专用 Vite preview 在 `http://127.0.0.1:5176` 提供构建后的渲染产物；Playwright 负责启动真实 Electron。`5176` 必须空闲，不复用日常桌面开发服务。
- 服务启动最多等待 5 分钟；单个用例最多 60 秒。所有用例串行执行，本地不重试；CI 环境禁止 `test.only` 并重试两次。本次未接入 GitHub Actions。

`5176` 已有桌面开发进程时，可用现有 `ELECTRON_RENDERER_URL` 指定其他本地端口，例如 `ELECTRON_RENDERER_URL=http://127.0.0.1:5186 pnpm test:e2e`。渲染页地址须使用 `http://127.0.0.1:<端口>`，与桌面 IPC 的来源限制一致。

Web fixture 在页面导航前固定匿名 session 与认证配置，并阻止其他 API 请求访问真实 BFF。两端也阻止浏览器请求外部 CDN 资源，字体使用本机回退，避免外部字体下载影响运行和失败截图。首批覆盖匿名访问聊天后的回调地址、登录标识校验和注册链接导航，不使用真实账号，也不发送邮件或调用模型。

Electron 每个用例创建独立临时数据目录，启动时清空远程服务和更新源，屏蔽系统协议注册与打开外部浏览器；退出后清理配置、日志及会话数据。首批覆盖未登录窗口启动、服务地址输入和真实 preload/IPC 配置读写，不进行浏览器授权。

HTML 报告位于 `playwright-report/`，失败的截图、视频与 trace 位于 `test-results/`，这些目录均被 Git 忽略。Electron fixture 显式采集并附加失败产物；可在报告中打开 trace，或使用 `pnpm exec playwright show-trace <trace.zip>`。成功用例不保留诊断产物。

这些隔离冒烟测试不验证真实 BFF、数据库、服务登录、聊天回复或安装包。后续集成测试若使用本地账号，仍须遵守下面的账号与邮件限制。

## 本地测试账号

浏览器、curl 和后续端到端登录统一用下面账号。仅限本地开发，不要用于生产。本地没有对应用户时，可在 `http://localhost:5174/signup` 注册；若启用了邮箱验证，则通过管理员创建或本地预置为已验证账号。

| 角色 | 邮箱 | 密码 |
| ---- | ---- | ---- |
| 普通用户 | `test@example.com` | `123456Qwer` |
| 管理员 | `admin@example.com` | `123456Qwer` |

密码需至少 8 位，且同时包含字母和数字。首个注册用户自动成为管理员；若普通账号已存在，注册 `admin@example.com` 后把 `users.role` 改为 `admin`。

`test@example.com` 和 `admin@example.com` 使用 RFC 保留的测试域名，不是真实收件箱。测试这些账号时禁止调用发送验证码、验证邮件、魔法链接或重置密码邮件的接口，也不要进入会自动触发发码的邮箱验证流程；需要测试邮箱验证逻辑时，改用可控的测试邮箱或邮件服务。管理员创建的测试账号直接视为已验证（`email_verified = true`）。
