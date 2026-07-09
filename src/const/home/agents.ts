export interface HomeAgentItem {
  avatar: string
  backgroundColor?: string
  description?: string
  id: string
  title: string
}

export const HOME_AGENTS: HomeAgentItem[] = [
  {
    avatar: '🧘',
    description: '继续前行吧 听候差遣',
    id: 'zen-master',
    title: '禅定法师',
  },
  {
    avatar: '📝',
    description: '专注写作与文稿整理',
    id: 'writer',
    title: '写作助理',
  },
]

export const DEFAULT_HOME_AGENT_ID = HOME_AGENTS[0].id

export const findHomeAgent = (agentId: string) =>
  HOME_AGENTS.find((item) => item.id === agentId) ?? HOME_AGENTS[0]
