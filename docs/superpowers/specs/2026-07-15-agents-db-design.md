# Agents 入库 · 设计规格

日期：2026-07-15  
状态：已确认  
前置：Chat v2 Phase 2 DB（`docs/superpowers/specs/2026-07-14-chat-v2-db-design.md`）  
相关：修订 Phase 2「不建 agents 表」决策

## 已确认决策

| 决策 | 选择 |
|------|------|
| 范围 | 完整 CRUD（列表 / 创建 / 编辑 / 删除） |
| 归属 | **系统内置（全局）+ 用户自建** 并存 |
| 默认助理 | 仅 **Pure AI**；去掉禅定法师、写作助理 |
| Pure AI | 不可删除、不可改归属；展示字段可编辑；禁止改 `isBuiltin` / `userId` |
| Session 层 | **不建** sessions / agents_to_sessions（继续 `?agent=` + `chat_topics`） |
| 社区市场 | 非目标（`DiscoverAgentItem` 仍 mock；`marketIdentifier` 字段预留） |
| LLM params | 仍以客户端 `useChatUiStore` 为主；表内 `model`/`provider`/`params` 预留 |

## 目标

| ID | 需求 | 验收 |
|----|------|------|
| A1 | Schema | `agents` 表 + migration + Pure AI 种子 |
| A2 | Model | `AgentModel`：可见列表、CRUD、ensureBuiltin、删前 topic 校验 |
| A3 | API | `/api/agents` + `/api/agents/[id]` 完整 CRUD |
| A4 | 侧栏列表 | `AgentSection` / `HomeAgentSelect` 改读 API |
| A5 | CRUD UI | 新建 / 编辑 / 删除（内置无删除） |
| A6 | 常量清理 | 移除 `HOME_AGENTS`；默认 `agt_inbox` |

## 非目标

- Session 表、插件 / TTS / RAG 绑定表
- 社区助理市场入库与 fork
- LLM params 强制以 DB 为准
- 历史 `zen-master` / `writer` topic 数据迁移
- 未登录访客的助理列表

## 与 LobeHub 的对齐 / 裁剪

```text
LobeHub:  Agent ←→ Session ← Topic ← Message
PureChatNext:  agents（入库）→ ?agent=id → chat_topics ← chat_messages
```

保留：id、slug、title、description、avatar、backgroundColor、systemRole、model、provider、params、pinned、virtual→`isBuiltin`、timestamps、userId。

砍掉：workspace、visibility、plugins、tts、fewShots、chatConfig、agencyConfig、opening*、sessionGroup、clientId、关联子表。

差异：Pure AI 为 **全局一行**（`user_id IS NULL` + `is_builtin`），非每用户 Inbox。

## Schema：`agents`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | text PK | `idGenerator('agents')`；Pure AI = `agt_inbox` |
| `slug` | varchar(100) NOT NULL | Pure AI = `inbox` |
| `user_id` | text FK → users NULL | NULL = 系统内置 |
| `title` | varchar(255) NOT NULL | Pure AI = `Pure AI` |
| `description` | varchar(1000) | 可选 |
| `avatar` | text | emoji / URL |
| `background_color` | text | 可选 |
| `system_role` | text | 系统提示词 |
| `model` / `provider` | text | 可空，预留 |
| `params` | jsonb | 默认 `{}` |
| `pinned` | boolean | 默认 false；Pure AI = true |
| `is_builtin` | boolean NOT NULL | Pure AI = true |
| `sort` | integer | Pure AI = 0 |
| `market_identifier` | text | 可空，预留 |
| timestamps | timestamptz | accessed/created/updated |

约束：`UNIQUE (slug) WHERE user_id IS NULL`；`UNIQUE (user_id, slug) WHERE user_id IS NOT NULL`；`INDEX (user_id)`；`INDEX (is_builtin)`。

列表：`WHERE user_id IS NULL OR user_id = :uid`，排序 `is_builtin DESC, pinned DESC, sort ASC, updated_at DESC`。

`chat_topics.agent_id` / `chat_messages.agent_id` 约定 = `agents.id`，本期不加 FK。有关联 topic 则禁止删除（409）。

## Pure AI 种子

| 字段 | 值 |
|------|-----|
| id | `agt_inbox` |
| slug | `inbox` |
| user_id | NULL |
| title | Pure AI |
| is_builtin | true |
| pinned | true |
| sort | 0 |
| avatar | `✨` |
| system_role | 简短通用人设 |

幂等：migration `ON CONFLICT DO NOTHING` + Model `ensureBuiltin()`。

## API

鉴权：`getAuthenticatedUserId()` → 401。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents` | 内置 ∪ 当前用户；先 ensureBuiltin |
| POST | `/api/agents` | 创建用户助理 |
| GET | `/api/agents/[id]` | 内置或本人 |
| PATCH | `/api/agents/[id]` | 可改展示/模型字段；禁改 isBuiltin、userId；内置禁改 slug |
| DELETE | `/api/agents/[id]` | 内置 403；非本人 404；有 topic 409 |

## 前端

- `AgentSection` / `HomeAgentSelect` / `HomeChatInput`：列表来自 API
- 侧栏：新建 Modal；项菜单编辑 / 删除（内置无删除）
- `ChatPage`：`?agent=` 拉详情补 systemRole；缺省 `agt_inbox`
- `useHomeStore.selectedAgentId` 默认 `agt_inbox`
- 常量文件只保留 `PURE_AI_AGENT_ID` / 默认 meta

## 验收标准

- 登录后侧栏至少可见 Pure AI；无禅定法师 / 写作助理
- 可创建 / 编辑用户助理；无 topic 可删
- 删 Pure AI → 403；有 topic → 409
- `/chat?agent=agt_inbox` 能带上 systemRole 发消息
- `HOME_AGENTS` 数组已移除
