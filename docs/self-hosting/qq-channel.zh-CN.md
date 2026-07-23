# QQ 渠道（Messenger）

通过 **QQ 开放平台机器人**（App ID / App Secret）连接，在 QQ 私聊、群聊 @、频道中与 PureChat 助手对话。

协议与 Chat SDK Adapter 在 workspace 包 [`@pure/chat-adapter-qq`](../../packages/chat-adapter-qq)（配合 Vercel `chat` SDK）。平台能力与接口以 [QQ 开放平台 / 机器人文档](https://bot.q.qq.com/wiki/) 为准；本仓整理见 [qq/protocol.zh-CN.md](./qq/protocol.zh-CN.md)。

## 功能范围（MVP）

- 设置页：`/settings/messenger` → `/settings/messenger/qq`
- 填写 App ID / App Secret → 选择连接模式 → 绑定单个 Agent → 私聊与群 @ 文本往返
- **不做**：媒体附件、`/agents` 真命令、DM pairing / 群白名单、guild 富媒体 multipart

## 连接模式

- **WebSocket（默认）** — 常驻 `pnpm qq:gateway` 连 QQ 网关，事件转发到内部 webhook；无需在开放平台配回调。
- **Webhook** — QQ 直推到公网 HTTPS：`{APP_URL}/api/channels/qq/webhook/{applicationId}`；适配器自动处理 Ed25519 验证（`op=13`）。

> 一旦在 QQ 开放平台配置了 Webhook 回调，就无法再切回 WebSocket。新机器人建议先用 WebSocket。

## 工作原理

```text
QQ 开放平台
  │ Webhook 模式：直推
  │ WebSocket 模式：Gateway → 内部 POST
  ▼
/api/channels/qq/webhook/:applicationId
  │
  ▼
Chat + QQAdapter.handleWebhook → processMessage
  │
  ▼
AgentBridge（generateText + 绑定 Agent）
  │
  ▼
adapter.postMessage → QQApiClient（被动回复带 msg_id）
```

1. 在 [q.qq.com](https://q.qq.com) 创建机器人，复制 App ID / App Secret
2. 设置页填写凭证与连接模式，调用 `/api/channels/qq/bind` 写入 `channel_bindings`
3. WebSocket：启动 `pnpm qq:gateway`；Webhook：把 status 返回的回调 URL 配到开放平台
4. 入站事件经 `@pure/chat-adapter-qq` 入队；宿主用绑定 Agent 回复

## 环境变量

| 变量                                  | 说明                                                  |
| ------------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL`                        | 必填，存 `channel_bindings`                           |
| `APP_URL`                             | 拼 webhook 回调 URL；WS gateway 转发基址              |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` | **服务端**回复用                                      |
| `KEY_VAULTS_SECRET`                   | 建议：AES 加密凭证；未设置则明文 base64               |
| `CRON_SECRET`                         | 内部 WS→webhook 转发鉴权（`Authorization: Bearer …`） |
| `QQ_WEBHOOK_SECRET`                   | 可选；优先于 `CRON_SECRET` 用于内部转发               |

凭证（App Secret）按绑定加密存储，**无**全局 `QQ_APP_SECRET`。本地示例见根目录 `.env.example`。

## 数据库

复用已有 `channel_bindings` 表（`platform='qq'`，`applicationId` = QQ App ID）。无需新迁移。

```bash
pnpm db:migrate
```

## 运行 Gateway（WebSocket 模式）

先起 Next（`pnpm dev:next` 或 `pnpm dev`），再：

```bash
pnpm qq:gateway
# 或 bun scripts/qq-gateway.ts
```

常驻进程为所有 `enabled` 且 `connectionMode=websocket` 的绑定维护 WS；事件 POST 到内部 webhook。本地需 `APP_URL` 指向可访问 Next `/api` 的地址。

Webhook 模式无需 gateway；生产可直接让 QQ 回调 Vercel / 自托管 HTTPS。

## 已知限制

| 项                     | 说明                                            |
| ---------------------- | ----------------------------------------------- |
| 被动回复窗口           | 群约 5 分钟 / 单聊约 60 分钟内须带入站 `msg_id` |
| 主动消息               | 2025-04 后主动推送基本下线                      |
| 无编辑 / 反应 / typing | QQ Bot API 不支持                               |
| 文本上限               | 单条约 2000 字；发出前剥 Markdown               |
| 群聊                   | 通常需 @机器人 才有事件                         |

## API 一览

| 方法                  | 路径                                       | 鉴权                                    |
| --------------------- | ------------------------------------------ | --------------------------------------- |
| POST / PATCH / DELETE | `/api/channels/qq/bind`                    | session                                 |
| GET                   | `/api/channels/qq/status`                  | session                                 |
| POST                  | `/api/channels/qq/webhook/[applicationId]` | QQ Ed25519（公网）或 Bearer（内部转发） |

## 包结构

| 位置                        | 职责                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `packages/chat-adapter-qq`  | REST / WS Gateway / Ed25519、`QQAdapter`、format-converter |
| `src/libs/channels/qq`      | 凭证加解密、Chat 缓存、AgentBridge、WS gateway 转发        |
| `src/app/api/channels/qq/*` | 绑定 / 状态 / webhook                                      |
