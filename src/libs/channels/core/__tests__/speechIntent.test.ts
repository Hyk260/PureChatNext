// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@pure/database/models/userProviderSecret', () => ({ UserProviderSecretModel: class {} }))
const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  credentials: vi.fn(),
  model: vi.fn(() => ({ modelId: 'test' })),
  charge: vi.fn(),
}))
vi.mock('ai', () => ({ generateText: mocks.generate, isStepCount: vi.fn() }))
vi.mock('@/server/agents/service', () => ({ AgentService: class {} }))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  createProviderLanguageModel: mocks.model,
  isSupportedProviderId: () => true,
}))
vi.mock('@/libs/ai-providers/userSecrets', () => ({
  resolveUserProviderCredentials: mocks.credentials,
  MISSING_USER_PROVIDER_SECRET_MESSAGE: 'missing',
}))
vi.mock('@/server/purechat/runtime', () => ({
  assertPureChatCanChat: vi.fn(),
  createPureChatLanguageModel: vi.fn(),
  chargePureChatGenerateUsage: mocks.charge,
}))
vi.mock('@/server/chat/toolRegistry', () => ({ WEB_SEARCH_SYSTEM_INSTRUCTION: '' }))
vi.mock('@/server/search/webTools', () => ({ resolveUserWebTools: vi.fn(), WEB_FETCH_INSTRUCTION: '' }))

import { confirmChannelSpeechIntent } from '../agentRuntime'

describe('isolated speech intent call', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.credentials.mockResolvedValue({ apiKey: 'owner-key' })
  })
  const params = {
    agentId: 'agent',
    userId: 'owner',
    provider: 'deepseek',
    model: 'chat',
    text: '用语音回复我',
    signal: new AbortController().signal,
  }

  it('accepts only explicit JSON true, never enables tools or writes a chat history', async () => {
    mocks.generate
      .mockResolvedValueOnce({ text: '{"speak":true}' })
      .mockResolvedValueOnce({ text: '{"speak":false}' })
      .mockResolvedValueOnce({ text: 'true' })
      .mockResolvedValueOnce({ text: '{"speak":"true"}' })
    expect(await confirmChannelSpeechIntent(params)).toBe(true)
    for (let i = 0; i < 3; i++) expect(await confirmChannelSpeechIntent(params)).toBe(false)
    expect(mocks.credentials).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'owner', allowEnvFallback: false })
    )
    const call = mocks.generate.mock.calls[0][0]
    expect(call).toMatchObject({
      maxRetries: 0,
      maxOutputTokens: 64,
      abortSignal: params.signal,
      messages: [{ role: 'user', content: JSON.stringify({ message: params.text }) }],
    })
    expect(call.tools).toBeUndefined()
    expect(call.providerOptions).toEqual({ deepseek: { thinking: { type: 'disabled' } } })
    expect(call.instructions).toContain('否定、引用、转述')
  })
})
