// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findByUserAndPlatform: vi.fn(),
  findVisibleById: vi.fn(),
  expandQQEventsToMessages: vi.fn(),
  expandEventsToMessages: vi.fn(),
  listTimelineBySession: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), { headers: { 'Content-Type': 'application/json' }, status }),
  withAuth:
    (
      handler: (
        request: NextRequest,
        context: { params: Promise<{ platform: string; sessionId: string }>; userId: string }
      ) => unknown
    ) =>
    (request: NextRequest, context: { params: Promise<{ platform: string; sessionId: string }> }) =>
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
    listTimelineBySession = mocks.listTimelineBySession
  },
}))
vi.mock('@/libs/channels/qq/timeline', () => ({ expandQQEventsToMessages: mocks.expandQQEventsToMessages }))
vi.mock('@/libs/channels/wechat/timeline', () => ({ expandEventsToMessages: mocks.expandEventsToMessages }))

import { GET } from './route'

const context = { params: Promise.resolve({ platform: 'qq', sessionId: 'session-a' }) }

describe('GET /api/channels/{platform}/sessions/{sessionId}/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByUserAndPlatform.mockResolvedValue({ agentId: 'agent-a', id: 'binding-a' })
    mocks.findVisibleById.mockResolvedValue({ title: '我的助手' })
    mocks.expandQQEventsToMessages.mockReturnValue([{ id: 'message-a', text: 'private' }])
    mocks.listTimelineBySession.mockResolvedValue({
      events: [{ createdAt: new Date('2026-10-01T00:00:00.000Z'), id: 'event-a' }],
      session: {
        activeAgentId: null,
        bindingId: 'binding-a',
        conversationVersion: 1,
        externalUserId: 'qq:c2c:contact-12345678',
        externalUserName: '联系人',
        id: 'session-a',
        lastActiveAt: new Date('2026-10-01T00:00:00.000Z'),
        threadType: 'c2c',
      },
    })
  })

  it('constrains the session and timeline query to the authenticated binding', async () => {
    const request = new NextRequest(
      'http://localhost/api/channels/qq/sessions/session-a/messages?watchEventId=other-event'
    )
    const response = await GET(request, context)
    const payload = (await response.json()) as { messages: unknown[]; session: Record<string, unknown> }

    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.listTimelineBySession).toHaveBeenCalledWith(
      'session-a',
      expect.objectContaining({ bindingId: 'binding-a', watchEventIds: ['other-event'] })
    )
    expect(mocks.expandQQEventsToMessages).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ includeRemoteUrls: false })
    )
    expect(payload.session).toMatchObject({ agentTitle: '我的助手', canSend: false, id: 'session-a' })
    expect(payload.session.externalUserId).toBe('qq:c2c:cont…5678')
    expect(payload.session).not.toHaveProperty('bindingId')
    expect(payload.session).not.toHaveProperty('applicationId')
  })

  it('returns the same not-found response for a foreign session', async () => {
    mocks.listTimelineBySession.mockResolvedValueOnce(null)

    const response = await GET(new NextRequest('http://localhost/api/channels/qq/sessions/foreign/messages'), context)

    expect(response.status).toBe(404)
    expect(mocks.findVisibleById).not.toHaveBeenCalled()
    expect(mocks.expandQQEventsToMessages).not.toHaveBeenCalled()
  })
})
