# 微信 iLink 渠道（Messenger）

通过微信 **iLink Bot API** 扫码连接，在微信私聊中与 PureChat 助手对话。个人开发者**不需要**公众号 / 开放平台企业资质。

协议与 Chat SDK Adapter 在 workspace 包 [`@pure/chat-adapter-wechat`](../../packages/chat-adapter-wechat)（配合 Vercel `chat` SDK）。通道基于微信 **iLink Bot API**（扫码长轮询）；具体字段与限制以微信侧公开文档 / 接口约定为准；本仓整理见 [wechat/protocol.zh-CN.md](./wechat/protocol.zh-CN.md)。

## 功能范围（MVP）

- 设置页：`/settings/messenger` → `/settings/messenger/wechat`
- 扫码绑定 → 绑定单个 Agent → 私聊文本往返
- 会话过期后提示重新扫码
- **不做**：群聊、`/agents` 切换、图片/文件（包内已有 CDN API，宿主暂未接媒体）

## 工作原理

```text
iLink getUpdates (长轮询)
        │
        ▼
Gateway poller（Cron / pnpm wechat:gateway）
        │  POST raw JSON
        ▼
/api/channels/wechat/webhook/:applicationId
        │
        ▼
Chat + WechatAdapter.handleWebhook → processMessage
        │
        ▼
AgentBridge（generateText + 绑定 Agent）
        │
        ▼
adapter.postMessage → iLink sendmessage
```

1. 前端请求 `/api/channels/wechat/qrcode`，展示二维码
2. 用户微信扫码确认后，拿到 `bot_token`，调用 `/api/channels/wechat/bind` 写入 `channel_bindings`
3. Gateway 长轮询 `getupdates`，把原始消息转发到内部 webhook
4. `@pure/chat-adapter-wechat` 的 `WechatAdapter` 入队；宿主 `AgentBridge` 用绑定 Agent 的 `systemRole` + 环境变量模型 Key 回复

微信侧**没有官方 push webhook**，必须常驻轮询或 Cron 续命；内部 webhook 仅供 gateway 转发。

## 环境变量

| 变量                                  | 说明                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL`                        | 必填，存 `channel_bindings`                                                              |
| `APP_URL`                             | Gateway 转发 webhook 的基址（本地可用 SPA `http://localhost:5174`，经 Vite 代理 `/api`） |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` | **服务端**回复用（浏览器里的 provider key 不可用）                                       |
| `REDIS_URL`                           | 强烈建议：缓存 `context_token`（多实例 / Vercel 必需）                                   |
| `KEY_VAULTS_SECRET`                   | 建议：AES 加密凭证；未设置则明文 base64 存库（仅服务端可读）                             |
| `CRON_SECRET`                         | Vercel Cron 与 webhook 转发鉴权（`Authorization: Bearer …`）                             |
| `WECHAT_WEBHOOK_SECRET`               | 可选；优先于 `CRON_SECRET` 用于 webhook；未设置则回退 `CRON_SECRET`                      |

本地示例见根目录 `.env.example`。

## 数据库

```bash
pnpm db:generate   # 已生成 channel_bindings 迁移
pnpm db:migrate
```

## 运行轮询

### 本地 / 自托管（推荐）

先起 Next（`pnpm dev:next` 或 `pnpm dev`），再：

```bash
pnpm wechat:gateway
# 或 bun scripts/wechat-gateway.ts
```

常驻进程循环拉取所有 `enabled` 的微信绑定，比 Cron 更稳。本地需 `APP_URL` 指向可访问到 Next `/api` 的地址。

### Vercel 生产

`vercel.json` 已配置每 5 分钟：

```json
{ "path": "/api/cron/wechat-gateway", "schedule": "*/5 * * * *" }
```

Cron 鉴权：`Authorization: Bearer $CRON_SECRET`。\
函数内用 `waitUntil` 启动约 8 分钟长轮询窗口；需 **Pro**（`maxDuration=300`）并配置 `REDIS_URL`。

手动触发：

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/wechat-gateway
```

## 已知限制

| 项          | 说明                                          |
| ----------- | --------------------------------------------- |
| 延迟        | 长轮询间隔可达数十秒                          |
| 会话过期    | iLink 返回 `-14` 后需重扫；空闲过久也可能掉线 |
| 文本上限    | 单条约 2000 字，超长自动切分                  |
| 无 Markdown | 微信侧按纯文本发送（`WechatFormatConverter`） |
| 游标不落库  | 进程重启可能重复/漏消息                       |
| Hobby 套餐  | Vercel Hobby 函数时长不够撑长轮询             |

## 成本粗估

- **工程**：MVP 约 7–11 人天（已实现基础能力）
- **微信 API**：无按次计费
- **运行**：每条消息 ≈ 一次 LLM 调用 + 通道固定成本（Cron/常驻进程 Active CPU、Redis）
- **运维**：重绑、会话过期、长轮询 / Cron 稳定性需要持续投入

## API 一览

| 方法                  | 路径                                           | 鉴权                                     |
| --------------------- | ---------------------------------------------- | ---------------------------------------- |
| POST                  | `/api/channels/wechat/qrcode`                  | session                                  |
| GET                   | `/api/channels/wechat/qrcode/status?qrcode=`   | session                                  |
| POST / PATCH / DELETE | `/api/channels/wechat/bind`                    | session                                  |
| GET                   | `/api/channels/wechat/status`                  | session                                  |
| POST                  | `/api/channels/wechat/webhook/[applicationId]` | `WECHAT_WEBHOOK_SECRET` 或 `CRON_SECRET` |
| GET                   | `/api/cron/wechat-gateway`                     | `CRON_SECRET`                            |

## 包结构

| 位置                            | 职责                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| `packages/chat-adapter-wechat`  | iLink HTTP / CDN / QR、`WechatAdapter`、format-converter                                   |
| `src/libs/channels/wechat`      | 凭证加解密、context\_token、poller、Chat 缓存（`@chat-adapter/state-memory`）、AgentBridge |
| `src/app/api/channels/wechat/*` | 扫码 / 绑定 / webhook / 状态                                                               |
