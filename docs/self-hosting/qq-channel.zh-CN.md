# QQ 机器人渠道

QQ 支持三种连接方式：

- 扫码绑定（推荐）：手机 QQ 确认后自动取得机器人凭证，并使用 WebSocket Gateway 连接。
- WebSocket：由 Next Node Server 内置 Channel Gateway 维护，READY 后上线，心跳 ACK 刷新在线状态。
- Webhook：QQ 开放平台直接调用无状态 Route，由平台验证流程处理，不占用 Gateway lease。

## 部署支持

- 本地 WebSocket：设置 `CHANNEL_GATEWAY_ENABLED=1` 后正常运行 `pnpm dev`。
- Docker：生产 Compose 已开启，WebSocket 随单一 `app` 容器启动。
- Vercel：仅支持 Webhook；UI 与服务端都会拒绝创建或切换到 WebSocket。

扫码由腾讯官方 `@tencent-connect/qqbot-connector@1.2.0` 提供。扫码会话和机器人 Secret 仅保存在当前 Node.js 进程内，成功后凭证沿用现有加密存储。因此首版只支持单实例本地或 Docker 部署，不支持多副本路由漂移、Serverless 或跨进程续接。二维码关闭、重开和超时会取消当前进程中的轮询。

该 npm 包当前声明为 `UNLICENSED`，授权页默认将接入方显示为“第三方机器人”。如需展示 PureChatNext 品牌或确认商务授权，请联系 `qq_bot_api@tencent.com`。

不再运行 `qq-gateway.ts`。WebSocket 入站事件会按序转发到内部 `/api/channels/qq/webhook/:appId`，有限重试后仍失败则仅将该绑定标记为 degraded。WebSocket 绑定必须携带内部 Bearer 密钥；省略 Authorization 不会降级成外部 Webhook。

## 配置

```dotenv
CHANNEL_GATEWAY_ENABLED=1
CHANNEL_GATEWAY_INTERNAL_SECRET=replace-with-a-random-secret
DATABASE_URL=postgresql://...
KEY_VAULTS_SECRET=replace-with-a-random-secret
```

`CHANNEL_GATEWAY_INTERNAL_URL` 可覆盖内部回调地址。兼容周期内仍读取 `QQ_WEBHOOK_SECRET`，统一密钥优先。Webhook 模式无需启用 Gateway；保存绑定后把设置页显示的回调地址配置到 QQ 开放平台。

入站消息日志通过 `DEBUG=channel:qq:webhook`（或 `channel:qq:*`）开启。

设置页点击“连接”后可以选择扫码、手动 WebSocket 或 URL 回调。未启用 Gateway 时，扫码和 WebSocket 会禁用，但 URL 回调仍可配置。

## 状态判断

WebSocket 的 `connected` 依据 90 秒内的真实心跳，不再仅依据绑定是否存在。状态接口同时返回 `gatewaySupported`、`runtimeStatus`、`lastHeartbeatAt` 与脱敏错误摘要。Webhook 模式按有效绑定报告连接状态。
