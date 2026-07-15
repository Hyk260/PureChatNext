# Chat v2 Phase 2 · DB 落库设计

日期：2026-07-14  
状态：待用户审阅（范围已口头确认）  
前置：Phase 1 UI Shell（`ff6a26f`）  
相关：`docs/superpowers/specs/2026-07-14-chat-v2-ui-shell-design.md`

## 已确认决策

| 决策 | 选择 |
|------|------|
| 鉴权 | **聊天必须登录**；未登录访问 `/chat` 重定向登录 |
| 存储 | **全部走 DB**；移除 Phase 1 的 localStorage 消息/话题分桶 |
| 话题管理 | 支持 **删除、重命名**（列表行内或菜单） |
| Agent | ~~继续用 `HOME_AGENTS`、不建 agents 表~~ → **已由** [`2026-07-15-agents-db-design.md`](./2026-07-15-agents-db-design.md) **取代**（`agents` 表 + Pure AI） |
| LLM 参数 | 仍只存客户端 `useChatUiStore`（Phase 3 再透传/落库） |
| `/api/chat` | 仍只负责流式生成；消息持久化由独立 REST + 前端在流式结束后写入 |

## 目标

| ID | 需求 | 验收 |
|----|------|------|
| F1 | Schema | `chat_topics` + `chat_messages` 表 + migration |
| F2 | 鉴权 | `/chat` 与相关 API 必须 Better Auth session；`userId` = `users.id` |
| F3 | Topics API | 列表 / 创建 / 重命名 / 删除（级联消息） |
| F4 | Messages API | 按 topic 拉取；批量 upsert（流式结束后落库） |
| F5 | 前端切换 | `ChatPage` / TopicSidebar 改调 API；去掉 messages/topics localStorage |
| F6 | 草稿固化 | 无 `topic` 时首条发送 → `POST /topics` → `?topic=` → 发消息 → 落库 |
| F7 | 管理 UI | 话题项支持重命名、删除（确认） |

## 非目标

- ~~agents 表~~（见 2026-07-15 agents 规格）；社区 agent 入库仍非目标
- Phase 3 LLM 参数透传 / 入库
- 本地→DB 历史导入（旧 localStorage 可忽略或一次性清 key）
- 消息编辑/删除同步到 DB（可后续；本期至少保证发送后全量同步）
- 实时协作、分页无限历史（首版可全量拉取单 topic，后续再分页）

## Schema（最小裁剪自 lobe message/topic）

### `chat_topics`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text PK | `idGenerator('chatTopics')` 或 uuid |
| `user_id` | text FK → `users.id` ON DELETE CASCADE | 必填 |
| `agent_id` | text NOT NULL | 对应 `HOME_AGENTS[].id` |
| `title` | text NOT NULL | 默认可「新话题」 |
| `created_at` / `updated_at` | timestamp | 用现有 `timestamps` helper |

索引：`(user_id, agent_id)`, `(user_id, updated_at desc)`

### `chat_messages`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text PK | 与 AI SDK `UIMessage.id` 对齐（客户端生成或服务端生成后回写） |
| `user_id` | text FK → `users.id` CASCADE | 必填 |
| `topic_id` | text FK → `chat_topics.id` CASCADE | 必填 |
| `agent_id` | text NOT NULL | 冗余便于查询 |
| `role` | varchar | `user` / `assistant` / `system` |
| `content` | text | 主文本（从 UIMessage parts 提取） |
| `parts` | jsonb | 完整 `UIMessage.parts`（保留 reasoning 等） |
| `model` / `provider` | text nullable | assistant 消息可选 |
| `created_at` / `updated_at` | timestamp | |

索引：`(topic_id, created_at)`, `(user_id, topic_id)`

**不做**：plugins/tts/files/RAG 子表、session 表、thread 表。

## API（对齐 `knowledge-bases` 风格）

鉴权：`getAuthenticatedUserId()` → 401 `unauthorizedResponse()`  
Model：`TopicModel(userId)` / `MessageModel(userId)`，内部 `eq(userId)` ownership。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/chat/topics?agentId=` | 当前用户该 agent 的话题列表，按 `updated_at` desc |
| POST | `/api/chat/topics` | body: `{ agentId, title? }` → 创建空话题 |
| PATCH | `/api/chat/topics/[id]` | body: `{ title }` → 重命名 |
| DELETE | `/api/chat/topics/[id]` | 删话题（CASCADE 消息） |
| GET | `/api/chat/topics/[id]/messages` | 返回 `UIMessage[]`（从 parts/content 组装） |
| PUT | `/api/chat/topics/[id]/messages` | body: `{ messages: UIMessage[] }` 全量替换该 topic 消息（ownership 校验） |

可选简化：POST 单条 message；首版 **PUT 全量** 更简单，对齐现有「本地 saveMessages 整表写」心智。

## 前端改动要点

1. **`/chat` 鉴权**：layout 或 page 检查 session；未登录 → `/signin?callbackUrl=/chat...`
2. **去掉** `loadMessages/saveMessages/loadTopics/createTopicFromDraft` 的 localStorage 路径（可删或标 deprecated 仅测 pending handoff）
3. **保留** `setPendingChatText` / `setPendingTopicSend`（内存/session 一次性 handoff 仍可用）
4. **TopicSidebar**：列表来自 GET topics；新话题 → POST topics + replace URL；项菜单：重命名（Prompt/Modal）、删除（Popconfirm）
5. **ChatPage**：
   - 有 `topic`：GET messages 作 `initialMessages`
   - 流式结束后 / messages 变化 debounce：`PUT messages`（替代 localStorage save）
   - 草稿：无 topic 时首发 → POST topic → pending send → remount → send → PUT
6. **入口**：`AgentSection` / `HomeChatInput` / `AgentCard` 跳转前若未登录走登录；去掉 `clearDraftMessages`

## 数据流

```text
登录用户 → /chat?agent=&topic=
  GET topics → 左栏
  GET messages → useChat initial
  sendMessage → /api/chat（流式，不变）
  onFinish / debounce → PUT messages
新话题 → POST topic → ?topic= → 空会话
重命名 → PATCH topic
删除 → DELETE topic → 若删当前则回草稿或最近话题
```

## 测试

- Model 层单元测试（ownership、级联）
- API route 测试（401 / 404 / CRUD）或 vitest + mock session
- 前端：handoff 不重复发送（沿用 Phase 1 修复）

## 迁移

```bash
pnpm db:generate
pnpm db:migrate
```

## 给下一会话的开场白（复制即用）

```text
继续 Chat v2 Phase 2 DB 落库。
规格：docs/superpowers/specs/2026-07-14-chat-v2-db-design.md
计划：docs/superpowers/plans/2026-07-14-chat-v2-db.md（若已写）
范围：必须登录、全部 DB、去掉 localStorage 分桶、话题删除/重命名。
请先审阅 spec，通过后用 subagent-driven-development 执行计划。
```

## Spec 自检

- [x] 决策与用户选择一致（强制登录 + DB + 管理能力）
- [x] userId = `users.id`，对齐 knowledge_bases
- [x] 非目标含 Phase 3 / agents 表
- [x] 无 TBD 占位
