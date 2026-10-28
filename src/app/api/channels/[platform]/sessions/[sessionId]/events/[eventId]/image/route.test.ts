// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptCredentials: vi.fn(),
  downloadStoredWechatImage: vi.fn(),
  findByUserAndPlatform: vi.fn(),
  findMediaEventBySessionAndBinding: vi.fn(),
  getSessionByBinding: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), { headers: { 'Content-Type': 'application/json' }, status }),
  withAuth:
    (
      handler: (
        request: NextRequest,
        context: { params: Promise<{ platform: string; sessionId: string; eventId: string }>; userId: string }
      ) => unknown
    ) =>
    (request: NextRequest, context: { params: Promise<{ platform: string; sessionId: string; eventId: string }> }) =>
      handler(request, { ...context, userId: 'user-a' }),
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
  },
}))
vi.mock('@pure/database/models/channelEvent', () => ({
  ChannelEventModel: class {
    findMediaEventBySessionAndBinding = mocks.findMediaEventBySessionAndBinding
    getSessionByBinding = mocks.getSessionByBinding
  },
}))
vi.mock('@pure/chat-adapter/wechat', () => ({ WechatApiClient: class {} }))
vi.mock('@/libs/channels/wechat/encrypt', () => ({ decryptCredentials: mocks.decryptCredentials }))
vi.mock('@/libs/channels/wechat/inboundMedia', () => ({
  downloadStoredWechatImage: mocks.downloadStoredWechatImage,
  parseWechatImageContent: vi.fn((content: string) => ({ content })),
}))

import { GET } from './route'

const context = { params: Promise.resolve({ eventId: 'event-b', platform: 'wechat', sessionId: 'session-a' }) }

describe('GET personal WeChat image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByUserAndPlatform.mockResolvedValue({ credentials: 'encrypted', id: 'binding-a' })
    mocks.getSessionByBinding.mockResolvedValue({ bindingId: 'binding-a', id: 'session-a' })
    mocks.findMediaEventBySessionAndBinding.mockResolvedValue(null)
  })

  it('does not download an event outside the authorized session and binding', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/channels/wechat/sessions/session-a/events/event-b/image'),
      context
    )

    expect(response.status).toBe(404)
    expect(mocks.getSessionByBinding).toHaveBeenCalledWith('session-a', 'binding-a')
    expect(mocks.findMediaEventBySessionAndBinding).toHaveBeenCalledWith('event-b', 'session-a', 'binding-a')
    expect(mocks.decryptCredentials).not.toHaveBeenCalled()
    expect(mocks.downloadStoredWechatImage).not.toHaveBeenCalled()
  })
})
