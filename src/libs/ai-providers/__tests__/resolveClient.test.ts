import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createDeepSeek: vi.fn(),
  createDeepSeekModel: vi.fn((model: string) => ({ modelId: model })),
  createOpenAI: vi.fn(),
  createOpenAIModel: vi.fn((model: string) => ({ modelId: model })),
  createOpenRouter: vi.fn(),
  createOpenRouterChat: vi.fn((model: string) => ({ modelId: model })),
  createTimedFetch: vi.fn(() => vi.fn()),
  openRouterFetch: vi.fn(),
}))

vi.mock('@ai-sdk/deepseek', () => ({
  createDeepSeek: mocks.createDeepSeek,
}))
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mocks.createOpenAI,
}))
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: mocks.createOpenRouter,
}))
vi.mock('../timedFetch', () => ({
  createTimedFetch: mocks.createTimedFetch,
}))

import { createOpenRouterLanguageModel, createProviderLanguageModel, fetchOpenRouterModels } from '../resolveClient'

describe('createProviderLanguageModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createOpenAI.mockReturnValue(mocks.createOpenAIModel)
    mocks.createDeepSeek.mockReturnValue(mocks.createDeepSeekModel)
    mocks.createOpenRouter.mockReturnValue({ chat: mocks.createOpenRouterChat })
    mocks.createTimedFetch.mockReturnValue(mocks.openRouterFetch as never)
  })

  it('attaches a timed fetch when timeoutMs is set', () => {
    const timedFetch = vi.fn()
    mocks.createTimedFetch.mockReturnValue(timedFetch)

    createProviderLanguageModel('openai', 'gpt-test', 'sk-test', 'https://api.example/v1', { timeoutMs: 60_000 })

    expect(mocks.createTimedFetch).toHaveBeenCalledWith(60_000)
    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'sk-test',
      baseURL: 'https://api.example/v1',
      fetch: timedFetch,
    })
  })

  it('attaches the SSRF-safe fetch transport even when no timeout is requested', () => {
    createProviderLanguageModel('deepseek', 'deepseek-chat', 'sk-test', undefined)

    expect(mocks.createTimedFetch).toHaveBeenCalledWith(undefined)
    expect(mocks.createDeepSeek).toHaveBeenCalledWith({ apiKey: 'sk-test', fetch: expect.any(Function) })
  })

  it('uses the OpenRouter chat model with the full provider model ID', () => {
    const result = createOpenRouterLanguageModel('anthropic/claude-3.7-sonnet:beta', 'or-test')

    expect(mocks.createOpenRouter).toHaveBeenCalledWith({
      apiKey: 'or-test',
      appName: 'PureChat',
      appUrl: 'https://app.purechat.cn',
      baseURL: 'https://openrouter.ai/api/v1',
      compatibility: 'strict',
      fetch: expect.any(Function),
    })
    expect(mocks.createOpenRouterChat).toHaveBeenCalledWith('anthropic/claude-3.7-sonnet:beta')
    expect(result).toEqual({ modelId: 'anthropic/claude-3.7-sonnet:beta' })
  })

  it('retains OpenRouter capabilities, modalities, context, and pricing', async () => {
    mocks.openRouterFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              architecture: { input_modalities: ['text', 'image', 'audio'], output_modalities: ['text'] },
              context_length: 128_000,
              id: 'anthropic/claude-3.7-sonnet:free',
              name: 'Claude 3.7 Sonnet',
              pricing: { completion: '0.000003', prompt: '0.000001' },
              supported_parameters: ['reasoning', 'tools', 'structured_outputs'],
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 }
      )
    )

    const models = await fetchOpenRouterModels({ apiKey: 'or-test' })

    expect(models).toEqual([
      {
        abilities: {
          audioInput: true,
          audioOutput: false,
          functionCall: true,
          imageGeneration: false,
          reasoning: true,
          structuredOutput: true,
          vision: true,
        },
        contextWindowTokens: 128_000,
        displayName: 'Claude 3.7 Sonnet',
        group: 'anthropic',
        id: 'anthropic/claude-3.7-sonnet:free',
        inputModalities: ['text', 'image', 'audio'],
        outputModalities: ['text'],
        pricing: { inputPerMillion: 1, outputPerMillion: 3 },
      },
    ])
  })
})
