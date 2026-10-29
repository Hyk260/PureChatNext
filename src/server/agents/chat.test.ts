// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const queries = vi.hoisted(() => ({ agent: vi.fn(), topic: vi.fn() }))

vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    findVisibleById = queries.agent
  },
}))
vi.mock('@pure/database/models/chatTopic', () => ({
  ChatTopicModel: class {
    findById = queries.topic
  },
}))

import { resolveChatAgent } from './chat'

describe('resolveChatAgent', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    queries.agent.mockResolvedValue({ id: 'owned-agent', systemRole: 'current server prompt' })
    queries.topic.mockResolvedValue({ id: 'owned-topic', agentId: 'owned-agent' })
  })

  it('ignores client prompts for managed requests, including older clients sending only topicId', async () => {
    expect(await resolveChatAgent('owner', { agentId: 'owned-agent', system: 'cached prompt' })).toBe(
      'current server prompt'
    )
    expect(await resolveChatAgent('owner', { topicId: 'owned-topic', system: 'cached prompt' })).toBe(
      'current server prompt'
    )
    expect(queries.agent).toHaveBeenLastCalledWith('owned-agent')
    expect(await resolveChatAgent(null, { system: 'stateless prompt' })).toBe('stateless prompt')
  })

  it('requires authentication and validates ownership and agent/topic consistency', async () => {
    await expect(resolveChatAgent(null, { agentId: 'owned-agent' })).rejects.toMatchObject({ status: 401 })
    expect(queries.agent).not.toHaveBeenCalled()
    await expect(resolveChatAgent('owner', { agentId: '' })).rejects.toMatchObject({ status: 400 })
    await expect(resolveChatAgent('owner', { agentId: 'other-agent', topicId: 'owned-topic' })).rejects.toMatchObject({
      status: 400,
    })
    queries.topic.mockResolvedValue(undefined)
    await expect(resolveChatAgent('owner', { topicId: 'not-owned' })).rejects.toMatchObject({ status: 404 })
    queries.agent.mockResolvedValue(undefined)
    await expect(resolveChatAgent('owner', { agentId: 'not-owned' })).rejects.toMatchObject({ status: 404 })
  })
})
