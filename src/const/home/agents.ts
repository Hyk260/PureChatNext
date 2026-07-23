/** Pure AI 系统内置助理固定 id（对应 `agents.id`） */
export const PURE_AI_AGENT_ID = 'agt_inbox'

/** @deprecated 使用 PURE_AI_AGENT_ID */
export const DEFAULT_HOME_AGENT_ID = PURE_AI_AGENT_ID

export interface AgentListItem {
  avatar: string
  backgroundColor?: string | null
  description?: string | null
  id: string
  isBuiltin?: boolean
  pinned?: boolean | null
  slug?: string
  systemRole: string
  title: string
}

export const DEFAULT_PURE_AI_META: AgentListItem = {
  avatar: '✨',
  description: '你的默认 AI 助手',
  id: PURE_AI_AGENT_ID,
  isBuiltin: true,
  pinned: true,
  slug: 'inbox',
  systemRole: ['你是 Pure AI，一位友好、清晰、务实的助手。', '回答保持结构清楚、可执行；不确定时主动说明假设。'].join(
    '\n'
  ),
  title: 'Pure AI',
}
