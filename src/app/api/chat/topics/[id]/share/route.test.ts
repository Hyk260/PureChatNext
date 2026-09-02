// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { params: Promise<{ id: string }>; userId: string }) => Promise<Response>) =>
    (request: NextRequest, context?: { params: Promise<{ id: string }> }) =>
      handler(request, { params: context?.params ?? Promise.resolve({ id: 'topic-1' }), userId: 'user-1' }),
}))
vi.mock('@pure/database/models/chatTopicShare', () => ({
  ChatTopicShareModel: class {
    create = mocks.create
  },
}))

import { POST } from './route'

describe('/api/chat/topics/[id]/share', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.create.mockResolvedValue({ id: 'yAu7JFlB' })
  })

  it('creates a share and returns its short id', async () => {
    const response = await POST(new NextRequest('http://localhost/api/chat/topics/topic-1/share', { method: 'POST' }), {
      params: Promise.resolve({ id: 'topic-1' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ shareId: 'yAu7JFlB' })
    expect(mocks.create).toHaveBeenCalledWith('topic-1')
  })

  it('returns not found for an inaccessible topic', async () => {
    mocks.create.mockResolvedValue(undefined)

    const response = await POST(new NextRequest('http://localhost/api/chat/topics/missing/share', { method: 'POST' }), {
      params: Promise.resolve({ id: 'missing' }),
    })

    expect(response.status).toBe(404)
  })
})
