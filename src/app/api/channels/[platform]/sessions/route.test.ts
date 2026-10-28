// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findByUserAndPlatform: vi.fn(),
  findVisibleById: vi.fn(),
  listSessionsByBinding: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), { headers: { 'Content-Type': 'application/json' }, status }),
  withAuth:
    (handler: (request: NextRequest, context: { params: Promise<{ platform: string }>; userId: string }) => unknown) =>
    (request: NextRequest, context: { params: Promise<{ platform: string }> }) =>
      handler(request, { ...context, userId: 'user-a' }),
}))
vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    findVisibleById = mocks.findVisibleById
  },
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
  },
}))
vi.mock('@pure/database/models/channelEvent', () => ({
  ChannelEventModel: class {
    listSessionsByBinding = mocks.listSessionsByBinding
  },
}))

import { GET } from './route'

describe('GET /api/channels/{platform}/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByUserAndPlatform.mockResolvedValue({ agentId: 'agent-a', id: 'binding-a' })
    mocks.findVisibleById.mockResolvedValue({ title: '我的助手' })
    mocks.listSessionsByBinding.mockResolvedValue([
      {
        activeAgentId: null,
        conversationVersion: 2,
        externalUserId: 'wx-contact-12345678',
        externalUserName: '联系人',
        id: 'session-a',
        lastActiveAt: new Date('2026-10-01T00:00:00.000Z'),
        threadType: null,
      },
    ])
  })

  it('queries only the current user binding and returns a read-only DTO', async () => {
    const request = new NextRequest('http://localhost/api/channels/wechat/sessions?userId=user-b')
    const response = await GET(request, { params: Promise.resolve({ platform: 'wechat' }) })
    const payload = (await response.json()) as { bound: boolean; sessions: Array<Record<string, unknown>> }

    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.findByUserAndPlatform).toHaveBeenCalledWith('user-a', 'wechat')
    expect(mocks.listSessionsByBinding).toHaveBeenCalledExactlyOnceWith('binding-a', 100)
    expect(payload.sessions[0]).toMatchObject({
      agentTitle: '我的助手',
      canSend: false,
      id: 'session-a',
      isOwnBinding: true,
    })
    expect(payload.sessions[0]?.externalUserId).toBe('wx-c…5678')
    expect(payload.sessions[0]).not.toHaveProperty('bindingId')
    expect(payload.sessions[0]).not.toHaveProperty('applicationId')
  })

  it('returns an empty state when the user has no binding', async () => {
    mocks.findByUserAndPlatform.mockResolvedValueOnce(null)

    const response = await GET(new NextRequest('http://localhost/api/channels/qq/sessions'), {
      params: Promise.resolve({ platform: 'qq' }),
    })

    expect(await response.json()).toEqual({ bound: false, sessions: [] })
    expect(mocks.listSessionsByBinding).not.toHaveBeenCalled()
  })

  it('rejects unknown platforms', async () => {
    const response = await GET(new NextRequest('http://localhost/api/channels/other/sessions'), {
      params: Promise.resolve({ platform: 'other' }),
    })

    expect(response.status).toBe(404)
    expect(mocks.findByUserAndPlatform).not.toHaveBeenCalled()
  })
})
