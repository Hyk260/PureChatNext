// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { signWebhookResponse } from '@pure/chat-adapter/qq'

const mocks = vi.hoisted(() => ({
  authorizeQQInternalWebhook: vi.fn(),
  decryptCredentials: vi.fn(),
  findByApplicationId: vi.fn(),
  getOrCreateQQChat: vi.fn(),
  handleWebhook: vi.fn(),
  touchActive: vi.fn(),
}))

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByApplicationId = mocks.findByApplicationId
    touchActive = mocks.touchActive
  },
  QQ_PLATFORM: 'qq',
}))
vi.mock('@/libs/channels/qq/chatBot', () => ({ getOrCreateQQChat: mocks.getOrCreateQQChat }))
vi.mock('@/libs/channels/qq/encrypt', () => ({ decryptCredentials: mocks.decryptCredentials }))
vi.mock('@/libs/channels/qq/webhookAuth', () => ({
  authorizeQQInternalWebhook: mocks.authorizeQQInternalWebhook,
}))
vi.mock('@/libs/logger', () => ({ logger: { error: vi.fn() } }))

import { POST } from './route'

const context = { params: Promise.resolve({ applicationId: 'app-1' }) }
const createRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/channels/qq/webhook/app-1', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })

describe('POST /api/channels/qq/webhook/[applicationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByApplicationId.mockResolvedValue({
      agentId: 'agent-1',
      applicationId: 'app-1',
      credentials: 'encrypted-credentials',
      enabled: true,
      id: 'binding-1',
      model: 'gpt-5.4-mini',
      provider: 'openai',
      userId: 'user-1',
    })
    mocks.decryptCredentials.mockReturnValue({
      appId: 'qq-app-id',
      appSecret: 'qq-app-secret',
      connectionMode: 'webhook',
    })
    mocks.authorizeQQInternalWebhook.mockReturnValue(true)
    mocks.getOrCreateQQChat.mockResolvedValue({ webhooks: { qq: mocks.handleWebhook } })
    mocks.touchActive.mockResolvedValue(undefined)
  })

  it('signs an op=13 verification without initializing or touching the chat binding', async () => {
    const response = await POST(
      createRequest({ d: { event_ts: '1723987200', plain_token: 'plain-token' }, op: 13 }),
      context
    )

    expect(response.status).toBe(200)
    const data = (await response.json()) as { plain_token: string; signature: string }
    expect(data).toEqual({
      plain_token: 'plain-token',
      signature: signWebhookResponse('1723987200', 'plain-token', 'qq-app-secret'),
    })
    expect(data.signature).toMatch(/^[0-9a-f]{128}$/)
    expect(mocks.getOrCreateQQChat).not.toHaveBeenCalled()
    expect(mocks.touchActive).not.toHaveBeenCalled()
  })

  it('forwards the original unconsumed request for a normal dispatch', async () => {
    const payload = { d: { content: 'hello' }, id: 'event-1', op: 0, t: 'C2C_MESSAGE_CREATE' }
    const request = createRequest(payload)
    mocks.handleWebhook.mockImplementationOnce(async (forwardedRequest: NextRequest) =>
      Response.json({ payload: await forwardedRequest.json() })
    )

    const response = await POST(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ payload })
    expect(mocks.handleWebhook).toHaveBeenCalledWith(request, expect.any(Object))
    expect(mocks.touchActive).toHaveBeenCalledWith('binding-1')
  })
})
