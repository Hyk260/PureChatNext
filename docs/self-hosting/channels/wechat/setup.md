---
title: PureChatNext 微信 AI 机器人配置教程
description: 配置 PureChatNext 微信 iLink 机器人：检查持久在线 Gateway、选择 Agent 和模型、扫码绑定并验证消息收发。
---

# PureChatNext 微信 AI 机器人配置教程

微信渠道由 Next Node Server 内置 Channel Gateway 维护，不再运行独立进程。Gateway 长轮询 iLink，将完整批次回调到应用内部 Webhook；Webhook 在同一事务中写入事件队列并推进 cursor，4 个 processor 从 PostgreSQL 队列生成与分片发送回复。

## 前置条件

- 部署必须能运行持续的 Node.js 进程，并允许 Gateway 后台轮询；Vercel 备用站不支持微信连接。Docker Compose 生产配置已开启 Gateway。
- PostgreSQL 已完成当前版本迁移，并设置 `KEY_VAULTS_SECRET`。Gateway 可用时设置 `CHANNEL_GATEWAY_ENABLED=1`；本地开发默认关闭。
- PureChatNext 中至少有一个可用 Agent。选择 PureChat、OpenAI 或 DeepSeek 模型；使用 OpenAI / DeepSeek 时，先在账号的服务商设置中保存对应 API Key。第三方模型费用由对应服务商按其当前套餐结算。

## 扫码绑定和验证

1. 登录支持 Gateway 的 PureChatNext 部署，打开 `/settings/messenger/wechat`（设置 → 聊天平台 → 微信）。
2. 选择要接收消息的 Agent，并选择服务商与模型。确认该账号已具备所选服务商的可用凭证。
3. 点击页面右上角「连接」，使用手机微信打开「扫一扫」，扫描页面二维码并确认授权。
4. 页面显示「微信 Gateway 正常」后，在手机微信中打开机器人私聊并发送一条普通文本。收到所选 Agent 的回复，即完成端到端验收。
5. 如果状态停留在启动中，等待首次轮询；若显示「需要重新连接微信」，重新扫码。错误详情可通过「连接微信」标题旁的日志图标查看。

成功的判定分两层：`/api/health` 返回 HTTP 200 代表应用及已配置依赖基本可用；页面显示 Gateway 正常且实聊有回复，才代表微信授权、轮询、模型调用与消息发送均已打通。

## 常见失败排查

| 现象 | 先检查 | 处理方式 |
| --- | --- | --- |
| 页面提示当前部署不支持微信 Gateway | 是否部署在 Vercel，或 `CHANNEL_GATEWAY_ENABLED` 是否关闭 | 将渠道放到支持持久 Node.js 进程的主站 / Docker 部署，并启用 Gateway；Vercel 备用站不能承接微信轮询。 |
| 扫码失败或很快过期 | 二维码是否仍有效、服务端日志中的授权错误 | 关闭旧二维码后重新点「连接」扫码；反复过期时检查服务器到 iLink 的出站网络与系统时间。 |
| 已授权但一直显示启动中 / 离线 | `/api/health` 的 `gateway` 与数据库状态、应用启动日志 | 确认进程持续运行、数据库可写、`KEY_VAULTS_SECRET` 已设置，并检查服务端是否能访问 iLink。修复环境变量后重建或重启应用。 |
| 已连接但没有 AI 回复 | 页面选中的 Agent、服务商 / 模型及该用户的模型凭证 | 先在 Web 工作台确认 Agent 可正常回复，再检查服务商额度和诊断日志中的模型错误。模型凭证问题与微信授权状态是两类问题。 |

> 配置与状态文案已于 2026-10-16 对照仓库源码核对；请用目标部署实测扫码和收发消息。部署命令见 [Docker 自托管](../../platform/docker.md)，环境变量见[配置指南](../../configuration/environment.md)。

## 部署支持

- 主站 `app.purechat.cn`：应部署在支持持久 Node.js 进程的运行环境，并启用 `CHANNEL_GATEWAY_ENABLED=1`；Docker Compose 已显式开启，单一 `app` 容器同时运行 Next 与 Gateway。
- Vercel 备用站 `next.purechat.cn`：不支持持久连接；设置页保留入口但禁用微信扫码和 Gateway 绑定。它可用于访问 Web 工作台，不能替代主站的微信渠道运行时。
- 本地：默认关闭。在 `.env.local` 设置 `CHANNEL_GATEWAY_ENABLED=1`，然后正常运行 `pnpm dev`。

## 必需配置

```dotenv
CHANNEL_GATEWAY_ENABLED=1
DATABASE_URL=postgresql://...
KEY_VAULTS_SECRET=replace-with-a-random-secret
```

微信回复使用账号在设置页保存的 OpenAI / DeepSeek 密钥（AES-GCM 加密入库），不读取服务端 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`。`purechat` 仍走官方积分与 AI Gateway。

可选配置：

| 变量 | 用途 |
| --- | --- |
| `CHANNEL_GATEWAY_INTERNAL_URL` | 内部回调地址；默认 `http://127.0.0.1:$PORT` |
| `CHANNEL_GATEWAY_INTERNAL_SECRET` | 内部 Webhook 鉴权密钥，生产建议显式设置 |

入站消息日志通过 `DEBUG=channel:wechat:webhook`（或 `channel:wechat:*`）开启，不再单独设置环境变量。

兼容周期内仍读取 `WECHAT_GATEWAY_ENABLED` 和 `WECHAT_WEBHOOK_SECRET`，但新配置应使用统一变量。

## 运行与恢复

每个绑定持有 PostgreSQL Gateway lease（90 秒 TTL、30 秒续租）。多实例只有租约持有者建立连接；实例停止后，其他实例会在租约过期后接管。Webhook 失败不会推进 cursor，Poller 会重试同一批次。会话过期时绑定进入 `needs_rebind`，需重新扫码。

健康检查 `/api/health` 只显示平台级计数，不返回 binding ID。单绑定异常显示 `degraded`；数据库或 Gateway 核心启动失败返回 `503 unhealthy`。

## 诊断日志

在「连接微信」标题右侧点击日志图标查看服务端诊断。未绑定、离线或当前部署不支持常驻 Gateway 时仍可打开历史记录。弹框每 5 秒刷新，关闭或页面隐藏时暂停；远程服务或数据库不可用时显示读取失败，并保留手动刷新入口。

Web 与 Electron 共用 PostgreSQL 中按账号和平台隔离的记录，桌面端通过现有远程协议代理读取，不缓存到本地文件。记录保留最近 7 天、最多 200 条，断开或重新绑定后保留到期。仅记录启动、上线、恢复、断线、重试、租约丢失、授权过期以及回调、模型处理和发送失败；成功心跳、空轮询、聊天正文及凭据均不保存。相同错误一分钟内去重，恢复后的异常重新记录。

部署前运行 `pnpm db:migrate` 应用 `0033_goofy_deathstrike.sql`。日志写入及清理失败不影响原有业务；查询不会启动 Gateway，且始终过滤七天以前的记录。

## 常见问题

**微信渠道能运行在 Vercel 备用站吗？** 不能。微信需要持续轮询进程；请在 `app.purechat.cn` 对应的持久 Node.js / Docker 主站连接。

**微信显示已绑定，但模型报错是否需要重新扫码？** 通常不需要。先检查当前 Agent 的服务商、模型和用户凭证；只有页面提示会话过期或「需要重新连接」时才重新扫码。

## 继续了解

- [Docker 自托管](../../platform/docker.md) · [微信渠道协议](./protocol.md) · [环境变量配置](../../configuration/environment.md)
- [体验 PureChat](https://app.purechat.cn/?utm_source=docs&utm_medium=organic&utm_campaign=self_hosting_guide&utm_content=wechat) · [GitHub 源码](https://github.com/Hyk260/PureChatNext)
