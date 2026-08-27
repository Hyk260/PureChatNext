// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/libs/auth/get-session-user', () => {
  const getAuthenticatedUserId = vi.fn()
  return {
    getAuthenticatedUserId,
    jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
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

vi.mock('@pure/database/models/chatTopic', () => ({ ChatTopicModel: vi.fn() }))

import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { getAuthenticatedUserId } from '@/libs/auth/get-session-user'

import { PATCH } from './route'

const context = { params: Promise.resolve({ id: 'topic-1' }) }

describe('PATCH /api/chat/topics/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates favorite and normalizes a blank project name', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')
    const update = vi.fn().mockResolvedValue({ favorite: true, id: 'topic-1', projectName: null })
    vi.mocked(ChatTopicModel).mockImplementation(() => ({ update }) as unknown as ChatTopicModel)

    const response = await PATCH(
      new NextRequest('http://localhost/api/chat/topics/topic-1', {
        body: JSON.stringify({ favorite: true, projectName: '   ' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      context
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith('topic-1', { favorite: true, projectName: null })
  })

  it('trims project and title values', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')
    const update = vi.fn().mockResolvedValue({ id: 'topic-1' })
    vi.mocked(ChatTopicModel).mockImplementation(() => ({ update }) as unknown as ChatTopicModel)

    await PATCH(
      new NextRequest('http://localhost/api/chat/topics/topic-1', {
        body: JSON.stringify({ projectName: '  PureChat  ', title: '  新标题  ' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      context
    )

    expect(update).toHaveBeenCalledWith('topic-1', { projectName: 'PureChat', title: '新标题' })
  })

  it('updates a valid permission mode', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')
    const update = vi.fn().mockResolvedValue({ id: 'topic-1', permissionMode: 'ask' })
    vi.mocked(ChatTopicModel).mockImplementation(() => ({ update }) as unknown as ChatTopicModel)

    const response = await PATCH(
      new NextRequest('http://localhost/api/chat/topics/topic-1', {
        body: JSON.stringify({ permissionMode: 'ask' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      context
    )

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith('topic-1', { permissionMode: 'ask' })
  })

  it('rejects an invalid permission mode', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')

    const response = await PATCH(
      new NextRequest('http://localhost/api/chat/topics/topic-1', {
        body: JSON.stringify({ permissionMode: 'unsafe' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      context
    )

    expect(response.status).toBe(400)
  })

  it('rejects an empty patch', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')

    const response = await PATCH(
      new NextRequest('http://localhost/api/chat/topics/topic-1', {
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      context
    )

    expect(response.status).toBe(400)
  })

  it('returns 404 when the owned topic does not exist', async () => {
    vi.mocked(getAuthenticatedUserId).mockResolvedValue('user-1')
    const update = vi.fn().mockResolvedValue(undefined)
    vi.mocked(ChatTopicModel).mockImplementation(() => ({ update }) as unknown as ChatTopicModel)

    const response = await PATCH(
      new NextRequest('http://localhost/api/chat/topics/topic-1', {
        body: JSON.stringify({ favorite: true }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      }),
      context
    )

    expect(response.status).toBe(404)
  })
})
