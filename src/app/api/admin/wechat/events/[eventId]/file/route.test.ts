// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptCredentials: vi.fn(),
  downloadStoredWechatFile: vi.fn(),
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
  downloadStoredWechatFile: mocks.downloadStoredWechatFile,
  parseWechatFileContent: vi.fn(() => ({ file_name: 'report.txt', media: 'file-reference' })),
}))

import { GET } from './route'

const context = { params: Promise.resolve({ eventId: 'event-other' }) }

describe('GET /api/admin/wechat/events/[eventId]/file', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findEvent.mockResolvedValue({
      bindingId: 'binding-other',
      content: '{"file_name":"report.txt","media":"file-reference"}',
      id: 'event-other',
      messageKind: 'file',
      sessionId: 'session-other',
    })
    mocks.findBinding.mockResolvedValue({
      credentials: 'encrypted-other',
      id: 'binding-other',
      platform: 'wechat',
    })
    mocks.getSession.mockResolvedValue({ bindingId: 'binding-other', id: 'session-other' })
    mocks.decryptCredentials.mockReturnValue({ botId: 'bot-other', botToken: 'token-other' })
    mocks.downloadStoredWechatFile.mockResolvedValue({
      buffer: Buffer.from('report'),
      fileName: '报告.txt',
      mimeType: 'text/plain',
    })
  })

  it('allows an admin to view another account file through its real binding', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/wechat/events/event-other/file'),
      context
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get('Content-Type')).toBe('text/plain')
    expect(response.headers.get('Content-Disposition')).toContain('filename*=UTF-8')
    expect(mocks.findBinding).toHaveBeenCalledWith('binding-other')
    expect(mocks.decryptCredentials).toHaveBeenCalledWith('encrypted-other')
    expect(mocks.downloadStoredWechatFile).toHaveBeenCalledOnce()
  })

  it('rejects event-session binding mismatches before decrypting credentials', async () => {
    mocks.getSession.mockResolvedValueOnce({ bindingId: 'binding-third', id: 'session-other' })

    const response = await GET(
      new NextRequest('http://localhost/api/admin/wechat/events/event-other/file'),
      context
    )

    expect(response.status).toBe(404)
    expect(mocks.decryptCredentials).not.toHaveBeenCalled()
    expect(mocks.downloadStoredWechatFile).not.toHaveBeenCalled()
  })
})
