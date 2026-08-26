// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptCredentials: vi.fn(),
  ensureChannelGatewayRunning: vi.fn().mockResolvedValue(undefined),
  findByUserAndPlatform: vi.fn(),
}))

vi.mock('@/envs/app', () => ({ appEnv: { APP_URL: 'https://chat.example.com/' } }))
vi.mock('@/envs/gateway', () => ({ gatewayEnv: { CHANNEL_GATEWAY_ENABLED: true } }))
vi.mock('@/libs/auth/get-session-user', () => ({
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
  },
  QQ_PLATFORM: 'qq',
}))
vi.mock('@/libs/channels/qq', () => ({ decryptCredentials: mocks.decryptCredentials }))
vi.mock('@/server/channel-gateway', () => ({
  ensureChannelGatewayRunning: mocks.ensureChannelGatewayRunning,
}))

import { GET } from './route'

const encryptedCredentials = 'enc:v1:b3BhcXVlK2NpcGhlcnRleHQvPQ=='

const createBinding = (credentials: string) => ({
  agentId: 'agent-1',
  applicationId: 'app-1',
  credentials,
  enabled: true,
  lastActiveAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  lastHeartbeatAt: null,
  model: 'gpt-5.4-mini',
  provider: 'openai',
  runtimeStatus: 'offline',
})

describe('GET /api/channels/qq/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.decryptCredentials.mockReturnValue({
      appId: 'app-1',
      appSecret: 'never-expose-this-secret',
      connectionMode: 'webhook',
    })
    mocks.findByUserAndPlatform.mockResolvedValue(createBinding(encryptedCredentials))
  })

  it('returns the official tokenless webhook URL without exposing credentials', async () => {
    const response = await GET(new NextRequest('http://localhost/api/channels/qq/status'))

    expect(response.status).toBe(200)
    const data = (await response.json()) as { webhookUrl: string }
    const webhookUrl = new URL(data.webhookUrl)
    expect(webhookUrl.origin).toBe('https://chat.example.com')
    expect(webhookUrl.pathname).toBe('/api/channels/qq/webhook/app-1')
    expect(webhookUrl.search).toBe('')
    expect(data.webhookUrl).not.toContain(encryptedCredentials)
    expect(data.webhookUrl).not.toContain('never-expose-this-secret')
  })

  it.each([
    ['plain:v1 credentials', 'plain:v1:eyJhcHBTZWNyZXQiOiJzZWNyZXQifQ=='],
    ['raw credentials', '{"appId":"app-1","appSecret":"secret"}'],
    ['base64 credentials', 'eyJhcHBTZWNyZXQiOiJzZWNyZXQifQ=='],
  ])('never puts %s in the webhook URL', async (_case, credentials) => {
    mocks.findByUserAndPlatform.mockResolvedValueOnce(createBinding(credentials))

    const response = await GET(new NextRequest('http://localhost/api/channels/qq/status'))

    const data = (await response.json()) as { webhookUrl: string }
    expect(new URL(data.webhookUrl).search).toBe('')
    expect(data.webhookUrl).not.toContain(credentials)
  })

  it('does not add a token for encrypted WebSocket credentials', async () => {
    mocks.decryptCredentials.mockReturnValueOnce({
      appId: 'app-1',
      appSecret: 'never-expose-this-secret',
      connectionMode: 'websocket',
    })

    const response = await GET(new NextRequest('http://localhost/api/channels/qq/status'))

    const data = (await response.json()) as { webhookUrl: string }
    expect(new URL(data.webhookUrl).search).toBe('')
  })

  it('does not add a token when encrypted credentials cannot be decrypted', async () => {
    mocks.decryptCredentials.mockImplementationOnce(() => {
      throw new Error('decrypt failed')
    })

    const response = await GET(new NextRequest('http://localhost/api/channels/qq/status'))

    const data = (await response.json()) as { webhookUrl: string }
    expect(new URL(data.webhookUrl).search).toBe('')
  })
})
