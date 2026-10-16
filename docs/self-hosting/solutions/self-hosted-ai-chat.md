---
title: 自托管 AI 聊天工作台：部署、数据与运行成本
description: 了解 PureChat 自托管 AI 聊天工作台提供的多模型、Agent、搜索、文件和消息渠道能力，以及部署前必须准备的数据库、模型密钥与对象存储。
---

# 自托管 AI 聊天工作台：部署、数据与运行成本

PureChatNext 是一套可自托管的 AI 工作台，适合希望自己管理用户、Agent、模型凭证、数据库和文件存储，并计划从 Web 扩展到微信或 QQ 的开发者与小团队。自托管不代表没有费用：服务器、数据库、对象存储和模型调用由部署者选择并承担。

## PureChat 能做什么

- 在 Web 工作台管理 Agent、Provider 和聊天记录。
- 使用可配置的模型服务，并为不同任务选择 Agent 与模型。
- 配置联网搜索和网页抓取能力。
- 在聊天中读取 PDF、Word、Excel、PowerPoint、文本和图片；文件解析范围见[文件处理指南](../features/file-processing.md)。
- 按部署运行时接入微信 iLink、QQ 扫码、WebSocket 或 Webhook。

微信和 QQ 入口会复用同一套 Agent 和服务端能力，不需要分别部署两套模型业务。对应的连接要求见[多渠道方案](./wechat-qq-ai-assistant.md)。

## 部署前需要准备

| 资源 | 是否必需 | 用途 |
| --- | --- | --- |
| Docker Compose v2 或支持 Node.js 的主机 | 需要其一 | 运行应用；微信和 QQ 长连接要求持久 Node 进程。 |
| PostgreSQL | 必需 | 保存账号、Agent、配置和业务数据。 |
| 至少一个模型 Provider 凭证 | 必需 | 产生 AI 回复；费用由对应服务商按其套餐结算。 |
| HTTPS 域名 | 生产部署必需 | 登录 Cookie、外部渠道回调与浏览器安全上下文。 |
| S3 兼容对象存储 | 使用上传附件时需要 | 保存用户上传的文件。 |
| Redis / 在线搜索 Provider | 可选 | 按需启用缓存/任务或联网搜索能力。 |

## 运行环境决定渠道能力

| 部署方式 | Web | 微信 Gateway | QQ 扫码 / WebSocket | QQ Webhook |
| --- | --- | --- | --- | --- |
| 持久 Node.js / Docker | 支持 | 可启用并实测 | 可启用并实测 | 支持 |
| Vercel 备用站 | 支持 | 不支持持久轮询 | 不支持 | 支持，需公网 HTTPS 回调 |

不能只看域名判断功能。微信或 QQ 长连接需要应用实际运行在持久进程并启用 Gateway；多实例、进程恢复和数据库租约也需要按目标部署验证。

## 从哪里开始

1. 阅读 [Docker 自托管](../platform/docker.md)，准备 PostgreSQL、正式域名和模型凭证。
2. 按实际功能配置[环境变量](../configuration/environment.md)；未使用的 Redis、对象存储或搜索可选依赖不必臆测为必需。
3. 配置应用 HTTPS，运行数据库迁移并通过 `/api/health` 检查。
4. 先从 Web 工作台验证模型回复，再按[渠道接入指南](../channels/overview.md)连接微信或 QQ。
5. 为生产环境建立 PostgreSQL 与对象存储备份，并在升级前确认迁移与回滚方案。

## 适合与不适合的场景

适合需要控制部署环境、希望复用同一 Agent 接入 Web 与消息渠道、愿意负责服务运维的个人开发者和小团队。若只想注册后立即使用托管聊天、没有维护数据库和模型凭证的意愿，托管型聊天产品会更省事。若必须依赖完整微信/QQ 长连接，不应把 Vercel 备用站当作主部署。

## 常见问题

**自托管后模型调用免费吗？**

不保证。模型供应商会按当前价格、套餐和用量计费；服务器、数据库与对象存储也可能产生费用。

**聊天内容只留在自己的服务器吗？**

数据库和对象存储由实例运营者配置；当你选择第三方模型或搜索服务时，请求所需内容可能会发送给该服务商。部署者应阅读对应服务的隐私条款并向用户说明数据流。

**可以直接在 Vercel 上运行完整渠道吗？**

不可以。Vercel 备用站可提供 Web 和 QQ Webhook，但不能维持微信轮询或 QQ 长连接。

## 开始体验或部署

- [Docker 自托管完整步骤](../platform/docker.md)
- [微信和 QQ 连接模式比较](../channels/overview.md)
- [打开 PureChat Web 工作台](https://app.purechat.cn/?utm_source=docs&utm_medium=organic&utm_campaign=solution_pages&utm_content=self_hosted_ai_chat)
- [查看 GitHub 源码](https://github.com/Hyk260/PureChatNext)

> 部署要求和能力边界按仓库当前文档与源码于 2026-10-16 核对；请在自己的主机、数据库和模型账号上完成验收后再开放服务。
