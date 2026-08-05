# 微信 iLink 文本渠道

微信渠道通过 iLink Bot API 扫码授权。首版只支持微信私聊文本；群聊、图片、文件、工具调用和网页 Topic 同步暂不支持。

## 部署边界

- 本地：运行 `pnpm dev` 后，另开终端运行 `pnpm wechat:gateway`。
- Docker：生产 Compose 默认启动 `wechat-gateway` 服务，并与 app 共用镜像和环境变量。
- Vercel：不支持常驻 Gateway，设置页会显示“不支持”并禁用扫码。仓库不配置 Vercel Cron。

不要同时运行常驻 Gateway 和旧版手动 Cron。`/api/cron/wechat-gateway` 已禁用，避免重复轮询。

## 可靠性模型

```text
iLink getUpdates
       │
       ▼
Gateway Poller ──事务──► channel_events + poll_cursor
                              │
                              ▼
                       Processor lease
                              │
                       模型输出先落库
                              │
                       分片发送并记进度
```

- Poller 将一个 `getUpdates` 批次的事件和新 cursor 在同一 PostgreSQL 事务中提交。
- 入站按 `binding_id + message_id/client_id` 去重。
- Processor 使用数据库 lease；失败指数退避，最多 8 次，最终进入 failed。
- 已生成回复会先保存，发送重试不会再次调用模型；每个 2000 字分片保存发送进度。
- 进程异常退出后，过期 lease 可被新进程回收。
- 渠道历史独立存储，Prompt 只取当前会话版本最近 20 轮、最多 40,000 字符；已完成历史保留 30 天。
- 外部发送 API 没有事务回执。如果微信已接收分片但进程在保存进度前崩溃，恢复后该分片可能重复；不会因此跳过入站消息。

状态以 Gateway 心跳为准。成功完成一次 `getUpdates` 会刷新数据库心跳；超过 90 秒没有心跳，页面显示 offline，而不是“已连接”。

## 环境变量

| 变量 | 要求 |
| --- | --- |
| `DATABASE_URL` | 必填，可靠队列的事实来源 |
| `KEY_VAULTS_SECRET` | 必填，用 AES-256-GCM 加密扫码凭证和 `context_token` |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` | 至少配置当前 Agent 对应的服务端密钥 |
| `WECHAT_GATEWAY_ENABLED` | 本地/自托管默认 true；Vercel 默认 false |
| `WECHAT_WEBHOOK_SECRET` | 仅兼容/诊断 webhook 使用；未配置时 webhook 始终拒绝 |
| `CRON_SECRET` | webhook secret 的兼容回退；不用于微信 Cron |

旧的 `plain:v1` 或裸 JSON 凭证会在 Gateway 启动时重加密。没有 `KEY_VAULTS_SECRET` 时 Gateway 拒绝启动，扫码绑定接口也会拒绝保存新凭证。

## 数据库与运行

```bash
pnpm db:migrate
pnpm dev
pnpm wechat:gateway
```

Gateway 直接访问 PostgreSQL 和微信 API，不需要通过 `APP_URL` 回调自身 webhook。Docker 镜像内置 `/app/wechat-gateway.mjs`；健康检查为：

```bash
node /app/wechat-gateway.mjs --healthcheck
```

## 微信指令

| 指令 | 行为 |
| --- | --- |
| `/help` | 显示指令和文本限制 |
| `/new` | 中止当前生成并增加会话版本 |
| `/stop` | 通过 `AbortSignal` 停止当前模型调用 |
| `/agents` | 列出助手和当前选择 |
| `/agents <序号\|agentId>` | 切换当前联系人的助手并开始新对话 |

指令必须是完整的 `/command [args]`。未知斜杠指令只返回帮助，不进入模型。普通联系人可以使用 `/new`、`/stop`、`/help`；只有扫码授权得到的微信账号可以枚举或切换 Agent。

可用于微信渠道的 Agent Provider 仅为默认 DeepSeek、OpenAI 或 DeepSeek，并且必须有对应服务端密钥。其他 Provider 会显示不可用，不会静默回退。

## 回环验收

1. 启动数据库、app 和 Gateway，扫码绑定。
2. 90 秒内状态应从 starting 变为 online。
3. 连续发送两条文本，第二条应使用第一轮上下文，且每条只产生一份入站事件。
4. 发送 `/new` 后再提问，旧上下文不应进入 Prompt。
5. 用扫码账号执行 `/agents` 并切换；其他联系人执行应被拒绝。
6. 长回答期间发送 `/stop`，应收到停止确认且生成调用被中止。
7. 停止 Gateway；90 秒后页面应显示 offline。重新启动后应恢复轮询并继续过期 lease/待重试事件。
8. 发送图片或文件，应收到“当前版本仅支持文本消息”。

失败事件可在设置页点击“重试失败消息”，单次最多重新入队 100 条。

## API

| 方法 | 路径 | 鉴权 |
| --- | --- | --- |
| POST | `/api/channels/wechat/qrcode` | session |
| GET | `/api/channels/wechat/qrcode/status?qrcode=` | session |
| POST / PATCH / DELETE | `/api/channels/wechat/bind` | session |
| GET | `/api/channels/wechat/status` | session |
| POST | `/api/channels/wechat/events/retry` | session |
| POST | `/api/channels/wechat/webhook/[applicationId]` | webhook secret，兼容/诊断用途 |
