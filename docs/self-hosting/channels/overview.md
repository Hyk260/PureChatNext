---
title: 微信和 QQ AI 助手接入方式怎么选
description: 对比 PureChatNext 微信 iLink、QQ 扫码、WebSocket 与 Webhook 的运行要求，按服务器环境选择接入方式并完成消息验证。
---

# 微信和 QQ AI 助手接入方式怎么选

如果要让同一个 PureChat Agent 从微信或 QQ 收消息，先按渠道和服务器运行时选连接方式：微信需要持续运行的 Node.js Gateway；QQ 可使用扫码、WebSocket 或 Webhook。Vercel 备用站只适合 Web 工作台与 QQ Webhook，不承接微信长轮询、QQ 扫码或 WebSocket。

## 先看运行环境

| 渠道 / 方式 | 需要持续运行的进程 | 适用环境 | 说明 |
| --- | --- | --- | --- |
| 微信 iLink | 是 | Docker、持久 Node.js 主机、本地开发 | Gateway 持续轮询；会话失效时需要重新扫码。 |
| QQ 扫码 | 是 | 本地或单实例 Docker | 授权会话暂存在发起授权的 Node.js 进程中，绑定期间不要重启或切换实例。 |
| QQ WebSocket | 是 | 持久 Node.js 主机、Docker | 使用平台机器人凭证建立长连接，以心跳判断在线状态。 |
| QQ Webhook | 否 | 可访问的 HTTPS 部署，包括 Vercel | QQ 平台回调 PureChat 的公开地址；部署保护不能拦截回调。 |

如果部署环境只提供短生命周期函数，选 QQ Webhook；如果要完整使用微信或 QQ 长连接，选支持常驻 Node.js 进程的部署，并确认单实例/多实例策略、数据库和密钥配置。

## 所有渠道共用的准备工作

1. 准备一个能正常回复的 PureChat Agent 和可用模型凭证。第三方模型调用会按对应服务商的当前套餐计费。
2. 完成 PostgreSQL 配置和当前版本迁移；微信、QQ 凭证加密需要配置 `KEY_VAULTS_SECRET`。
3. 使用 Gateway 的部署设置 `CHANNEL_GATEWAY_ENABLED=1`，确保应用进程在后台持续运行。Webhook 模式不需要开启 Gateway。
4. 先从 Web 工作台确认 Agent 可正常回复，再绑定消息渠道；这样可以分辨模型配置故障与渠道连接故障。

生产 Docker 环境和变量见 [Docker 自托管](../platform/docker.md) 与[环境变量配置](../configuration/environment.md)。

## 微信连接步骤

1. 在支持 Gateway 的部署打开设置中的「聊天平台 → 微信」。
2. 选择 Agent、服务商与模型，确认账号已保存对应凭证。
3. 扫码授权，等页面显示 Gateway 正常后，从微信发送一条普通文本。
4. 收到所选 Agent 的回复后，微信渠道才算完成端到端验证。

详细配置和错误排查见[微信 iLink 渠道设置](./wechat/setup.md)。Vercel 备用站不能运行微信持续轮询。

## QQ 连接步骤

1. 在 QQ 开放平台准备机器人凭证，并确认回调/网络策略符合所选接入模式。
2. 在设置中的「聊天平台 → QQ」选择扫码、手动 WebSocket 或 URL 回调。
3. Webhook 需要把设置页提供的 HTTPS 地址填入 QQ 开放平台；扫码和 WebSocket 需要持久 Gateway。
4. 检查绑定状态，再从 QQ 发送消息并确认机器人回复。

详细配置、Webhook 验证和诊断见 [QQ 渠道设置](./qq/setup.md)。

## 常见问题

**为什么 Vercel 能用 QQ Webhook，却不能用扫码或 WebSocket？**

Webhook 是 QQ 平台请求一个 HTTPS Route；扫码和 WebSocket 需要授权会话或长连接在进程间持续存活。短生命周期运行时不能保证这些进程状态。

**绑定成功但没有 AI 回复，需要重新扫码吗？**

通常不需要。先在 Web 工作台确认 Agent、模型和凭证有效，再检查渠道诊断日志。只有页面提示会话过期或需要重新连接时，才重新授权。

**多实例部署可以直接扫码吗？**

首次授权期间请求可能被路由到不同实例，因此扫码流程建议使用单实例。绑定完成后的 Gateway 协调依赖数据库租约；上线前仍要按实际部署验证恢复和故障切换。

## 下一步

- [微信 iLink 设置与排错](./wechat/setup.md)
- [QQ 扫码、WebSocket 与 Webhook 设置](./qq/setup.md)
- [微信与 QQ AI 助手解决方案](../solutions/wechat-qq-ai-assistant.md)
- [体验 PureChat Web 工作台](https://app.purechat.cn/?utm_source=docs&utm_medium=organic&utm_campaign=solution_pages&utm_content=channel_selection)
- [PureChatNext 源码](https://github.com/Hyk260/PureChatNext)

> 本页按仓库当前代码和文档于 2026-10-16 编写。上游微信、QQ 平台接口和运行环境可能变化；部署前请在目标环境完成扫码、回调与实聊验证。
