---
title: QQ 机器人渠道
description: 配置 QQ 开放平台机器人接入 PureChatNext：选择扫码、WebSocket 或 Webhook，完成回调校验、消息验证和故障排查。
---

# QQ 机器人渠道

本文说明如何把 QQ 开放平台机器人连接到 PureChatNext，并验证机器人能收到消息和返回 Agent 回复。持久 Node.js 部署可使用扫码、WebSocket 和 Webhook；Vercel 备用站只支持 Webhook。源码配置核对日期：2026-10-16；QQ 开放平台控制台名称可能随平台更新调整。

## 前置条件

- 在 [QQ 开放平台](https://q.qq.com/) 创建机器人，并准备 `App ID` 和 `App Secret`。机器人可用的消息场景、沙箱成员和发布权限以平台控制台当前状态为准；不要将 Secret 发到聊天或提交到代码仓库。
- PureChatNext 账号中至少有一个 Agent。选择 PureChat、OpenAI 或 DeepSeek；使用 OpenAI / DeepSeek 时，先在账号服务商设置中保存模型 API Key。模型服务费用由对应服务商结算。
- 所有模式都需要 PostgreSQL 与 `KEY_VAULTS_SECRET`，以保存绑定和解密模型凭证。扫码和 WebSocket 还需要支持常驻 Node.js 进程并启用 `CHANNEL_GATEWAY_ENABLED=1`；Webhook 需要 QQ 平台可访问的 HTTPS 回调地址，不要求常驻 Gateway。
- QQ 开放平台的 Webhook 回调需要公网可达。Vercel 部署请使用不受登录保护拦截的公开 Webhook 地址，并确认主备实例的数据与密钥配置符合[环境变量说明](../../configuration/environment.md)。

## 选择连接方式

| 方式 | 适用场景 | 需要的运行条件 | QQ 开放平台配置 |
| --- | --- | --- | --- |
| 扫码绑定 | 快速授权和绑定机器人 | 持久 Node.js Gateway；扫码会话保存在当前进程，建议单实例完成扫码 | 按页面提示在手机 QQ 确认授权 |
| WebSocket | 由 PureChatNext 主动维护长连接 | 持久 Node.js Gateway | 不需要公网回调地址 |
| Webhook | 使用平台向 PureChatNext 推送事件，或 Vercel 备用站 | 公网 HTTPS 回调、数据库；不需要常驻 Gateway | 将设置页生成的回调地址填入 QQ 开放平台 |

设置页路径：登录后打开 `/settings/messenger/qq`（设置 → 聊天平台 → QQ）。

## 绑定并验证

1. 在 QQ 开放平台创建机器人，保管好 App ID / App Secret，并确认测试账号或沙箱已获准与机器人互动。
2. 在 PureChatNext 选择目标 Agent、服务商和模型，点击「连接」。
3. **扫码：** 选择「扫码绑定」，使用手机 QQ 扫描并确认；若出现机器人列表，选中要绑定的机器人，再点「连接所选机器人」。页面显示连接在线后继续下一步。
4. **WebSocket：** 选择「WebSocket 长连接」，输入 App ID 与 App Secret，点「注册」。页面状态变为在线后继续下一步。该模式不需要配置公网回调。
5. **Webhook：** 选择「使用 URL 回调」，输入 App ID 与 App Secret 并注册；复制设置页显示的回调地址，填入 QQ 开放平台的消息接收配置并保存。平台验证通过后，再用有权限的 QQ 账号发一条私聊或沙箱消息。
6. 在 QQ 私聊机器人发送文本，或在已获准的群聊中 @机器人。收到所选 Agent 回复表示消息接收、模型调用和回复发送已打通。Webhook 校验成功只证明平台能访问回调；仍需发消息验证完整链路。

扫码和 WebSocket 需要 `CHANNEL_GATEWAY_ENABLED=1`；关闭 Gateway 时，设置页仍允许配置 Webhook，但会禁用其他两种方式。回复模型密钥保存在用户账号加密配置中，不读取服务器的 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`。

## 回调验证与排错

Webhook 保存时，QQ 平台会发送验证事件。平台验证失败时，先确认回调 URL 精确复制自设置页，路径末尾的 App ID 与绑定时一致，HTTPS 证书有效，且请求不会被防火墙、登录页或 Deployment Protection 拦截。开发时可在应用日志中用 `DEBUG=channel:qq:webhook` 查看 `verify-signed` / `dispatch` 等诊断事件；日志不要公开其中的账号标识或请求数据。

本地开发可以用 TryCloudflare 隧道提供临时公网地址。仅用于测试；隧道域名变化后需更新 QQ 平台配置。仓库命令 `pnpm dev:next`、`pnpm dev:spa`、`pnpm tunnel:cloudflare` 启动本地服务，隧道指向 SPA `:5174`，`/api` 由 Vite 转发至 Next `:3000`。

首次保存回调前，可发送 QQ `op=13` 验证请求预热本地 Next 路由：

```bash
curl -sS -X POST "https://<隧道域名>/api/channels/qq/webhook/<AppID>" \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: QQBot-Callback' \
  -H "X-Bot-Appid: <AppID>" \
  --data '{"d":{"plain_token":"ping","event_ts":"1"},"op":13}'
```

本地日志出现 `reason: verify-signed`、`op: 13` 和非零 `bodyBytes`，说明验证路由已执行；再从 QQ 发消息，确认出现 `reason: dispatch`。预热响应不是机器人对话验收。

| 现象 | 先检查 | 处理方式 |
| --- | --- | --- |
| 扫码 / WebSocket 选项不可用 | `gatewaySupported` 与部署环境 | 启动支持常驻进程的 Node.js / Docker 主站并启用 Gateway；Vercel 备用站只可用 Webhook。 |
| Webhook 验证失败 | HTTPS、公网可达性、URL 中的 App ID、QQ 平台回调设置 | 从设置页重新复制 URL；检查部署保护 / 防火墙，再查看 `channel:qq:webhook` 日志。 |
| 页面显示已绑定但离线 | WebSocket Gateway 是否在线、App ID / Secret、应用日志 | 确认凭证正确、进程未休眠，重启 Gateway 后查看页面状态与诊断日志。 |
| 验证通过但 QQ 消息没有回复 | 机器人是否允许当前测试账号 / 场景、所选 Agent 和模型 | 在平台沙箱 / 权限允许的场景重试；检查服务商凭证、额度和「连接 QQ」旁的日志。 |

部署命令与健康检查见 [Docker 自托管](../../platform/docker.md)；服务端变量见[环境变量配置](../../configuration/environment.md)。平台接入规则请以[腾讯 QQ 机器人文档](https://github.com/tencent-connect/bot-docs)为准。

> 扫码授权使用腾讯 `@tencent-connect/qqbot-connector`。扫码会话与 Secret 暂存在当前 Node.js 进程，因此不要在扫码流程中重启进程或跨实例切换。该依赖包的授权状态和可展示的机器人名称请以包及 QQ 平台当前条款为准。

## 部署支持

- 主站 `app.purechat.cn`：应部署在支持持久 Node.js 进程的运行环境；启用 Gateway 后可使用扫码、WebSocket 和 Webhook。Docker 生产 Compose 已开启 WebSocket Gateway。
- Vercel 备用站 `next.purechat.cn`：仅支持 Webhook；UI 与服务端都会拒绝创建或切换到扫码/WebSocket。切换备用站时需确认 QQ 开放平台的回调地址指向该站可访问的 Webhook Route。
- 本地 WebSocket：设置 `CHANNEL_GATEWAY_ENABLED=1` 后正常运行 `pnpm dev`。

## Webhook 本地验证与生产配置

两套环境走**同一条** webhook 路由，不要为隧道单独改 Proxy。本地校验通过后，上线只换 QQ 控制台里的回调 URL。

### 1. 本地隧道

保持 `pnpm dev:next`、`pnpm dev:spa`、`pnpm tunnel:cloudflare` 同时运行。隧道脚本指向 SPA `:5174`，`/api` 由 Vite 转到 Next `:3000`。

首次保存回调前，先用官方 `op=13` 预热一次（避免冷编译超时）：

```bash
curl -sS -X POST "https://<隧道域名>/api/channels/qq/webhook/<AppID>" \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: QQBot-Callback' \
  -H "X-Bot-Appid: <AppID>" \
  --data '{"d":{"plain_token":"ping","event_ts":"1"},"op":13}'
```

QQ 开放平台填：

`https://<隧道域名>/api/channels/qq/webhook/<AppID>`

终端出现 `reason: verify-signed`、`op: 13`、`bodyBytes` 非 0 即校验成功。之后私聊发消息应看到 `reason: dispatch`。

### 2. 配置生产 Webhook（主站或 Vercel 备用站）

1. 主站 `app.purechat.cn` 应部署在支持持久 Node.js 的运行环境；`next.purechat.cn` 是 Vercel 备用入口，只能承接 Webhook，不支持扫码 / WebSocket。
2. 将对应部署的 `APP_URL` 设为它自己的 HTTPS 域名（不要留 `localhost` / `*.trycloudflare.com`）。Vercel 备用站需允许 QQ 平台直接访问回调，不能让 Deployment Protection 把请求转到登录页。
3. 在该站登录并用「使用 URL 回调」方式绑定 QQ 机器人。若希望主备共享绑定，必须共享 `DATABASE_URL`、`KEY_VAULTS_SECRET`，并保持数据库迁移兼容。
4. 把 QQ 控制台回调地址设为设置页显示的 URL，格式如下：

`https://<生产域名>/api/channels/qq/webhook/<AppID>`

不要继续用 trycloudflare 地址。失焦保存后应再次出现 `verify-signed`。

扫码授权由仓库当前锁定的腾讯 `@tencent-connect/qqbot-connector@1.2.0` 提供。扫码会话只保存在发起授权的 Node.js 进程；扫码期间如果重启、重新部署或把轮询请求切到另一实例，会话可能失效。成功绑定后，机器人凭证沿用账号加密存储。该依赖包当前 `package.json` 的 license 字段为 `UNLICENSED`，授权页默认显示“第三方机器人”；如需使用 PureChatNext 品牌或确认商务授权，请联系 `qq_bot_api@tencent.com`。

不再运行 `qq-gateway.ts`。WebSocket 入站事件会按序转发到内部 `/api/channels/qq/webhook/:appId`，有限重试后仍失败则仅将该绑定标记为 degraded。WebSocket 绑定必须携带内部 Bearer 密钥；省略 Authorization 不会降级成外部 Webhook。

## 配置

```dotenv
CHANNEL_GATEWAY_ENABLED=1
CHANNEL_GATEWAY_INTERNAL_SECRET=replace-with-a-random-secret
DATABASE_URL=postgresql://...
KEY_VAULTS_SECRET=replace-with-a-random-secret
```

`CHANNEL_GATEWAY_INTERNAL_URL` 可覆盖内部回调地址。兼容周期内仍读取 `QQ_WEBHOOK_SECRET`，统一密钥优先。Webhook 模式无需启用 Gateway；保存绑定后把设置页显示的回调地址配置到 QQ 开放平台。QQ 回复使用账号在设置页保存的 OpenAI / DeepSeek 密钥，不读取服务端 `OPENAI_API_KEY` / `DEEPSEEK_API_KEY`。

入站消息日志通过 `DEBUG=channel:qq:webhook`（或 `channel:qq:*`）开启。

设置页点击“连接”后可以选择扫码、手动 WebSocket 或 URL 回调。未启用 Gateway 时，扫码和 WebSocket 会禁用，但 URL 回调仍可配置。

## 状态判断

WebSocket 的 `connected` 依据 90 秒内的真实心跳，不再仅依据绑定是否存在。状态接口同时返回 `gatewaySupported`、`runtimeStatus`、`lastHeartbeatAt` 与脱敏错误摘要。Webhook 模式按有效绑定报告连接状态。

## 诊断日志

在「连接 QQ」标题右侧点击日志图标，查看服务端连接、重试、授权、回调、模型处理和发送失败记录。Webhook 模式也可查看回调诊断，查询日志不会启动 Gateway。弹框每 5 秒刷新，关闭或页面隐藏时暂停；读取失败可手动刷新重试。

Web 和 Electron 读取同一份 PostgreSQL 记录：Web 使用登录会话，Electron 使用远程服务协议代理与 Bearer 鉴权，不新增本地文件日志或日志 IPC。仅返回当前账号的 QQ 记录，保留最近 7 天、最多 200 条；断开或重新绑定不会删除历史。记录只含固定事件摘要及安全错误码，不包含聊天正文、Secret、Token 或二维码凭据。相同错误一分钟内抑制重复，连接恢复后再次发生会重新记录。

部署此功能前先执行 `pnpm db:migrate`，应用 `0033_goofy_deathstrike.sql`。数据库不可用时显示读取失败，日志写入失败不阻断连接和消息处理。清理在写入事务及常驻 Gateway 的日常维护中执行；Serverless Webhook 部署在写入时清理，查询始终过滤过期记录。

## 常见问题

**Webhook 需要开启 `CHANNEL_GATEWAY_ENABLED` 吗？** 不需要。设置页仍需能访问数据库并解密用户模型凭证；QQ 平台必须能直接访问生成的 HTTPS 回调地址。

**Vercel 备用站能接管 QQ 全部连接方式吗？** 不能，只能接收 Webhook；扫码和 WebSocket 需要持续运行的 Node.js Gateway。完整渠道主站应使用 `app.purechat.cn` 对应的持久运行环境。

## 继续了解

- [微信 iLink 渠道](../wechat/setup.md) · [Docker 自托管](../../platform/docker.md) · [环境变量配置](../../configuration/environment.md)
- [体验 PureChat](https://app.purechat.cn/?utm_source=docs&utm_medium=organic&utm_campaign=self_hosting_guide&utm_content=qq) · [GitHub 源码](https://github.com/Hyk260/PureChatNext)
