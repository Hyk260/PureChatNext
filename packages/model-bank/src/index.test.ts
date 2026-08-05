import { describe, expect, it } from 'vitest'

import {
  assertPureChatPricingComplete,
  computeChatCost,
  getEnabledPureChatModel,
  getPureChatModel,
  openaiChatModels,
  deepseekChatModels,
  PURECHAT_DEFAULT_MODEL,
  PURECHAT_PLAN_CARD_MODELS,
  purechatEnabledChatModels,
  resolvePureChatDisplayId,
  resolvePureChatGatewayId,
} from './index'

const addedModels = [
  ['gpt-5.2', 'openai/gpt-5.2'],
  ['claude-3-haiku', 'anthropic/claude-3-haiku'],
  ['deepseek-v3.2-thinking', 'deepseek/deepseek-v3.2-thinking'],
  ['qwen3.5-plus', 'alibaba/qwen3.5-plus'],
  ['nova-2-lite', 'amazon/nova-2-lite'],
  ['kimi-k2.5', 'moonshotai/kimi-k2.5'],
  ['grok-4.1-fast-reasoning', 'xai/grok-4.1-fast-reasoning'],
  ['grok-4.1-fast-non-reasoning', 'xai/grok-4.1-fast-non-reasoning'],
  ['glm-5-turbo', 'zai/glm-5-turbo'],
  ['minimax-m2.7', 'minimax/minimax-m2.7'],
] as const

const restrictedModels = [
  'gpt-5.5',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'gemini-3.1-pro-preview',
  'gemini-3-flash',
  'deepseek-v4-pro',
  'deepseek-v4-flash',
  'glm-5.2',
] as const

describe('model-bank purechat', () => {
  it('maps display id ↔ gateway id', () => {
    expect(resolvePureChatGatewayId('gpt-5.4-mini')).toBe('openai/gpt-5.4-mini')
    expect(resolvePureChatDisplayId('anthropic/claude-sonnet-4.6')).toBe('claude-sonnet-4-6')
    expect(resolvePureChatGatewayId('step-3.7-flash')).toBe('stepfun/step-3.7-flash')
    expect(resolvePureChatGatewayId('minimax-m3')).toBe('minimax/minimax-m3')
  })

  it('requires complete USD pricing', () => {
    expect(() => assertPureChatPricingComplete()).not.toThrow()
  })

  it.each(addedModels)('maps the added model %s ↔ %s', (displayId, gatewayId) => {
    expect(resolvePureChatGatewayId(displayId)).toBe(gatewayId)
    expect(resolvePureChatDisplayId(gatewayId)).toBe(displayId)
    expect(getEnabledPureChatModel(displayId)?.enabled).toBe(true)
  })

  it.each(restrictedModels)('keeps %s metadata but disables it for new requests', (displayId) => {
    expect(getPureChatModel(displayId)?.enabled).toBe(false)
    expect(getEnabledPureChatModel(displayId)).toBeUndefined()
  })

  it('keeps the default and plan-card models enabled', () => {
    expect(getEnabledPureChatModel(PURECHAT_DEFAULT_MODEL)?.recommended).toBe(true)
    for (const modelId of PURECHAT_PLAN_CARD_MODELS) {
      expect(getEnabledPureChatModel(modelId)).toBeDefined()
    }
    expect(purechatEnabledChatModels).toHaveLength(24)
  })

  it('computeChatCost matches gpt-5.4-mini sample', () => {
    const card = getPureChatModel('gpt-5.4-mini')!
    const result = computeChatCost(card.pricing, { inputTokens: 1000, outputTokens: 1000 })
    expect(result.totalCostUSD).toBeCloseTo(0.00525, 8)
    expect(result.totalCredits).toBe(5250)
  })
})

describe('model-bank openai / deepseek pricing', () => {
  it('openai cards use USD', () => {
    for (const m of openaiChatModels) {
      expect(m.pricing.currency).toBe('USD')
      expect(m.pricing.textInput).toBeGreaterThan(0)
      expect(m.pricing.textOutput).toBeGreaterThan(0)
    }
  })

  it('deepseek cards use CNY', () => {
    for (const m of deepseekChatModels) {
      expect(m.pricing.currency).toBe('CNY')
      expect(m.pricing.textInput).toBeGreaterThan(0)
      expect(m.pricing.textOutput).toBeGreaterThan(0)
    }
  })
})
