// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/libs/auth/get-session-user', () => ({
  getAuthenticatedUserId: vi.fn(),
  jsonError: (message: string, status = 400) =>
    Response.json({ error: message }, { status }),
  unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
}))

vi.mock('@/database/models/chatTopic', () => ({
  ChatTopicModel: vi.fn(),
}))

import { ChatTopicModel } from '@/database/models/chatTopic'
import { getAuthenticatedUserId } from '@/libs/auth/get-session-user'

import { GET, POST } from './route'

describe('/api/chat/topics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated on GET', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null)

    const response = await GET(new NextRequest('http://localhost/api/chat/topics?agentId=agent-1'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('returns 401 when unauthenticated on POST', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue(null)

    const response = await POST(
      new NextRequest('http://localhost/api/chat/topics', {
        body: JSON.stringify({ agentId: 'agent-1' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload.error).toBe('Unauthorized')
  })

  it('returns 400 when agentId query is missing', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')

    const response = await GET(new NextRequest('http://localhost/api/chat/topics'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toBe('agentId is required')
  })

  it('lists topics for agent when authenticated', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')
    const topics = [{ agentId: 'agent-1', id: 'topic-1', title: 'Test' }]
    vi.mocked(ChatTopicModel).mockImplementation(
      () =>
        ({
          listByAgent: vi.fn().mockResolvedValue(topics),
        }) as unknown as ChatTopicModel,
    )

    const response = await GET(new NextRequest('http://localhost/api/chat/topics?agentId=agent-1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual(topics)
  })
})
