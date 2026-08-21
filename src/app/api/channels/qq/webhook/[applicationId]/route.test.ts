// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { signWebhookResponse } from '@pure/chat-adapter/qq'
import { encryptCredentials } from '@/libs/channels/qq/encrypt'

const mocks = vi.hoisted(() => ({
  authorizeQQInternalWebhook: vi.fn(),
  chatModuleLoaded: vi.fn(),
  constructBindingModel: vi.fn(),
  databaseModuleLoaded: vi.fn(),
  findByApplicationId: vi.fn(),
  getOrCreateQQChat: vi.fn(),
  handleWebhook: vi.fn(),
  touchActive: vi.fn(),
}))

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))
vi.mock('@pure/database/models/channelBinding', () => {
  mocks.databaseModuleLoaded()

  return {
    ChannelBindingModel: class {
      constructor() {
        mocks.constructBindingModel()
      }

      findByApplicationId = mocks.findByApplicationId
      touchActive = mocks.touchActive
    },
    QQ_PLATFORM: 'qq',
  }
})
vi.mock('@/envs/serverDB', () => ({
  serverDBEnv: { KEY_VAULTS_SECRET: 'qq-webhook-route-test-secret' },
}))
vi.mock('@/libs/channels/qq/chatBot', () => {
  mocks.chatModuleLoaded()
  return { getOrCreateQQChat: mocks.getOrCreateQQChat }
})
vi.mock('@/libs/channels/qq/webhookAuth', () => ({
  authorizeQQInternalWebhook: mocks.authorizeQQInternalWebhook,
}))
vi.mock('@/libs/logger', () => ({ logger: { error: vi.fn(), info: vi.fn() } }))

import { GET, POST } from './route'

const context = { params: Promise.resolve({ applicationId: 'app-1' }) }
const createRequest = (body: unknown, headers: Record<string, string> = {}) => {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body)
  const url = new URL('http://localhost/api/channels/qq/webhook/app-1')

  return new NextRequest(url, {
    body: bodyText,
    headers: { 'content-type': 'application/json', ...headers },
    method: 'POST',
  })
}

describe('POST /api/channels/qq/webhook/[applicationId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByApplicationId.mockResolvedValue({
      agentId: 'agent-1',
      applicationId: 'app-1',
      credentials: encryptCredentials({
        appId: 'app-1',
        appSecret: 'qq-app-secret',
        connectionMode: 'webhook',
      }),
      enabled: true,
      id: 'binding-1',
      model: 'gpt-5.4-mini',
      provider: 'openai',
      userId: 'user-1',
    })
    mocks.authorizeQQInternalWebhook.mockReturnValue(true)
    mocks.getOrCreateQQChat.mockResolvedValue({ webhooks: { qq: mocks.handleWebhook } })
    mocks.touchActive.mockResolvedValue(undefined)
  })

  it('signs an official tokenless op=13 verification through the appId binding', async () => {
    const response = await POST(
      createRequest({ d: { event_ts: '1723987200', plain_token: 'plain-token' }, op: 13 }),
      context
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      plain_token: 'plain-token',
      signature: signWebhookResponse('1723987200', 'plain-token', 'qq-app-secret'),
    })
    expect(mocks.databaseModuleLoaded).toHaveBeenCalledOnce()
    expect(mocks.constructBindingModel).toHaveBeenCalledOnce()
    expect(mocks.findByApplicationId).toHaveBeenCalledWith('qq', 'app-1')
    expect(response.headers.get('server-timing')).toMatch(/^binding;dur=\d+\.\d, sign;dur=\d+\.\d$/)
    expect(mocks.getOrCreateQQChat).not.toHaveBeenCalled()
    expect(mocks.touchActive).not.toHaveBeenCalled()
  })

  it('signs op=13 when the opcode or timestamp arrive as JSON numbers or strings', async () => {
    const response = await POST(
      createRequest({ d: { event_ts: 1723987200, plain_token: 'plain-token' }, op: '13' }),
      context
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      plain_token: 'plain-token',
      signature: signWebhookResponse('1723987200', 'plain-token', 'qq-app-secret'),
    })
  })

  it('signs official op=13 before websocket internal Bearer authorization', async () => {
    mocks.findByApplicationId.mockResolvedValueOnce({
      agentId: 'agent-1',
      applicationId: 'app-1',
      credentials: encryptCredentials({
        appId: 'app-1',
        appSecret: 'qq-app-secret',
        connectionMode: 'websocket',
      }),
      enabled: true,
      id: 'binding-1',
      model: 'gpt-5.4-mini',
      provider: 'openai',
      userId: 'user-1',
    })
    mocks.authorizeQQInternalWebhook.mockReturnValue(false)

    const response = await POST(
      createRequest({ d: { event_ts: '1723987200', plain_token: 'plain-token' }, op: 13 }),
      context
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      plain_token: 'plain-token',
      signature: signWebhookResponse('1723987200', 'plain-token', 'qq-app-secret'),
    })
    expect(mocks.authorizeQQInternalWebhook).not.toHaveBeenCalled()
    expect(mocks.getOrCreateQQChat).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty QQBot-Callback body instead of treating it as a failed event signature', async () => {
    const request = new NextRequest('http://localhost/api/channels/qq/webhook/app-1', {
      headers: {
        'content-type': 'application/json',
        'User-Agent': 'QQBot-Callback',
        'X-Bot-Appid': 'app-1',
        'X-Signature-Ed25519': '00'.repeat(64),
        'X-Signature-Timestamp': '1725442341',
      },
      method: 'POST',
    })

    const response = await POST(request, context)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Empty body' })
    expect(mocks.findByApplicationId).not.toHaveBeenCalled()
    expect(mocks.getOrCreateQQChat).not.toHaveBeenCalled()
  })

  it('logs GET probes and returns 405 because QQ validation is POST-only', async () => {
    const request = new NextRequest('http://localhost/api/channels/qq/webhook/app-1', {
      headers: { 'user-agent': 'Mozilla/5.0' },
      method: 'GET',
    })
    const response = await GET(request, context)

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })

  it('rejects a webhook dispatch with an invalid signature', async () => {
    const response = await POST(
      createRequest(
        { d: { content: 'hello' }, id: 'event-1', op: 0, t: 'C2C_MESSAGE_CREATE' },
        {
          'X-Signature-Ed25519': '00'.repeat(64),
          'X-Signature-Timestamp': '1725442341',
        }
      ),
      context
    )

    expect(response.status).toBe(401)
    expect(mocks.getOrCreateQQChat).not.toHaveBeenCalled()
    expect(mocks.touchActive).not.toHaveBeenCalled()
  })

  it('forwards the original unconsumed request for a valid webhook dispatch', async () => {
    const payload = { d: { content: 'hello' }, id: 'event-1', op: 0, t: 'C2C_MESSAGE_CREATE' }
    const bodyText = JSON.stringify(payload)
    const timestamp = '1725442341'
    const request = createRequest(bodyText, {
      'X-Signature-Ed25519': signWebhookResponse(timestamp, bodyText, 'qq-app-secret'),
      'X-Signature-Timestamp': timestamp,
    })
    mocks.handleWebhook.mockImplementationOnce(async (forwardedRequest: NextRequest) =>
      Response.json({ payload: await forwardedRequest.json() })
    )

    const response = await POST(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ payload })
    expect(mocks.handleWebhook).toHaveBeenCalledOnce()
    expect(mocks.handleWebhook.mock.calls[0]?.[0]).not.toBe(request)
    expect(mocks.touchActive).toHaveBeenCalledWith('binding-1')
  })

  it('keeps internal Bearer authorization for websocket forwarding without QQ signature headers', async () => {
    const payload = { d: { content: 'gateway' }, id: 'event-2', op: 0, t: 'C2C_MESSAGE_CREATE' }
    const request = createRequest(payload, { authorization: 'Bearer internal-token' })
    mocks.findByApplicationId.mockResolvedValueOnce({
      agentId: 'agent-1',
      applicationId: 'app-1',
      credentials: encryptCredentials({
        appId: 'app-1',
        appSecret: 'qq-app-secret',
        connectionMode: 'websocket',
      }),
      enabled: true,
      id: 'binding-1',
      model: 'gpt-5.4-mini',
      provider: 'openai',
      userId: 'user-1',
    })
    mocks.handleWebhook.mockImplementationOnce(async (forwardedRequest: NextRequest) =>
      Response.json({ payload: await forwardedRequest.json() })
    )

    const response = await POST(request, context)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ payload })
    expect(mocks.authorizeQQInternalWebhook).toHaveBeenCalledWith(request)
    expect(mocks.handleWebhook).toHaveBeenCalledOnce()
    expect(mocks.handleWebhook.mock.calls[0]?.[0]).not.toBe(request)
  })
})
