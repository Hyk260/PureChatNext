// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPublicByShareId: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
}))
vi.mock('@pure/database/models/chatTopicShare', () => ({
  ChatTopicShareModel: { getPublicByShareId: mocks.getPublicByShareId },
}))

import { GET } from './route'

describe('/api/share/t/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns public share data for a valid share id', async () => {
    const share = { agent: { avatar: '✨', title: '助手' }, messages: [], shareId: 'yAu7JFlB', title: '测试话题' }
    mocks.getPublicByShareId.mockResolvedValue(share)

    const response = await GET(new NextRequest('http://localhost/api/share/t/yAu7JFlB'), {
      params: Promise.resolve({ id: 'yAu7JFlB' }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(share)
    expect(mocks.getPublicByShareId).toHaveBeenCalledWith('yAu7JFlB')
  })

  it('rejects malformed share ids before querying the database', async () => {
    const response = await GET(new NextRequest('http://localhost/api/share/t/short'), {
      params: Promise.resolve({ id: 'short' }),
    })

    expect(response.status).toBe(404)
    expect(mocks.getPublicByShareId).not.toHaveBeenCalled()
  })
})
