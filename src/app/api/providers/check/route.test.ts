// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assertPureChatCanChat: vi.fn(),
  chargePureChatGenerateUsage: vi.fn(),
  createProviderLanguageModel: vi.fn(() => ({ modelId: 'openai-model' })),
  createPureChatLanguageModel: vi.fn(() => ({ modelId: 'gateway-model' })),
  generateText: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  resolveApiKeyFromHeader: vi.fn(),
  resolveOptionalBaseURL: vi.fn((value?: string) => value?.trim() || undefined),
  resolveProviderApiKey: vi.fn(),
  withHealthTimeout: vi.fn(),
}))

vi.mock('ai', () => ({ generateText: mocks.generateText }))
vi.mock('@pure/database/models/credits', () => ({
  FreePlanLimitError: class FreePlanLimitError extends Error {},
}))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  createProviderLanguageModel: mocks.createProviderLanguageModel,
  isSupportedProviderId: (id: string) => id === 'openai' || id === 'deepseek',
  resolveApiKeyFromHeader: mocks.resolveApiKeyFromHeader,
  resolveOptionalBaseURL: mocks.resolveOptionalBaseURL,
  resolveProviderApiKey: mocks.resolveProviderApiKey,
}))
vi.mock('@/libs/auth/get-session-user', () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}))
vi.mock('@/server/health/dependencies', () => ({
  withHealthTimeout: mocks.withHealthTimeout,
}))
vi.mock('@/server/purechat/runtime', () => ({
  assertPureChatCanChat: mocks.assertPureChatCanChat,
  chargePureChatGenerateUsage: mocks.chargePureChatGenerateUsage,
  createPureChatLanguageModel: mocks.createPureChatLanguageModel,
}))

import { POST } from './route'

const requestFor = (body: unknown, headers?: HeadersInit) =>
  new Request('http://localhost/api/providers/check', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
    method: 'POST',
  })

describe('POST /api/providers/check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveProviderApiKey.mockReturnValue('test-key')
    mocks.chargePureChatGenerateUsage.mockResolvedValue(undefined)
    mocks.withHealthTimeout.mockImplementation(async (task: (signal: AbortSignal) => Promise<unknown>) => {
      return task(new AbortController().signal)
    })
    mocks.generateText.mockResolvedValue({
      text: 'pong',
      usage: {
        inputTokenDetails: {},
        inputTokens: 1,
        outputTokens: 1,
      },
    })
  })

  it('checks OpenAI-compatible models with the configured timeout', async () => {
    const response = await POST(
      requestFor({
        baseURL: 'https://example.com/v1',
        model: 'gpt-test',
        provider: 'openai',
        timeoutMs: 22_000,
      })
    )
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({ model: 'gpt-test', ok: true, provider: 'openai' })
    expect(mocks.withHealthTimeout).toHaveBeenCalledWith(expect.any(Function), { timeoutMs: 22_000 })
    expect(mocks.createProviderLanguageModel).toHaveBeenCalledWith(
      'openai',
      'gpt-test',
      'test-key',
      'https://example.com/v1',
      { timeoutMs: 22_000 }
    )
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRetries: 0,
        maxOutputTokens: 128,
        model: { modelId: 'openai-model' },
        prompt: 'Reply with exactly pong.',
      })
    )
  })

  it('does not treat reasoning-only output as a successful health check', async () => {
    mocks.generateText.mockResolvedValue({
      finishReason: 'stop',
      reasoningText: 'health check completed',
      text: '',
    })

    const response = await POST(requestFor({ model: 'deepseek-v4-flash', provider: 'deepseek' }))
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(json.error.message).toBe('模型返回空响应')
  })

  it('increases the output budget once when the response is truncated', async () => {
    mocks.generateText
      .mockResolvedValueOnce({
        finishReason: 'length',
        text: '',
        usage: { inputTokenDetails: {}, inputTokens: 1, outputTokens: 128 },
      })
      .mockResolvedValueOnce({
        finishReason: 'stop',
        text: 'pong',
        usage: { inputTokenDetails: {}, inputTokens: 1, outputTokens: 2 },
      })

    const response = await POST(requestFor({ model: 'gpt-test', provider: 'openai' }))

    expect(response.status).toBe(200)
    expect(mocks.generateText).toHaveBeenCalledTimes(2)
    expect(mocks.generateText.mock.calls[0][0]).toMatchObject({ maxOutputTokens: 128 })
    expect(mocks.generateText.mock.calls[1][0]).toMatchObject({ maxOutputTokens: 1_024 })
  })

  it('does not charge PureChat when the health check returns no text', async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue('user-1')
    mocks.assertPureChatCanChat.mockResolvedValue({
      settlementId: 'settlement-1',
      settlementPeriod: '2026-08',
    })
    mocks.generateText.mockResolvedValue({
      finishReason: 'length',
      reasoningText: '',
      text: '',
    })

    const response = await POST(requestFor({ model: 'gpt-5.4-mini', provider: 'purechat' }))
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(json.error.message).toBe('模型输出达到上限，仍未生成最终文本')
    expect(mocks.chargePureChatGenerateUsage).not.toHaveBeenCalled()
  })

  it('returns a concise timeout reason', async () => {
    const timeout = new Error('aborted')
    timeout.name = 'AbortError'
    mocks.withHealthTimeout.mockRejectedValue(timeout)

    const response = await POST(requestFor({ model: 'gpt-test', provider: 'openai', timeoutMs: 1_000 }))
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(json.error.message).toBe('请求超时（1 秒）')
  })

  it('returns upstream rate limiting without retrying or exposing the upstream response', async () => {
    const rateLimit = Object.assign(new Error('Too Many Requests: sk-secret'), { status: 429 })
    mocks.generateText.mockRejectedValue(rateLimit)

    const response = await POST(requestFor({ model: 'gpt-test', provider: 'openai', apiKey: 'sk-secret' }))
    const json = await response.json()

    expect(response.status).toBe(429)
    expect(json.error.message).toBe('上游限流，请稍后重试')
    expect(JSON.stringify(json)).not.toContain('sk-secret')
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0 }))
  })

  it('checks PureChat through the authenticated, billable runtime', async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue('user-1')
    mocks.assertPureChatCanChat.mockResolvedValue({
      settlementId: 'settlement-1',
      settlementPeriod: '2026-08',
    })

    const response = await POST(requestFor({ model: 'gpt-5.4-mini', provider: 'purechat' }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toMatchObject({ model: 'gpt-5.4-mini', ok: true, provider: 'purechat' })
    expect(mocks.assertPureChatCanChat).toHaveBeenCalledWith('user-1', 'gpt-5.4-mini')
    expect(mocks.chargePureChatGenerateUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        settlementId: 'settlement-1',
        userId: 'user-1',
      })
    )
  })

  it('does not expose provider secrets in upstream error messages', async () => {
    mocks.resolveProviderApiKey.mockReturnValue('sk-secret')
    mocks.generateText.mockRejectedValue(new Error('upstream failed with sk-secret'))

    const response = await POST(requestFor({ model: 'gpt-test', provider: 'openai', apiKey: 'sk-secret' }))
    const json = await response.json()

    expect(response.status).toBe(502)
    expect(JSON.stringify(json)).not.toContain('sk-secret')
  })
})
