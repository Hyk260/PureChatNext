---
title: 微信 iLink 渠道
description: 在 PureChatNext 中配置微信 iLink 渠道、模型凭证和运行方式。
---

# 微信 iLink 渠道

微信渠道由 Next Node Server 内置 Channel Gateway 维护，不再运行独立进程。Gateway 长轮询 iLink，将完整批次回调到应用内部 Webhook；Webhook 在同一事务中写入事件队列并推进 cursor，4 个 processor 从 PostgreSQL 队列生成与分片发送回复。

## 部署支持

- 本地：默认关闭。在 `.env.local` 设置 `CHANNEL_GATEWAY_ENABLED=1`，然后正常运行 `pnpm dev`。
- Docker：生产 Compose 已显式开启，单一 `app` 容器同时运行 Next 与 Gateway。
- Vercel：不支持持久连接；设置页保留入口但禁用扫码和绑定。

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
