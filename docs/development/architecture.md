---
title: PureChatNext 技术架构：Vite SPA、Next.js BFF 与 AI SDK
description: 了解 PureChatNext 如何用 React 19、Vite、React Router、Next.js API、Vercel AI SDK、PostgreSQL 和常驻 Channel Gateway 组成一套多渠道 AI 工作台。
---

# PureChatNext 技术架构：Vite SPA、Next.js BFF 与 AI SDK

PureChatNext 把业务页面和服务端 API 分开：React 19、Vite 与 React Router 驱动 Web SPA；Next.js 负责 API、认证、BFF 和生产 HTML 壳；聊天生成使用 Vercel AI SDK；微信轮询与 QQ WebSocket 由持久 Node.js 进程中的 Channel Gateway 管理。

## 请求路径

```text
浏览器 / 微信 / QQ
        │
        ├── Web UI ── Vite SPA（React Router）
        │                  │
        ├── 微信 Gateway ──┤
        └── QQ Webhook / Gateway
                           ▼
                   Next.js API / Auth / BFF
                           │
          Agent / Provider / Search / File loaders
                           │
                  PostgreSQL / 对象存储
```

Web 页面日常开发走 Vite；请求 `/api` 由 Vite 代理给本地 Next 服务。生产环境仍由 Next 返回注入服务端配置的 SPA HTML 壳，并提供同域 API 和认证入口。业务页面不应该迁移到 Next 页面路由。

## 主要模块

| 模块 | 职责 | 源码入口 |
| --- | --- | --- |
| Vite SPA | 认证后的工作台、设置、Community 与聊天界面 | [`src/spa/entry.web.tsx`](../../src/spa/entry.web.tsx)、[`src/routes/`](../../src/routes/) |
| Next.js BFF | API、认证、生产 SPA HTML、Webhook 和服务端配置 | [`src/app/api/`](../../src/app/api/)、[`src/app/spa/`](../../src/app/spa/) |
| Chat API | 校验聊天请求、解析附件、创建模型流并处理结果 | [`src/app/api/chat/route.ts`](../../src/app/api/chat/route.ts) |
| 模型与工具 | Provider、Agent、联网搜索、文件读取和用量能力 | [`src/server/chat/`](../../src/server/chat/) |
| Channel Gateway | 在持久 Node 进程中维护微信轮询与 QQ WebSocket；QQ Webhook 也可由无状态 Route 接收 | [`src/server/channel-gateway/`](../../src/server/channel-gateway/) |
| 共享 workspace packages | 数据库、模型目录、文件加载器、类型和工具 | [`packages/`](../../packages/) |

## 一条聊天请求经过什么

1. React SPA 收集消息、附件、Agent 和模型选择，并请求同域 `/api/chat`。
2. Next API 解析身份和聊天上下文，按 Provider 创建 Vercel AI SDK 流。
3. 文件附件由 `@pure/file-loaders` 提取文本；图片则要求所选模型支持视觉输入。
4. 搜索、文件读取等工具由服务端工具注册表提供；聊天与用量数据按当前数据库模型写入。
5. Web、微信和 QQ 入口最终复用同一套 Agent、Provider 和服务端聊天能力；渠道只负责接收与回复消息。

## 为什么 Gateway 不放在 Serverless 函数中

微信 iLink 依赖持续轮询，QQ WebSocket 依赖长连接、心跳和进程状态；这些模式需要常驻 Node.js 运行时。QQ Webhook 是平台调用 HTTPS Route 的方式，适合短生命周期部署，但不能替代长连接。自托管可以使用 Docker；Vercel 备用站仅承接 Web 工作台和 QQ Webhook。

这个取舍增加了自托管部署、数据库状态和健康检查的复杂度。选择 Webhook-only 的部署时，应在产品说明里明确可用范围；需要微信或 QQ 长连接时，必须验证目标主机的持续进程能力。

## 本地开发

在仓库根目录执行：

```bash
pnpm install
pnpm dev
```

本地 Web 入口是 `http://localhost:5174`，Next BFF 默认在 `http://localhost:3000`。只调前端可运行 `pnpm dev:spa`，只调服务端可运行 `pnpm dev:next`。首次启动和环境配置见[快速开始](../getting-started/quick-start.md)与[环境变量配置](../self-hosting/configuration/environment.md)。

## 适合什么项目

这种架构适合需要复用 Agent、模型、文件和搜索能力，同时提供 Web 与消息渠道入口的应用。若目标只是单页聊天 Demo，可以减少服务端与持久 Gateway 的复杂度；微信、QQ 长连接、自托管与多用户身份会带来数据库、密钥管理、网络和运维责任。

## 继续了解

- [自托管 AI 聊天解决方案](../self-hosting/solutions/self-hosted-ai-chat.md)
- [微信与 QQ 渠道接入指南](../self-hosting/channels/overview.md)
- [开发指南](./README.md)
- [GitHub 仓库](https://github.com/Hyk260/PureChatNext)

> 架构说明按仓库当前代码于 2026-10-16 编写。部署形态和渠道限制可能随代码与上游平台变化，使用前请以对应配置指南为准。
