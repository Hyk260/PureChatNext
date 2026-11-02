// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findVisibleById: vi.fn(),
  findByUserAndPlatform: vi.fn(),
  isQQProviderId: vi.fn(),
  qqChannelByokUnavailableReason: vi.fn(),
  resolveSpeechCredentials: vi.fn(),
  updateConfiguration: vi.fn(),
  updateSettings: vi.fn(),
  validateQQModel: vi.fn(),
}))

vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    findVisibleById = mocks.findVisibleById
  },
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
    updateConfiguration = mocks.updateConfiguration
    updateSettings = mocks.updateSettings
  },
  QQ_PLATFORM: 'qq',
}))
vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) =>
    (request: NextRequest) =>
      handler(request, { userId: 'owner' }),
}))
vi.mock('@/libs/channels/qq', () => ({
  decryptCredentials: vi.fn(),
  encryptCredentials: vi.fn(),
  invalidateQQChat: vi.fn(),
  normalizeQQChannelSettings: vi.fn((settings: unknown) => settings),
}))
vi.mock('@/libs/channels/qq/advancedSettings', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/libs/channels/qq/advancedSettings')>(),
  parseQQChannelSettingsInput: vi.fn(),
}))
vi.mock('@/libs/channels/qq/agentSupport', () => ({
  isQQProviderId: mocks.isQQProviderId,
  qqChannelByokUnavailableReason: mocks.qqChannelByokUnavailableReason,
  validateQQModel: mocks.validateQQModel,
}))
vi.mock('@/libs/channels/qq/binding', () => ({
  bindQQCredentials: vi.fn(),
  QQBindingError: class extends Error {},
}))
vi.mock('@/libs/channels/qq/qrSession', () => ({
  cancelQQQrSessionsForUser: vi.fn(),
}))
vi.mock('@/server/channel-gateway/diagnostics', () => ({
  recordChannelGatewayLog: vi.fn(),
}))
vi.mock('@/envs/gateway', () => ({ gatewayEnv: { CHANNEL_GATEWAY_ENABLED: true } }))
vi.mock('@/server/speech', () => ({
  resolveSpeechCredentials: mocks.resolveSpeechCredentials,
  SpeechError: class SpeechError extends Error {},
}))

import { PATCH } from './route'

const patchRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/channels/qq/bind', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
  })

describe('PATCH /api/channels/qq/bind', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findVisibleById.mockResolvedValue({ id: 'agent-1' })
    mocks.findByUserAndPlatform.mockResolvedValue({
      agentId: 'agent-1',
      applicationId: 'qq-app',
      settings: { dmPolicy: 'allowlist', platformUserId: 'owner-qq' },
    })
    mocks.isQQProviderId.mockImplementation((provider) => ['purechat', 'openai', 'deepseek', 'bailian'].includes(provider))
    mocks.qqChannelByokUnavailableReason.mockResolvedValue(null)
    mocks.resolveSpeechCredentials.mockResolvedValue({ apiKey: 'secret' })
    mocks.updateConfiguration.mockResolvedValue({ agentId: 'agent-1', model: 'deepseek-v4.1-flash', provider: 'bailian' })
    mocks.updateSettings.mockImplementation(async (_userId, _platform, settings) => ({ settings }))
    mocks.validateQQModel.mockReturnValue(null)
  })

  it('saves a dynamic Bailian chat model selection', async () => {
    const response = await PATCH(patchRequest({
      agentId: 'agent-1',
      model: 'deepseek-v4.1-flash',
      provider: 'bailian',
    }))

    expect(response.status).toBe(200)
    expect(mocks.updateConfiguration).toHaveBeenCalledWith({
      agentId: 'agent-1',
      model: 'deepseek-v4.1-flash',
      platform: 'qq',
      provider: 'bailian',
      userId: 'owner',
    })
  })

  it('saves a supported model to the QQ binding without changing access settings', async () => {
    const speechModel = { model: 'qwen-audio-3.1-tts-flash', provider: 'bailian' }
    const response = await PATCH(patchRequest({ speechModel }))

    expect(response.status).toBe(200)
    expect(mocks.resolveSpeechCredentials).toHaveBeenCalledWith('owner', speechModel)
    expect(mocks.updateSettings).toHaveBeenCalledWith('owner', 'qq', {
      dmPolicy: 'allowlist',
      platformUserId: 'owner-qq',
      speechModel,
    })
  })

  it('saves the Qwen instruction and clears it when an empty value is submitted', async () => {
    const speechModel = {
      instruction: '说话嗲一点，御姐音',
      model: 'qwen-audio-3.1-tts-flash',
      provider: 'bailian',
      replyMode: 'smart',
      voice: 'anruorou_v3.1',
    }
    const response = await PATCH(patchRequest({ speechModel }))

    expect(response.status).toBe(200)
    expect(mocks.updateSettings).toHaveBeenCalledWith('owner', 'qq', {
      dmPolicy: 'allowlist',
      platformUserId: 'owner-qq',
      speechModel,
    })

    mocks.findByUserAndPlatform.mockResolvedValueOnce({
      agentId: 'agent-1',
      applicationId: 'qq-app',
      settings: { speechModel },
    })
    await PATCH(patchRequest({ speechModel: { ...speechModel, instruction: '' } }))
    expect(mocks.updateSettings).toHaveBeenLastCalledWith('owner', 'qq', {
      speechModel: {
        model: 'qwen-audio-3.1-tts-flash',
        provider: 'bailian',
        replyMode: 'smart',
        voice: 'anruorou_v3.1',
      },
    })
  })

  it('retains the saved instruction when switching speech models without submitting it', async () => {
    mocks.findByUserAndPlatform.mockResolvedValueOnce({
      agentId: 'agent-1',
      applicationId: 'qq-app',
      settings: {
        speechModel: {
          instruction: '说话嗲一点，御姐音',
          model: 'qwen-audio-3.1-tts-flash',
          provider: 'bailian',
          replyMode: 'smart',
          voice: 'anruorou_v3.1',
        },
      },
    })

    const response = await PATCH(patchRequest({ speechModel: { model: 'tts-1', provider: 'openai' } }))

    expect(response.status).toBe(200)
    expect(mocks.updateSettings).toHaveBeenCalledWith('owner', 'qq', {
      speechModel: {
        instruction: '说话嗲一点，御姐音',
        model: 'tts-1',
        provider: 'openai',
      },
    })
  })

  it('rejects instructions longer than 500 characters', async () => {
    const response = await PATCH(
      patchRequest({
        speechModel: { model: 'qwen-audio-3.1-tts-flash', provider: 'bailian', instruction: 'i'.repeat(501) },
      })
    )

    expect(response.status).toBe(400)
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })

  it('accepts the Qwen 3.0 TTS model', async () => {
    const speechModel = { model: 'qwen-audio-3.0-tts-flash', provider: 'bailian' }
    const response = await PATCH(patchRequest({ speechModel }))

    expect(response.status).toBe(200)
    expect(mocks.resolveSpeechCredentials).toHaveBeenCalledWith('owner', speechModel)
  })

  it('rejects a built-in model that is not a supported TTS model', async () => {
    const response = await PATCH(patchRequest({ speechModel: { model: 'tts-1', provider: 'deepseek' } }))

    expect(response.status).toBe(400)
    expect(mocks.resolveSpeechCredentials).not.toHaveBeenCalled()
    expect(mocks.updateSettings).not.toHaveBeenCalled()
  })
})
