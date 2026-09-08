import { describe, expect, it } from 'vitest'

import type { AgentListItem } from '@/const/home/agents'
import { DEFAULT_PURE_AI_META } from '@/const/home/agents'
import { AssistantCategory } from '@/features/community/types'

import { countCustomAgents, filterCustomAgents, isCustomUserAgent, toDiscoverAgentFromListItem } from './customAgents'

const customAgent: AgentListItem = {
  avatar: '🧪',
  description: '本地写作助手',
  id: 'agt_custom',
  isBuiltin: false,
  slug: 'writer',
  systemRole: 'You write well.',
  title: '写作助手',
}

const marketAgent: AgentListItem = {
  avatar: '📦',
  description: '从市场添加',
  id: 'agt_market',
  isBuiltin: false,
  marketIdentifier: 'lobehub/writer',
  slug: 'market-writer',
  systemRole: 'Market copy',
  title: '市场写作',
}

describe('isCustomUserAgent', () => {
  it('accepts user-created agents only', () => {
    expect(isCustomUserAgent(customAgent)).toBe(true)
    expect(isCustomUserAgent(DEFAULT_PURE_AI_META)).toBe(false)
    expect(isCustomUserAgent(marketAgent)).toBe(false)
  })
})

describe('filterCustomAgents', () => {
  const agents = [DEFAULT_PURE_AI_META, customAgent, marketAgent]

  it('drops builtin and market-added agents', () => {
    expect(filterCustomAgents(agents)).toEqual([customAgent])
  })

  it('filters by title, description or slug', () => {
    expect(filterCustomAgents(agents, '写作助手')).toEqual([customAgent])
    expect(filterCustomAgents(agents, '本地写作')).toEqual([customAgent])
    expect(filterCustomAgents(agents, 'writer')).toEqual([customAgent])
    expect(filterCustomAgents(agents, '市场')).toEqual([])
  })
})

describe('countCustomAgents', () => {
  it('counts only custom agents', () => {
    expect(countCustomAgents([DEFAULT_PURE_AI_META, customAgent, marketAgent])).toBe(1)
  })
})

describe('toDiscoverAgentFromListItem', () => {
  it('maps a custom agent into the shared detail shape', () => {
    const mapped = toDiscoverAgentFromListItem({
      ...customAgent,
      openingMessage: '  你好  ',
      openingQuestions: ['问什么', '', '再问'],
    })

    expect(mapped).toMatchObject({
      author: '我',
      category: AssistantCategory.Custom,
      description: '本地写作助手',
      identifier: 'agt_custom',
      openingMessage: '你好',
      openingQuestions: ['问什么', '再问'],
      title: '写作助手',
    })
  })
})
