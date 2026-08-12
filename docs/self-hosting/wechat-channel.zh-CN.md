# 微信 iLink 渠道

微信渠道由 Next Node Server 内置 Channel Gateway 维护，不再运行独立进程。Gateway 长轮询 iLink，将完整批次回调到应用内部 Webhook；Webhook 在同一事务中写入事件队列并推进 cursor，4 个 processor 从 PostgreSQL 队列生成与分片发送回复。

## 部署支持

- 本地：默认关闭。在 `.env.local` 设置 `CHANNEL_GATEWAY_ENABLED=1`，然后正常运行 `pnpm dev`。
- Docker：生产 Compose 已显式开启，单一 `app` 容器同时运行 Next 与 Gateway。
- Vercel：不支持持久连接；设置页保留入口但禁用扫码和绑定。

不要再启动 `wechat-gateway.ts`，也不要使用旧版手动 Cron。`/api/cron/wechat-gateway` 保持禁用。

## 必需配置

```dotenv
CHANNEL_GATEWAY_ENABLED=1
DATABASE_URL=postgresql://...
KEY_VAULTS_SECRET=replace-with-a-random-secret
OPENAI_API_KEY=... # 或受支持的其他服务端模型密钥
```

可选配置：

| 变量 | 用途 |
| --- | --- |
| `CHANNEL_GATEWAY_INTERNAL_URL` | 内部回调地址；默认 `http://127.0.0.1:$PORT` |
| `CHANNEL_GATEWAY_INTERNAL_SECRET` | 内部 Webhook 鉴权密钥，生产建议显式设置 |
| `WECHAT_GATEWAY_LOG_MESSAGE_TEXT` | 调试时输出截断后的消息正文，默认关闭 |

兼容周期内仍读取 `WECHAT_GATEWAY_ENABLED` 和 `WECHAT_WEBHOOK_SECRET`，但新配置应使用统一变量。

## 运行与恢复

每个绑定持有 PostgreSQL Gateway lease（90 秒 TTL、30 秒续租）。多实例只有租约持有者建立连接；实例停止后，其他实例会在租约过期后接管。Webhook 失败不会推进 cursor，Poller 会重试同一批次。会话过期时绑定进入 `needs_rebind`，需重新扫码。

健康检查 `/api/health` 只显示平台级计数，不返回 binding ID。单绑定异常显示 `degraded`；数据库或 Gateway 核心启动失败返回 `503 unhealthy`。
