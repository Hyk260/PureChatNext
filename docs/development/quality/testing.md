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

## 本地测试账号

浏览器、curl 和后续端到端登录统一用下面账号。仅限本地开发，不要用于生产。本地没有对应用户时，先在 `http://localhost:5174/signup` 注册。

| 角色 | 邮箱 | 密码 |
| ---- | ---- | ---- |
| 普通用户 | `test@example.com` | `123456Qwer` |
| 管理员 | `admin@example.com` | `123456Qwer` |

密码需至少 8 位，且同时包含字母和数字。首个注册用户自动成为管理员；若普通账号已存在，注册 `admin@example.com` 后把 `users.role` 改为 `admin`。
