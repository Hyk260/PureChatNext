---
title: 微信与 QQ AI 助手：同一个 Agent 多渠道接入
description: 了解 PureChat 如何把一个 AI Agent 连接到 Web、微信和 QQ，比较持久 Gateway 与 QQ Webhook 的部署要求、限制和验证步骤。
---

# 微信与 QQ AI 助手：同一个 Agent 多渠道接入

PureChatNext 让用户在 Web 工作台创建 Agent、选择模型，再把该 Agent 连接到微信或 QQ。渠道负责接收和发送消息；模型、搜索、文件能力与 Agent 配置由服务端共享。要使用微信或 QQ 长连接，必须部署在支持持久 Node.js 进程的环境。

## 适用场景

- 希望在日常使用的微信或 QQ 中调用自己配置的 Agent。
- 需要在 Web 工作台集中配置 Agent、模型与服务商凭证。
- 愿意部署和维护 PostgreSQL、正式域名及常驻 Gateway。
- 希望先使用 Web，再按平台规则逐步验证消息渠道。

如果只需要 Web 聊天，或不打算运行持久服务进程，可以先使用 Web 工作台；如果部署目标是 Vercel，只有 QQ Webhook 属于可用的 QQ 接入选项。

## 能力与部署方式

| 入口 | 工作方式 | 主要要求 |
| --- | --- | --- |
| Web | React SPA 连接同域 API | HTTPS、账号、数据库和模型凭证。 |
| 微信 iLink | Node Gateway 持续轮询并处理消息 | 持久 Node 进程、Gateway 开关、PostgreSQL 与加密密钥。会话过期时需要重新扫码。 |
| QQ 扫码 / WebSocket | Gateway 维护授权或平台长连接 | 持久 Node 进程；扫码授权阶段建议单实例。 |
| QQ Webhook | QQ 开放平台请求公开 HTTPS Route | 回调地址可公网访问，不能被登录保护、部署保护或防火墙拦截。 |

`app.purechat.cn` 按项目决策作为正式产品主站，需确认其运行环境已通过 Gateway 验收；`next.purechat.cn` 是 Vercel 备用站，只承接 Web 与 QQ Webhook。对自托管部署，能力由实际运行环境而非域名决定。

## 从配置到消息回复

1. 按[自托管部署指南](../platform/docker.md)准备数据库、HTTPS 与模型凭证。
2. 在 Web 工作台确认 Agent 和模型可以正常回复。
3. 按[渠道接入模式比较](../channels/overview.md)选择微信或 QQ 连接方式。
4. 完成平台授权或回调配置，查看绑定状态与服务端诊断日志。
5. 从实际微信/QQ 会话发送消息，并确认拿到 Agent 回复；只看到“已绑定”不等于端到端可用。

详细步骤见[微信 iLink 设置](../channels/wechat/setup.md)和[QQ 设置](../channels/qq/setup.md)。

## 费用与责任边界

PureChatNext 不会替部署者承担服务器、模型 API、数据库或对象存储成本。微信与 QQ 平台的授权、权限、回调和协议由上游平台控制；运行稳定性还依赖网络、进程重启策略、数据库状态和凭证管理。将第三方 Provider 接入 Agent 时，模型请求会按所选服务与配置处理，部署者需要向最终用户说明数据流。

## 常见问题

**微信机器人可以部署在 Vercel 吗？**

不能依赖 Vercel 维护持续轮询。使用微信需要把 Gateway 部署到支持常驻进程的主机或 Docker 环境。

**QQ Webhook 与 WebSocket 哪个更适合？**

选择取决于运行时和 QQ 平台配置。需要无状态 HTTPS 回调时使用 Webhook；需要长连接能力时用 WebSocket，并确保 Gateway 持续运行。

**切换到备用站后，所有渠道会自动接管吗？**

不会。备用站只支持 Web 与 QQ Webhook。账号与数据是否可共享还取决于数据库、加密密钥、对象存储和认证配置；完整故障切换需单独演练。

## 下一步

- [微信和 QQ 接入方式怎么选](../channels/overview.md)
- [自托管 AI 聊天工作台](./self-hosted-ai-chat.md)
- [微信 iLink 配置](../channels/wechat/setup.md)
- [QQ 机器人配置](../channels/qq/setup.md)
- [开始使用 PureChat](https://app.purechat.cn/?utm_source=docs&utm_medium=organic&utm_campaign=solution_pages&utm_content=wechat_qq_assistant)
- [GitHub 源码](https://github.com/Hyk260/PureChatNext)

> 本页根据仓库当前代码与配置指南于 2026-10-16 编写；正式宣传前先用目标账号验证渠道授权、消息收发和故障恢复。
