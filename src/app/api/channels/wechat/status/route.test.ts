// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  countFailed: vi.fn(),
  ensureChannelGatewayRunning: vi.fn().mockResolvedValue(undefined),
  findByUserAndPlatform: vi.fn(),
  getWechatProviderAvailability: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
  },
  WECHAT_PLATFORM: 'wechat',
}))
vi.mock('@pure/database/models/channelEvent', () => ({
  ChannelEventModel: class {
    countFailed = mocks.countFailed
  },
}))
vi.mock('@/libs/channels/wechat', () => ({ isWechatGatewaySupported: vi.fn(() => true) }))
vi.mock('@/libs/channels/wechat/agentSupport', () => ({
  getWechatProviderAvailability: mocks.getWechatProviderAvailability,
}))
vi.mock('@/server/channel-gateway', () => ({
  ensureChannelGatewayRunning: mocks.ensureChannelGatewayRunning,
}))

import { GET } from './route'

describe('GET /api/channels/wechat/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.countFailed.mockResolvedValue(0)
    mocks.getWechatProviderAvailability.mockReturnValue({
      deepseek: { available: true },
      openai: { available: false, reason: '服务端未配置 OpenAI API Key' },
      purechat: { available: true },
    })
    mocks.findByUserAndPlatform.mockResolvedValue({
      agentId: 'agent-1',
      applicationId: 'wechat-app',
      enabled: true,
      id: 'binding-1',
      lastHeartbeatAt: new Date(),
      model: 'gpt-5.4-mini',
      needsRebind: false,
      provider: 'openai',
      runtimeStatus: 'online',
      updatedAt: new Date(),
    })
  })

  it('returns the saved provider and model with provider availability', async () => {
    const response = await GET(new NextRequest('http://localhost/api/channels/wechat/status'))

    expect(mocks.ensureChannelGatewayRunning).toHaveBeenCalledOnce()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      model: 'gpt-5.4-mini',
      provider: 'openai',
      providerAvailability: {
        openai: { available: false, reason: '服务端未配置 OpenAI API Key' },
      },
    })
  })
})
