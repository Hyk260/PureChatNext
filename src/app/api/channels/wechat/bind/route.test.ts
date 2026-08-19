// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findByUserAndPlatform: vi.fn(),
  findVisibleById: vi.fn(),
  invalidateWechatChat: vi.fn(),
  isWechatProviderId: vi.fn(),
  reconcileChannelGateway: vi.fn(),
  upsert: vi.fn(),
  updateConfiguration: vi.fn(),
  validateWechatModel: vi.fn(),
  wechatAgentUnavailableReason: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))
vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    findVisibleById = mocks.findVisibleById
  },
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
    upsert = mocks.upsert
    updateConfiguration = mocks.updateConfiguration
  },
  WECHAT_PLATFORM: 'wechat',
}))
vi.mock('@/libs/channels/wechat/agentSupport', () => ({
  isWechatProviderId: mocks.isWechatProviderId,
  validateWechatModel: mocks.validateWechatModel,
  wechatAgentUnavailableReason: mocks.wechatAgentUnavailableReason,
}))
vi.mock('@/libs/channels/wechat', () => ({
  encryptCredentials: vi.fn(),
  invalidateWechatChat: mocks.invalidateWechatChat,
  isWechatGatewaySupported: vi.fn(() => true),
  requireWechatVaultSecret: vi.fn(),
}))
vi.mock('@/server/channel-gateway', () => ({
  reconcileChannelGateway: mocks.reconcileChannelGateway,
}))

import { PATCH, POST } from './route'

const patchRequest = (body: Record<string, string>) =>
  new NextRequest('http://localhost/api/channels/wechat/bind', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
  })

const validConfig = { agentId: 'agent-1', model: 'gpt-5.4-mini', provider: 'openai' }

const postRequest = (body: Record<string, string>) =>
  new NextRequest('http://localhost/api/channels/wechat/bind', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })

describe('/api/channels/wechat/bind', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findVisibleById.mockResolvedValue({ id: 'agent-1' })
    mocks.isWechatProviderId.mockReturnValue(true)
    mocks.validateWechatModel.mockReturnValue(null)
    mocks.wechatAgentUnavailableReason.mockReturnValue(null)
    mocks.findByUserAndPlatform.mockResolvedValue(null)
    mocks.upsert.mockResolvedValue({ id: 'binding-1', runtimeStatus: 'starting' })
    mocks.updateConfiguration.mockResolvedValue({
      ...validConfig,
      applicationId: 'wechat-app',
    })
    mocks.reconcileChannelGateway.mockResolvedValue(undefined)
  })

  it('returns immediately without waiting for the first Gateway poll', async () => {
    let resolveReconcile!: () => void
    mocks.reconcileChannelGateway.mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        resolveReconcile = resolve
      })
    )

    const response = await POST(
      postRequest({
        ...validConfig,
        botId: 'wechat-bot',
        botToken: 'wechat-bot-token-123456',
        userId: 'wechat-user',
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: 'binding-1',
      ok: true,
      runtimeStatus: 'starting',
    })
    await vi.waitFor(() => expect(mocks.reconcileChannelGateway).toHaveBeenCalledOnce())

    resolveReconcile()
  })

  it('keeps the bind response successful when background Gateway startup fails', async () => {
    mocks.reconcileChannelGateway.mockRejectedValueOnce(new Error('Gateway startup failed'))

    const response = await POST(
      postRequest({
        ...validConfig,
        botId: 'wechat-bot',
        botToken: 'wechat-bot-token-123456',
        userId: 'wechat-user',
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ id: 'binding-1', ok: true })
    await vi.waitFor(() => expect(mocks.reconcileChannelGateway).toHaveBeenCalledOnce())
  })

  it('atomically updates a valid channel configuration', async () => {
    const response = await PATCH(patchRequest(validConfig))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ...validConfig, ok: true })
    expect(mocks.updateConfiguration).toHaveBeenCalledWith({
      ...validConfig,
      platform: 'wechat',
      userId: 'user-1',
    })
    expect(mocks.invalidateWechatChat).toHaveBeenCalledWith('wechat-app')
  })

  it('rejects a model that does not belong to the selected provider', async () => {
    mocks.validateWechatModel.mockReturnValue('所选模型不属于该服务商或已停用')
    const response = await PATCH(patchRequest(validConfig))

    expect(response.status).toBe(400)
    expect(mocks.updateConfiguration).not.toHaveBeenCalled()
  })

  it('rejects a provider whose server key is unavailable', async () => {
    mocks.wechatAgentUnavailableReason.mockReturnValue('服务端未配置 OpenAI API Key')
    const response = await PATCH(patchRequest(validConfig))

    expect(response.status).toBe(400)
    expect(mocks.updateConfiguration).not.toHaveBeenCalled()
  })

  it('returns 404 when the agent is missing', async () => {
    mocks.findVisibleById.mockResolvedValue(null)
    const response = await PATCH(patchRequest(validConfig))

    expect(response.status).toBe(404)
    expect(mocks.updateConfiguration).not.toHaveBeenCalled()
  })

  it('returns 404 when the channel binding is missing', async () => {
    mocks.updateConfiguration.mockResolvedValue(null)
    const response = await PATCH(patchRequest(validConfig))

    expect(response.status).toBe(404)
    expect(mocks.invalidateWechatChat).not.toHaveBeenCalled()
  })
})
