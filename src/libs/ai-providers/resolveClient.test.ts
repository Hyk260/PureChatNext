import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createDeepSeek: vi.fn(),
  createDeepSeekModel: vi.fn((model: string) => ({ modelId: model })),
  createOpenAI: vi.fn(),
  createOpenAIModel: vi.fn((model: string) => ({ modelId: model })),
  createTimedFetch: vi.fn(() => vi.fn()),
}))

vi.mock('@ai-sdk/deepseek', () => ({
  createDeepSeek: mocks.createDeepSeek,
}))
vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: mocks.createOpenAI,
}))
vi.mock('./timedFetch', () => ({
  createTimedFetch: mocks.createTimedFetch,
}))

import { createProviderLanguageModel } from './resolveClient'

describe('createProviderLanguageModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createOpenAI.mockReturnValue(mocks.createOpenAIModel)
    mocks.createDeepSeek.mockReturnValue(mocks.createDeepSeekModel)
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

  it('does not wrap fetch when timeoutMs is omitted', () => {
    createProviderLanguageModel('deepseek', 'deepseek-chat', 'sk-test', undefined)

    expect(mocks.createTimedFetch).not.toHaveBeenCalled()
    expect(mocks.createDeepSeek).toHaveBeenCalledWith({ apiKey: 'sk-test' })
  })
})
