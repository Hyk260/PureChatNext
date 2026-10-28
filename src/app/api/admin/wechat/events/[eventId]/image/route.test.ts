// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptCredentials: vi.fn(),
  downloadStoredWechatImage: vi.fn(),
  findBinding: vi.fn(),
  findEvent: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('@pure/chat-adapter/wechat', () => ({ WechatApiClient: class {} }))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findById = mocks.findBinding
  },
  WECHAT_PLATFORM: 'wechat',
}))
vi.mock('@pure/database/models/channelEvent', () => ({
  ChannelEventModel: class {
    findById = mocks.findEvent
    getSession = mocks.getSession
  },
}))
vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) =>
    new Response(JSON.stringify({ error: message }), { headers: { 'Content-Type': 'application/json' }, status }),
  withAdmin:
    (handler: (request: NextRequest, context: { params: Promise<{ eventId: string }> }) => unknown) =>
    (request: NextRequest, context: { params: Promise<{ eventId: string }> }) => handler(request, context),
}))
vi.mock('@/libs/channels/wechat/encrypt', () => ({ decryptCredentials: mocks.decryptCredentials }))
vi.mock('@/libs/channels/wechat/inboundMedia', () => ({
  downloadStoredWechatImage: mocks.downloadStoredWechatImage,
  parseWechatImageContent: vi.fn(() => ({ media: 'image-reference' })),
}))

import { GET } from './route'

const context = { params: Promise.resolve({ eventId: 'event-other' }) }

describe('GET /api/admin/wechat/events/[eventId]/image', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findEvent.mockResolvedValue({
      bindingId: 'binding-other',
      content: '{"media":"image-reference"}',
      id: 'event-other',
      messageKind: 'image',
      sessionId: 'session-other',
    })
    mocks.findBinding.mockResolvedValue({
      credentials: 'encrypted-other',
      id: 'binding-other',
      platform: 'wechat',
    })
    mocks.getSession.mockResolvedValue({ bindingId: 'binding-other', id: 'session-other' })
    mocks.decryptCredentials.mockReturnValue({ botId: 'bot-other', botToken: 'token-other' })
    mocks.downloadStoredWechatImage.mockResolvedValue({ buffer: Buffer.from('image'), mimeType: 'image/png' })
  })

  it('allows an admin to view media from another account through its real binding', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/wechat/events/event-other/image'),
      context
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(mocks.findBinding).toHaveBeenCalledWith('binding-other')
    expect(mocks.decryptCredentials).toHaveBeenCalledWith('encrypted-other')
    expect(mocks.downloadStoredWechatImage).toHaveBeenCalledOnce()
  })

  it('rejects event-session binding mismatches before decrypting credentials', async () => {
    mocks.getSession.mockResolvedValueOnce({ bindingId: 'binding-third', id: 'session-other' })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/wechat/events/event-other/image'),
      context
    )

    expect(response.status).toBe(404)
    expect(mocks.decryptCredentials).not.toHaveBeenCalled()
    expect(mocks.downloadStoredWechatImage).not.toHaveBeenCalled()
  })
})
