// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/libs/auth/get-session-user', () => {
  const getAuthenticatedUserId = vi.fn()

  return {
    getAuthenticatedUserId,
    jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
    unauthorizedResponse: () => Response.json({ error: 'Unauthorized' }, { status: 401 }),
    withAuth:
      (
        handler: (request: NextRequest, context: { params: Promise<Record<string, string>>; userId: string }) => unknown
      ) =>
      async (request: NextRequest, context?: { params?: Promise<Record<string, string>> }) => {
        const userId = await getAuthenticatedUserId()
        if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

        return handler(request, {
          params: context?.params ?? Promise.resolve({}),
          userId,
        })
      },
  }
})

vi.mock('@pure/database/models/chatTopic', () => ({
  ChatTopicModel: vi.fn(),
}))

import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { getAuthenticatedUserId } from '@/libs/auth/get-session-user'

import { DELETE, GET, POST } from './route'

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
      })
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
        }) as unknown as ChatTopicModel
    )

    const response = await GET(new NextRequest('http://localhost/api/chat/topics?agentId=agent-1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual(topics)
  })

  it('bulk deletes unfavorited topics for the authenticated user and agent', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')
    const deleteByAgent = vi.fn().mockResolvedValue([{ id: 'topic-1' }, { id: 'topic-2' }])
    vi.mocked(ChatTopicModel).mockImplementation(() => ({ deleteByAgent }) as unknown as ChatTopicModel)

    const response = await DELETE(
      new NextRequest('http://localhost/api/chat/topics?agentId=agent-1&scope=unfavorited', {
        method: 'DELETE',
      })
    )

    expect(response.status).toBe(200)
    expect(deleteByAgent).toHaveBeenCalledWith('agent-1', 'unfavorited')
    await expect(response.json()).resolves.toEqual({ deletedIds: ['topic-1', 'topic-2'] })
  })

  it('rejects an invalid bulk delete scope', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')

    const response = await DELETE(
      new NextRequest('http://localhost/api/chat/topics?agentId=agent-1&scope=invalid', { method: 'DELETE' })
    )

    expect(response.status).toBe(400)
  })
})
