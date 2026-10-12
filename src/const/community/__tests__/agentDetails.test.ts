import { describe, expect, it } from 'vitest'

import { AssistantCategory } from '@/features/community/types'
import type { DiscoverAgentItem } from '@/features/community/types'

import { loadCommunityAgent } from '../agentDetails'
import { COMMUNITY_AGENTS } from '../agents'

describe('loadCommunityAgent', () => {
  it('keeps details out of the catalog and resolves complete data for every agent', async () => {
    expect(COMMUNITY_AGENTS.length).toBeGreaterThan(0)
    for (const summary of COMMUNITY_AGENTS) {
      expect(summary).not.toHaveProperty('systemRole')
      expect(summary).not.toHaveProperty('examples')
      const detail = await loadCommunityAgent(summary)
      expect(detail).toMatchObject(summary)
      expect(detail.systemRole.trim()).not.toBe('')
    }

    const academic = COMMUNITY_AGENTS.find((agent) => agent.identifier === 'academic-writing-assistant')!
    const detail = await loadCommunityAgent(academic)
    expect(detail.systemRole).toContain('你是大学的教授')
    expect(detail.examples?.[0].role).toBe('user')
    expect(detail.openingMessage).toContain('学术写作助手')
  })

  it('returns existing custom details without loading market data', async () => {
    const custom: DiscoverAgentItem = {
      author: '我',
      avatar: '🤖',
      category: AssistantCategory.Custom,
      createdAt: '',
      description: '',
      identifier: 'custom',
      title: 'My agent',
      systemRole: 'Custom instructions',
    }
    expect(await loadCommunityAgent(custom)).toBe(custom)
  })

  it('rejects a missing identifier or category instead of creating an agent without instructions', async () => {
    const summary = COMMUNITY_AGENTS[0]
    await expect(loadCommunityAgent({ ...summary, identifier: 'missing' })).rejects.toThrow('Unknown community agent:')
    await expect(loadCommunityAgent({ ...summary, category: AssistantCategory.Custom })).rejects.toThrow('category')
  })
})
