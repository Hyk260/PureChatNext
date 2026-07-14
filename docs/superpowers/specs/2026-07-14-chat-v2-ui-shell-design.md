# Chat v2 Phase 1 · UI Shell 设计

日期：2026-07-14  
状态：已批准（用户 ok）  
范围：`/chat` 三栏布局 + 本地多话题（localStorage 分桶）+ 右栏高级参数 UI（不落库、不透传 API）

## 背景

v1（见 `docs/chat-page-v1.md`）为单列本地聊天，消息存单一 localStorage key，无多会话。  
第二版对标 [LobeHub agent 页](https://app.lobehub.com/agent/agt_1kDgYuIrpcqf) 的三栏体验，但本期只做 **UI Shell**，数据库与 LLM 参数透传留给后续阶段。

## 目标

| ID | 需求 | 验收标准 |
|----|------|----------|
| F1 | 三栏布局 | `/chat` 左 TopicSidebar、中 ChatMain、右 ParamsPanel；左右可折叠，折叠态可持久化 |
| F2 | 新话题（草稿） | 点击「开启新话题」清除 URL `topic`，进入空草稿；不立刻写入列表 |
| F3 | 话题列表切换 | 列表展示本地 topic 元数据；点击切换 `/chat?agent=&topic=` 并加载对应消息桶 |
| F4 | 草稿固化 | 草稿下发出第一条用户消息时生成 `topicId`、写入列表、URL 补上 `topic`，消息进入新桶 |
| F5 | 按 topic 分桶 | 消息 key 含 `agentId` + `topicId\|draft`；切换话题互不串消息 |
| F6 | 高级设置 UI | 四滑块：创造力/开放性/词汇丰富度/话题发散；写入 chat UI store；**不**传给 `/api/chat` |
| F7 | Agent query | 保留现有 `?agent=` 同步；与 `?topic=` 共存 |

## 非目标（Phase 1 不做）

- `topics` / `messages` 数据库 schema、migration、服务端 API
- 将 temperature / top_p / presence_penalty / frequency_penalty 传给 `/api/chat`
- Lobe 右栏其它 tab（资源 / 文件 / review）、左栏 Task 列表
- 登录强制、跨设备同步、话题删除/置顶/搜索（可后续加，本期不做完整管理）

## 决策摘要

| 决策 | 选择 | 说明 |
|------|------|------|
| 路由 | Query：`/chat?agent=&topic=` | 刷新可恢复；避免改 path 结构 |
| 消息存储 | localStorage 按 topic 分桶 | 贴近后续 DB，仍无服务端 |
| 新话题 | 临时草稿 → 首条消息固化 | 对齐 LobeHub |
| 参数 | UI + store only | Phase 3 再透传 |
| 实现路径 | ChatLayout + 扩展 chatLocalStorage | 不提前接 DB |

## 布局

```text
┌──────────────┬────────────────────────────┬─────────────────┐
│ TopicSidebar │ ChatMain                   │ ParamsPanel     │
│ 可折叠       │ 现有消息 + 输入            │ 可折叠          │
│ 新话题       │                            │ 高级设置×4      │
│ 话题列表     │                            │                 │
└──────────────┴────────────────────────────┴─────────────────┘
```

- 路由仍为 `src/app/chat/page.tsx` → 渲染带 `ChatLayout` 的页面。
- 中栏复用 `ChatPage` / `ChatMessages` / `ChatInput`，按 `activeTopicId` 换桶。

## URL 与状态

| URL | 含义 |
|-----|------|
| `/chat` 或 `/chat?agent=x` | 临时草稿，`activeTopicId = null` |
| `/chat?agent=x&topic=y` | 正式话题 `y` |

双向同步（类似 Lobe `ChatHydration`，简化版）：

1. 读 `useSearchParams` → 设置 store 的 `activeAgent` / `activeTopicId`
2. 用户操作（新话题 / 点列表 / 草稿固化）→ `router.push` 更新 query

## 本地数据模型

### Topic 元数据

```ts
type LocalChatTopic = {
  id: string
  agentId: string
  title: string
  updatedAt: number // epoch ms
}
```

存储 key（建议）：`purechat:chat:v2:topics` → `LocalChatTopic[]`  
按 `agentId` 过滤显示当前助理的话题。

### 消息分桶

| 场景 | Storage key |
|------|-------------|
| 草稿 | `purechat:chat:v2:messages:{agentId}:draft` |
| 正式话题 | `purechat:chat:v2:messages:{agentId}:{topicId}` |

兼容：首次加载若 v2 桶为空且存在 v1 key `purechat:chat:v1:messages`，可一次性迁移到当前 agent 的 draft（可选，实现时按最小成本决定是否做）。

### LLM 参数（仅 UI）

```ts
type ChatLlmParams = {
  temperature: number | null
  top_p: number | null
  presence_penalty: number | null
  frequency_penalty: number | null
}
```

| UI 文案 | 字段 | 默认（启用时） | 范围 |
|---------|------|----------------|------|
| 创造力 | `temperature` | `1` | 0–2 |
| 开放性 | `top_p` | `1` | 0–1 |
| 词汇丰富度 | `presence_penalty` | `0` | -2–2 |
| 话题发散 | `frequency_penalty` | `0` | -2–2 |

`null` = 开关关闭（不参与后续 API；本期仅 UI）。  
持久化：chat UI store（可 persist 到 localStorage，按 agent 或全局均可；推荐 **agent 级** 与后续对齐）。

## 关键交互

### 开启新话题

1. `activeTopicId = null`
2. `router.push(/chat?agent=<current>)`（去掉 `topic`）
3. 加载 draft 桶（通常为空；若 draft 有未固化内容则显示之——**建议新话题时清空 draft 桶**，避免「新话题」仍看到旧草稿）

**明确行为**：点击「开启新话题」时清空当前 agent 的 draft 消息桶，保证空白会话。

### 点击列表项

1. `router.push(/chat?agent=&topic=)`
2. `useChat` 的 `id` 与 messages 切换到该桶

### 草稿首条消息固化

触发点：用户发送第一条消息（`handleSend` / pending 自动发送）且 `activeTopicId == null`：

1. 生成 `topicId`（uuid）
2. `title` = 用户文本截断（如 30 字）或「新话题」
3. 写入 topics 元数据
4. 将 draft 消息（含本条）写入正式桶；清空 draft
5. `router.replace(/chat?agent=&topic=新id)`（用 replace 避免历史栈堆草稿）

从 Home 带 `pending` 进入且无 `topic`：同样走固化流程。

### 面板折叠

- 左/右栏各一开关（头部或栏内）
- 折叠态写入 localStorage（如 `purechat:chat:v2:ui`）

## 组件拆分

```text
src/features/chat/
  ChatLayout.tsx          # 三栏壳
  TopicSidebar/
    index.tsx             # 新话题按钮 + 列表
    TopicList.tsx
    TopicItem.tsx
  ParamsPanel/
    index.tsx             # 高级设置四滑块
  store/
    useChatUiStore.ts     # 面板折叠、llm params、可选 activeTopicId 镜像
  chatLocalStorage.ts     # 扩展：分桶 messages + topics CRUD
  ChatPage.tsx            # 接入 layout、query hydration、固化逻辑
```

UI 栈：`@lobehub/ui` + `antd-style`，与现有 home/chat 一致。

## 与现有入口的衔接

| 入口 | Phase 1 行为 |
|------|----------------|
| `AgentSection` | 已有 `?agent=`；进入时无 `topic` → 草稿（可清空 draft 或保留，**建议进入时不自动清 draft，仅「新话题」清**） |
| `HomeChatInput` | pending text + `/chat`（可带 agent）→ 草稿发第一条后固化 |
| `AgentCard` | `clearMessages` 需改为清 draft / 或清当前桶；避免误清全部 v2 桶 |

## 测试要点

- Topic 列表 CRUD（本地）单元测试
- `loadMessages` / `saveMessages` 分桶 key
- 草稿固化后 URL 含 `topic` 且列表出现一项
- 切换 topic 消息不串
- `?agent=` 与 `?topic=` 同时存在时 hydration 正确

## 后续阶段（不在本文实现）

- **Phase 2**：`topics` / `messages` Drizzle schema + API，替换 localStorage
- **Phase 3**：ParamsPanel → `/api/chat` body 透传四个采样参数

## Spec 自检

- [x] 无 TBD/占位符未决项（新话题清 draft 已明确）
- [x] 与「只做 UI Shell」一致：无 DB、无 API 透传
- [x] 范围边界清晰（非目标列出）
- [x] 参数中文 ↔ 英文字段映射正确（创造力=temperature 等）
