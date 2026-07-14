# Chat v2 Phase 1 · UI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/chat` 加上可折叠的左话题栏与右高级参数栏；话题用 `?topic=` + localStorage 分桶切换；草稿首条消息后固化；参数仅存 UI store，不透传 API、不建库。

**Architecture:** `ChatLayout` 三栏壳包裹现有 `ChatView`；`chatLocalStorage` 升级为 v2 分桶（topics 元数据 + `messages:{agentId}:{topicId|draft}`）；`useChatUiStore` 管左右栏折叠与四个 LLM 参数；URL `?agent=&topic=` 与 store 双向同步；「新话题」清 draft，首条 `send` 时 `createTopicFromDraft` + `router.replace`。

**Tech Stack:** Next.js App Router、React 19、Zustand persist、`@lobehub/ui` + `antd-style`、Vitest、`@pure/utils`（`nanoid`）、现有 `@ai-sdk/react` `useChat`。

**Spec:** `docs/superpowers/specs/2026-07-14-chat-v2-ui-shell-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/features/chat/types.ts` | `LocalChatTopic`、`ChatLlmParams`、默认参数常量 |
| `src/features/chat/chatLocalStorage.ts` | v2 topics CRUD + 分桶 messages；保留 pending API；兼容/迁移 v1 |
| `src/features/chat/chatLocalStorage.test.ts` | 分桶与 topics 单测 |
| `src/features/chat/store/useChatUiStore.ts` | 左右栏折叠、`params`（agent 级）、persist |
| `src/features/chat/TopicSidebar/index.tsx` | 新话题按钮 + 列表容器 |
| `src/features/chat/TopicSidebar/TopicList.tsx` | 按 agent 过滤的 topic 列表 |
| `src/features/chat/TopicSidebar/TopicItem.tsx` | 单行 topic |
| `src/features/chat/ParamsPanel/index.tsx` | 高级设置四滑块 + 开关 |
| `src/features/chat/ChatLayout.tsx` | 三栏布局壳 |
| `src/features/chat/ChatPage.tsx` | hydration、分桶 load/save、草稿固化、套 Layout |
| `src/features/chat/index.ts` | 导出更新 |
| `src/features/home/HomeSidebar/sections/AgentSection.tsx` | 跳转 `/chat?agent=`（无 topic） |
| `src/features/community/components/AgentCard.tsx` | `clearMessages` → 清 draft 桶 |
| `src/features/home/components/HomeChatInput.tsx` | 确认清 draft / pending 仍进草稿 |

---

### Task 1: 类型与 localStorage 分桶（TDD）

**Files:**
- Create: `src/features/chat/types.ts`
- Modify: `src/features/chat/chatLocalStorage.ts`
- Modify: `src/features/chat/chatLocalStorage.test.ts`

- [ ] **Step 1: 写失败测试（分桶 + topics）**

在 `chatLocalStorage.test.ts` 追加（保留 pending 相关用例；旧的无参 `loadMessages`/`saveMessages` 测试改为带 `agentId`/`topicId`，或测新 API）：

```ts
import {
  CHAT_TOPICS_STORAGE_KEY,
  clearDraftMessages,
  createTopicFromDraft,
  loadMessages,
  loadTopics,
  messagesStorageKey,
  saveMessages,
  saveTopics,
  type LocalChatTopic,
} from './chatLocalStorage'

describe('chatLocalStorage v2 buckets', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('builds distinct keys for draft vs topic', () => {
    expect(messagesStorageKey('zen-master', null)).toBe(
      'purechat:chat:v2:messages:zen-master:draft',
    )
    expect(messagesStorageKey('zen-master', 't1')).toBe(
      'purechat:chat:v2:messages:zen-master:t1',
    )
  })

  it('isolates messages by topic bucket', () => {
    const draftMsg = [
      {
        id: 'd1',
        parts: [{ text: 'draft', type: 'text' as const }],
        role: 'user' as const,
      },
    ]
    const topicMsg = [
      {
        id: 't1',
        parts: [{ text: 'topic', type: 'text' as const }],
        role: 'user' as const,
      },
    ]
    saveMessages('zen-master', null, draftMsg)
    saveMessages('zen-master', 'topic-a', topicMsg)
    expect(loadMessages('zen-master', null)).toEqual(draftMsg)
    expect(loadMessages('zen-master', 'topic-a')).toEqual(topicMsg)
  })

  it('createTopicFromDraft moves draft messages and appends topic meta', () => {
    saveMessages('zen-master', null, [
      {
        id: 'm1',
        parts: [{ text: '你好世界这是一段很长的标题测试内容', type: 'text' as const }],
        role: 'user' as const,
      },
    ])
    const topic = createTopicFromDraft({
      agentId: 'zen-master',
      titleFrom: '你好世界这是一段很长的标题测试内容',
      topicId: 'fixed-topic-id',
    })
    expect(topic.id).toBe('fixed-topic-id')
    expect(topic.agentId).toBe('zen-master')
    expect(topic.title.length).toBeLessThanOrEqual(30)
    expect(loadMessages('zen-master', null)).toEqual([])
    expect(loadMessages('zen-master', 'fixed-topic-id')).toHaveLength(1)
    expect(loadTopics().some((t) => t.id === 'fixed-topic-id')).toBe(true)
  })

  it('clearDraftMessages only clears draft bucket', () => {
    saveMessages('zen-master', null, [
      {
        id: 'd1',
        parts: [{ text: 'x', type: 'text' as const }],
        role: 'user' as const,
      },
    ])
    saveMessages('zen-master', 'keep', [
      {
        id: 'k1',
        parts: [{ text: 'y', type: 'text' as const }],
        role: 'user' as const,
      },
    ])
    clearDraftMessages('zen-master')
    expect(loadMessages('zen-master', null)).toEqual([])
    expect(loadMessages('zen-master', 'keep')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm exec vitest run --silent='passed-only' 'src/features/chat/chatLocalStorage.test.ts'`  
Expected: FAIL（新 API 未定义）

- [ ] **Step 3: 实现 types + chatLocalStorage**

创建 `src/features/chat/types.ts`:

```ts
export type LocalChatTopic = {
  id: string
  agentId: string
  title: string
  updatedAt: number
}

export type ChatLlmParams = {
  temperature: number | null
  top_p: number | null
  presence_penalty: number | null
  frequency_penalty: number | null
}

export const DEFAULT_CHAT_LLM_PARAMS: ChatLlmParams = {
  temperature: 1,
  top_p: 1,
  presence_penalty: 0,
  frequency_penalty: 0,
}
```

重写/扩展 `chatLocalStorage.ts` 核心 API（保留 `setPendingChatText` / `claimPendingChatText` / `finishPendingChatText` 不变）：

```ts
import type { UIMessage } from 'ai'

import type { LocalChatTopic } from './types'

export type { LocalChatTopic } from './types'

export const CHAT_MESSAGES_STORAGE_KEY = 'purechat:chat:v1:messages' // legacy
export const CHAT_TOPICS_STORAGE_KEY = 'purechat:chat:v2:topics'
export const PENDING_CHAT_TEXT_KEY = 'purechat:chat:v1:pending-text'

export const messagesStorageKey = (agentId: string, topicId: string | null) =>
  `purechat:chat:v2:messages:${agentId}:${topicId ?? 'draft'}`

export const loadTopics = (): LocalChatTopic[] => { /* parse array from CHAT_TOPICS_STORAGE_KEY */ }
export const saveTopics = (topics: LocalChatTopic[]): void => { /* stringify */ }

export const loadMessages = (agentId: string, topicId: string | null): UIMessage[] => {
  // read messagesStorageKey; if empty && topicId===null && v1 key exists, migrate once to draft then remove v1
}

export const saveMessages = (
  agentId: string,
  topicId: string | null,
  messages: UIMessage[],
): void => { /* setItem messagesStorageKey */ }

export const clearDraftMessages = (agentId: string): void => {
  saveMessages(agentId, null, [])
}

/** @deprecated Prefer clearDraftMessages(agentId). Clears legacy v1 key only. */
export const clearMessages = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CHAT_MESSAGES_STORAGE_KEY)
  } catch {
    // ignore
  }
}

const truncateTitle = (text: string, max = 30) => {
  const t = text.trim() || '新话题'
  return t.length > max ? `${t.slice(0, max)}…` : t
}

export const createTopicFromDraft = (input: {
  agentId: string
  titleFrom: string
  topicId?: string
}): LocalChatTopic => {
  const id = input.topicId ?? crypto.randomUUID()
  const draft = loadMessages(input.agentId, null)
  const topic: LocalChatTopic = {
    id,
    agentId: input.agentId,
    title: truncateTitle(input.titleFrom),
    updatedAt: Date.now(),
  }
  saveMessages(input.agentId, id, draft)
  saveMessages(input.agentId, null, [])
  const next = [topic, ...loadTopics().filter((t) => t.id !== id)]
  saveTopics(next)
  return topic
}

export const touchTopic = (topicId: string): void => {
  saveTopics(
    loadTopics().map((t) =>
      t.id === topicId ? { ...t, updatedAt: Date.now() } : t,
    ),
  )
}

export const listTopicsForAgent = (agentId: string): LocalChatTopic[] =>
  loadTopics()
    .filter((t) => t.agentId === agentId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm exec vitest run --silent='passed-only' 'src/features/chat/chatLocalStorage.test.ts'`  
Expected: PASS（同步更新旧用例签名：`loadMessages()` → `loadMessages('a', null)` 等，或删除仅测 v1 无参 API 的用例）

- [ ] **Step 5: Commit（仅当用户要求时）**

```bash
git add src/features/chat/types.ts src/features/chat/chatLocalStorage.ts src/features/chat/chatLocalStorage.test.ts
git commit -m "$(cat <<'EOF'
feat(chat): v2 localStorage 按 topic 分桶

EOF
)"
```

---

### Task 2: `useChatUiStore`

**Files:**
- Create: `src/features/chat/store/useChatUiStore.ts`

- [ ] **Step 1: 实现 store**

```ts
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  DEFAULT_CHAT_LLM_PARAMS,
  type ChatLlmParams,
} from '@/features/chat/types'

type ChatUiState = {
  leftCollapsed: boolean
  rightCollapsed: boolean
  /** agentId → params */
  paramsByAgent: Record<string, ChatLlmParams>
  toggleLeftCollapsed: () => void
  toggleRightCollapsed: () => void
  setLeftCollapsed: (v: boolean) => void
  setRightCollapsed: (v: boolean) => void
  getParams: (agentId: string) => ChatLlmParams
  setParams: (agentId: string, patch: Partial<ChatLlmParams>) => void
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set, get) => ({
      leftCollapsed: false,
      rightCollapsed: false,
      paramsByAgent: {},
      toggleLeftCollapsed: () => set((s) => ({ leftCollapsed: !s.leftCollapsed })),
      toggleRightCollapsed: () => set((s) => ({ rightCollapsed: !s.rightCollapsed })),
      setLeftCollapsed: (leftCollapsed) => set({ leftCollapsed }),
      setRightCollapsed: (rightCollapsed) => set({ rightCollapsed }),
      getParams: (agentId) => get().paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS,
      setParams: (agentId, patch) =>
        set((s) => ({
          paramsByAgent: {
            ...s.paramsByAgent,
            [agentId]: {
              ...(s.paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS),
              ...patch,
            },
          },
        })),
    }),
    { name: 'purechat:chat:v2:ui', version: 1 },
  ),
)
```

注意：`getParams` 在 persist 选择器里不宜直接当 selector 用；组件内用：

```ts
const params = useChatUiStore((s) => s.paramsByAgent[agentId] ?? DEFAULT_CHAT_LLM_PARAMS)
```

- [ ] **Step 2: Commit（仅当用户要求时）**

```bash
git add src/features/chat/store/useChatUiStore.ts
git commit -m "$(cat <<'EOF'
feat(chat): 添加 chat UI store（面板折叠与 LLM 参数）

EOF
)"
```

---

### Task 3: TopicSidebar

**Files:**
- Create: `src/features/chat/TopicSidebar/TopicItem.tsx`
- Create: `src/features/chat/TopicSidebar/TopicList.tsx`
- Create: `src/features/chat/TopicSidebar/index.tsx`

- [ ] **Step 1: TopicItem**

```tsx
'use client'

import { Block, Text } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { memo } from 'react'

import type { LocalChatTopic } from '@/features/chat/types'

const styles = createStaticStyles(({ css }) => ({
  item: css`
    cursor: pointer;
    user-select: none;
  `,
}))

type Props = {
  active: boolean
  topic: LocalChatTopic
  onSelect: (topicId: string) => void
}

const TopicItem = memo<Props>(({ active, topic, onSelect }) => (
  <Block
    className={styles.item}
    paddingBlock={8}
    paddingInline={10}
    variant={active ? 'filled' : 'borderless'}
    onClick={() => onSelect(topic.id)}
  >
    <Text ellipsis={{ tooltipWhenOverflow: true }} color={active ? cssVar.colorText : cssVar.colorTextSecondary}>
      {topic.title}
    </Text>
  </Block>
))

TopicItem.displayName = 'TopicItem'
export default TopicItem
```

- [ ] **Step 2: TopicList + Sidebar index**

`TopicList.tsx`：接收 `topics`、`activeTopicId`、`onSelect`。

`index.tsx`：

```tsx
'use client'

import { Button, Flexbox, Text } from '@lobehub/ui'
import { MessageSquarePlus } from 'lucide-react'
import { memo } from 'react'

import TopicList from './TopicList'
import type { LocalChatTopic } from '@/features/chat/types'

type Props = {
  topics: LocalChatTopic[]
  activeTopicId: string | null
  onNewTopic: () => void
  onSelectTopic: (topicId: string) => void
}

const TopicSidebar = memo<Props>(({ topics, activeTopicId, onNewTopic, onSelectTopic }) => (
  <Flexbox gap={8} height="100%" padding={12} style={{ minWidth: 220 }}>
    <Button block icon={MessageSquarePlus} onClick={onNewTopic}>
      开启新话题
    </Button>
    <Text fontSize={12} type="secondary" weight={500}>
      话题
    </Text>
    <TopicList activeTopicId={activeTopicId} topics={topics} onSelect={onSelectTopic} />
  </Flexbox>
))

TopicSidebar.displayName = 'TopicSidebar'
export default TopicSidebar
```

（若 `Button` 的 `icon` API 与当前 `@lobehub/ui` 不一致，改为 `ActionIcon` + 文字 `Flexbox`，与仓库现有用法对齐。）

- [ ] **Step 3: Commit（仅当用户要求时）**

---

### Task 4: ParamsPanel

**Files:**
- Create: `src/features/chat/ParamsPanel/index.tsx`

- [ ] **Step 1: 实现四参数 UI**

使用 `antd` `Slider` + `Switch`（项目已有 antd）：

```tsx
'use client'

import { Flexbox, Text } from '@lobehub/ui'
import { Slider, Switch } from 'antd'
import { memo } from 'react'

import { DEFAULT_CHAT_LLM_PARAMS, type ChatLlmParams } from '@/features/chat/types'

type ParamKey = keyof ChatLlmParams

const ROWS: { key: ParamKey; label: string; min: number; max: number; step: number }[] = [
  { key: 'temperature', label: '创造力', min: 0, max: 2, step: 0.1 },
  { key: 'top_p', label: '开放性', min: 0, max: 1, step: 0.1 },
  { key: 'presence_penalty', label: '词汇丰富度', min: -2, max: 2, step: 0.1 },
  { key: 'frequency_penalty', label: '话题发散', min: -2, max: 2, step: 0.1 },
]

type Props = {
  value: ChatLlmParams
  onChange: (patch: Partial<ChatLlmParams>) => void
}

const ParamsPanel = memo<Props>(({ value, onChange }) => (
  <Flexbox gap={16} padding={16} style={{ minWidth: 260 }}>
    <Text weight={500}>高级设置</Text>
    {ROWS.map((row) => {
      const enabled = value[row.key] !== null
      const display = value[row.key] ?? DEFAULT_CHAT_LLM_PARAMS[row.key]!
      return (
        <Flexbox key={row.key} gap={8}>
          <Flexbox horizontal align="center" justify="space-between">
            <Flexbox horizontal align="center" gap={8}>
              <Text>{row.label}</Text>
              <Switch
                checked={enabled}
                size="small"
                onChange={(checked) =>
                  onChange({
                    [row.key]: checked ? DEFAULT_CHAT_LLM_PARAMS[row.key] : null,
                  })
                }
              />
            </Flexbox>
            <Text type="secondary">{enabled ? Number(display).toFixed(1) : '—'}</Text>
          </Flexbox>
          <Slider
            disabled={!enabled}
            max={row.max}
            min={row.min}
            step={row.step}
            value={Number(display)}
            onChange={(v) => onChange({ [row.key]: v })}
          />
        </Flexbox>
      )
    })}
  </Flexbox>
))

ParamsPanel.displayName = 'ParamsPanel'
export default ParamsPanel
```

本期：**不要**把 `value` 写入 `/api/chat` body。

- [ ] **Step 2: Commit（仅当用户要求时）**

---

### Task 5: ChatLayout

**Files:**
- Create: `src/features/chat/ChatLayout.tsx`

- [ ] **Step 1: 三栏壳**

```tsx
'use client'

import { ActionIcon, Flexbox } from '@lobehub/ui'
import { createStaticStyles, cssVar } from 'antd-style'
import { PanelLeft, PanelRight } from 'lucide-react'
import { memo, type ReactNode } from 'react'

import { useChatUiStore } from '@/features/chat/store/useChatUiStore'

const styles = createStaticStyles(({ css }) => ({
  left: css`
    flex: none;
    width: 260px;
    height: 100dvh;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
    overflow: auto;
  `,
  main: css`
    flex: 1;
    min-width: 0;
    height: 100dvh;
    position: relative;
  `,
  right: css`
    flex: none;
    width: 320px;
    height: 100dvh;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
    overflow: auto;
  `,
  toggles: css`
    position: absolute;
    inset-block-start: 12px;
    inset-inline-end: 12px;
    z-index: 2;
  `,
}))

type Props = {
  left: ReactNode
  right: ReactNode
  children: ReactNode
}

const ChatLayout = memo<Props>(({ left, right, children }) => {
  const leftCollapsed = useChatUiStore((s) => s.leftCollapsed)
  const rightCollapsed = useChatUiStore((s) => s.rightCollapsed)
  const toggleLeftCollapsed = useChatUiStore((s) => s.toggleLeftCollapsed)
  const toggleRightCollapsed = useChatUiStore((s) => s.toggleRightCollapsed)

  return (
    <Flexbox horizontal height="100dvh" width="100%">
      {!leftCollapsed ? <aside className={styles.left}>{left}</aside> : null}
      <div className={styles.main}>
        <Flexbox horizontal className={styles.toggles} gap={4}>
          <ActionIcon
            icon={PanelLeft}
            title={leftCollapsed ? '展开话题栏' : '折叠话题栏'}
            onClick={toggleLeftCollapsed}
          />
          <ActionIcon
            icon={PanelRight}
            title={rightCollapsed ? '展开参数栏' : '折叠参数栏'}
            onClick={toggleRightCollapsed}
          />
        </Flexbox>
        {children}
      </div>
      {!rightCollapsed ? <aside className={styles.right}>{right}</aside> : null}
    </Flexbox>
  )
})

ChatLayout.displayName = 'ChatLayout'
export default ChatLayout
```

- [ ] **Step 2: Commit（仅当用户要求时）**

---

### Task 6: 接线 ChatPage（核心）

**Files:**
- Modify: `src/features/chat/ChatPage.tsx`
- Modify: `src/features/chat/index.ts`

- [ ] **Step 1: 改造 ChatPage**

要点（实现时按现有文件结构改，勿整文件盲贴）：

1. `topicFromQuery = searchParams.get('topic')`
2. `agentId = activeAgent?.identifier ?? selectedAgentId`
3. `useChat({ id: \`purechat-${agentId}-${topicFromQuery ?? 'draft'}\`, messages: loadMessages(agentId, topicFromQuery) })`  
   — hydration 后挂载；`agent`/`topic` 变化时 remount：给 `ChatView` 加 `key={\`${agentId}:${topicFromQuery ?? 'draft'}\`}`
4. `saveMessages(agentId, topicFromQuery, messages)`（debounce 逻辑保留）
5. `handleSend` / pending 自动发送前：若 `!topicFromQuery`，先  
   `const topic = createTopicFromDraft({ agentId, titleFrom: text })`  
   再 `router.replace(\`/chat?agent=${encodeURIComponent(agentId)}&topic=${encodeURIComponent(topic.id)}\`)`  
   注意：replace 后组件会因 key 变化 remount；需保证消息已写入正式桶，remount 后 `loadMessages` 能读到（含刚发送的 user 消息策略二选一）：
   - **推荐**：固化时只迁「已有 draft」；本条仍由 remount 后的 `useChat` + 紧接的 `sendMessage` 写入——更稳妥做法是 **先 `sendMessage`，在 messages 首次含 user 时再固化并 replace**（见下）。
6. **固化时机（推荐实现）**：  
   - 草稿下 `handleSend(text)`：  
     a. `createTopicFromDraft`（此时 draft 可能仍空）创建 topic，title 用 `text`  
     b. `router.replace` 带新 topic  
     c. 因 key 变化 remount 后，用 `pending` 或 ref 把 `text` 再 `sendMessage` 一次  
   - 更简单：固化不依赖 draft 内容——`createTopicFromDraft` 允许 draft 为空，创建空 topic；replace 后立刻 `sendMessage(text)`（同一 tick 用 sessionStorage 暂存「刚创建的 topic 待发送文本」，类似现有 pending）。

实现辅助：

```ts
// chatLocalStorage.ts 可复用 PENDING，或新增：
export const setPendingTopicSend = (text: string) => { /* sessionStorage */ }
export const claimPendingTopicSend = (): string | null => { /* once */ }
```

流程：`handleSend` in draft → `createTopicFromDraft` → `setPendingTopicSend(text)` → `router.replace(...)` → remount → `claimPendingTopicSend` → `sendMessage`。

7. 「开启新话题」：`clearDraftMessages(agentId)` → `router.push(\`/chat?agent=${agentId}\`)`
8. 选话题：`router.push(\`/chat?agent=${agentId}&topic=${id}\`)`
9. 用 `ChatLayout` 包中栏；左 `TopicSidebar`（`listTopicsForAgent(agentId)`，可用 `useSyncExternalStore` 或本地 `useState`+storage 事件刷新；最简：在 topic 变更后 `setTopicsTick`）；右 `ParamsPanel` 绑 `useChatUiStore`
10. 中栏 `styles.page` 的 `max-width` 可保留居中

`topics` 列表刷新：在 `createTopicFromDraft` / `onNewTopic` / 挂载时 `setTopics(listTopicsForAgent(agentId))`。

- [ ] **Step 2: 更新 `index.ts` 导出**

导出 `ChatLayout`、`listTopicsForAgent`、`messagesStorageKey` 等按需；保持 pending helpers。

- [ ] **Step 3: 手动冒烟（本机）**

1. 打开 `/chat?agent=zen-master` → 左右栏可见  
2. 发一条消息 → URL 出现 `topic=`，左侧列表多项  
3. 「开启新话题」→ URL 无 topic，消息区空  
4. 点回旧 topic → 消息恢复  
5. 刷新页面 → 当前 topic 与消息仍在  
6. 调右栏滑块 → 刷新后参数仍在；Network 里 `/api/chat` body **无** temperature 等字段  

- [ ] **Step 4: Commit（仅当用户要求时）**

---

### Task 7: 入口调用方适配

**Files:**
- Modify: `src/features/home/HomeSidebar/sections/AgentSection.tsx`
- Modify: `src/features/community/components/AgentCard.tsx`
- Modify: `src/features/home/components/HomeChatInput.tsx`

- [ ] **Step 1: AgentSection**

保持 `router.push(\`/chat?agent=${id}\`)`；将 `clearMessages()` 改为：

```ts
import { clearDraftMessages } from '@/features/chat/chatLocalStorage'
// ...
clearDraftMessages(agent.id)
```

- [ ] **Step 2: AgentCard**

```ts
clearDraftMessages(identifier)
router.push(`/chat?agent=${encodeURIComponent(identifier)}`)
```

- [ ] **Step 3: HomeChatInput**

发送前 `clearDraftMessages(selectedAgentId)`（或不清，按 product：spec 写 Home 进入不清 draft，仅新话题清——则 **删除** 这里的 clear，只 `setPending` + push `/chat?agent=`）。

按 spec：**HomeChatInput 不要 clearDraft**；仅 push + pending。

- [ ] **Step 4: 跑相关测试**

Run: `pnpm exec vitest run --silent='passed-only' 'src/features/chat/chatLocalStorage.test.ts'`  
Expected: PASS

- [ ] **Step 5: Commit（仅当用户要求时）**

---

## Spec coverage 自检

| Spec 项 | Task |
|---------|------|
| F1 三栏 + 折叠 | Task 2, 5, 6 |
| F2 新话题草稿 | Task 6 Step 1 点 7 |
| F3 列表切换 | Task 3, 6 |
| F4 草稿固化 | Task 1 `createTopicFromDraft` + Task 6 pending-topic-send |
| F5 分桶 | Task 1 |
| F6 参数 UI 不透传 | Task 4, 6（body 不加 params） |
| F7 `?agent=` | 现有 + Task 6/7 |
| 非目标 DB/API params | 全计划未包含 |

## Placeholder 扫描

无 TBD；固化 remount 竞态用 `setPendingTopicSend` 写死策略。

## 类型一致性

- `LocalChatTopic` / `ChatLlmParams` 定义在 `types.ts`，storage 与 UI 共用。
- `loadMessages(agentId, topicId)` / `saveMessages(agentId, topicId, messages)` 签名在 Task 1 固定，后续任务不得改回无参。

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-07-14-chat-v2-ui-shell.md`.

**两种执行方式：**

1. **Subagent-Driven（推荐）** — 每任务新开子 agent，任务间复查  
2. **Inline Execution** — 本会话按 executing-plans 连续做，设检查点  

选哪种？
