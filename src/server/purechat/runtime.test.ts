// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assertCanChat: vi.fn(),
  chargeChatUsage: vi.fn(),
  createOpenAIModel: vi.fn(() => ({ modelId: 'gateway-model' })),
  createOpenAI: vi.fn(),
  getEnabledPureChatModel: vi.fn(),
  getPureChatModel: vi.fn(),
  resolveAiGatewayApiKey: vi.fn(),
  resolvePureChatGatewayId: vi.fn(),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: (...args: unknown[]) => mocks.createOpenAI(...args),
}))
vi.mock('@pure/database/models/credits', () => ({
  CreditsModel: vi.fn(() => ({
    assertCanChat: mocks.assertCanChat,
    chargeChatUsage: mocks.chargeChatUsage,
  })),
  FreePlanLimitError: class FreePlanLimitError extends Error {
    constructor(message?: string) {
      super(message)
      this.name = 'FreePlanLimitError'
    }
  },
}))
vi.mock('@pure/model-bank', () => ({
  computeChatCost: () => ({ totalCredits: 42 }),
  getEnabledPureChatModel: mocks.getEnabledPureChatModel,
  getPureChatModel: mocks.getPureChatModel,
  resolvePureChatGatewayId: mocks.resolvePureChatGatewayId,
}))
vi.mock('@pure/utils', () => ({ createNanoId: () => () => 'settlement-1' }))
vi.mock('@/envs/llm', () => ({
  llmEnv: { PURECHAT_ENABLED: true },
  resolveAiGatewayApiKey: mocks.resolveAiGatewayApiKey,
  resolveAiGatewayBaseURL: () => 'https://gateway.example/v1',
}))
vi.mock('@/server/purechat/period', () => ({
  getShanghaiBillingPeriod: () => '2026-08',
}))
vi.mock('@/server/purechat/gatewayError', () => ({
  PURECHAT_MODEL_UNAVAILABLE_MESSAGE: '模型不可用',
}))

import {
  assertPureChatCanChat,
  chargePureChatGenerateUsage,
  createPureChatLanguageModel,
  isPureChatRuntimeAvailable,
} from './runtime'

describe('purechat runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createOpenAI.mockReturnValue(mocks.createOpenAIModel)
    mocks.resolveAiGatewayApiKey.mockReturnValue('gateway-key')
    mocks.resolvePureChatGatewayId.mockReturnValue('openai/gpt-5.4-mini')
    mocks.getEnabledPureChatModel.mockReturnValue({ id: 'gpt-5.4-mini' })
    mocks.getPureChatModel.mockReturnValue({ pricing: {} })
    mocks.assertCanChat.mockResolvedValue({ remaining: 1000 })
  })

  it('reports runtime availability from env + gateway key', () => {
    expect(isPureChatRuntimeAvailable()).toBe(true)
    mocks.resolveAiGatewayApiKey.mockReturnValueOnce('')
    expect(isPureChatRuntimeAvailable()).toBe(false)
  })

  it('creates a gateway language model', () => {
    const model = createPureChatLanguageModel('gpt-5.4-mini')
    expect(mocks.createOpenAI).toHaveBeenCalledWith({
      apiKey: 'gateway-key',
      baseURL: 'https://gateway.example/v1',
    })
    expect(mocks.createOpenAIModel).toHaveBeenCalledWith('openai/gpt-5.4-mini')
    expect(model).toEqual({ modelId: 'gateway-model' })
  })

  it('assertPureChatCanChat returns settlement after credit check', async () => {
    const settlement = await assertPureChatCanChat('user-1', 'gpt-5.4-mini')
    expect(settlement).toEqual({ settlementId: 'settlement-1', settlementPeriod: '2026-08' })
    expect(mocks.assertCanChat).toHaveBeenCalledWith('user-1', '2026-08')
  })

  it('assertPureChatCanChat rejects unknown models', async () => {
    mocks.getEnabledPureChatModel.mockReturnValueOnce(undefined)
    await expect(assertPureChatCanChat('user-1', 'nope')).rejects.toThrow('模型不可用')
  })

  it('charges generateText usage', async () => {
    await chargePureChatGenerateUsage({
      durationMs: 120,
      model: 'gpt-5.4-mini',
      result: {
        usage: {
          inputTokenDetails: { cacheReadTokens: 1 },
          inputTokens: 10,
          outputTokens: 5,
        },
      },
      settlementId: 'settlement-1',
      settlementPeriod: '2026-08',
      userId: 'user-1',
    })

    expect(mocks.chargeChatUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        cachedInputTokens: 1,
        credits: 42,
        durationMs: 120,
        messageId: 'settlement-1',
        model: 'gpt-5.4-mini',
        provider: 'purechat',
        userId: 'user-1',
      })
    )
  })
})
