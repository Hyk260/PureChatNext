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
  ['qwen3.5-plus', 'alibaba/qwen3.5-plus'],
  ['nova-2-lite', 'amazon/nova-2-lite'],
  ['minimax-m2.7', 'minimax/minimax-m2.7'],
  ['mimo-v2.6-flash', 'xiaomi/mimo-v2.6-flash'],
  ['nemotron-3.5-lightning-free', 'nvidia/nemotron-3.5-lightning-free'],
] as const

const unavailableModels = [
  'gpt-5.4-mini',
  'claude-3-haiku',
  'grok-4.1-fast-reasoning',
  'grok-4.1-fast-non-reasoning',
] as const

describe('model-bank purechat', () => {
  it('maps display id ↔ gateway id', () => {
    expect(resolvePureChatGatewayId('gpt-5.4-nano')).toBe('openai/gpt-5.4-nano')
    expect(resolvePureChatDisplayId('meta/muse-spark-open')).toBe('muse-spark-open')
    expect(resolvePureChatGatewayId('step-3.7-flash')).toBe('stepfun/step-3.7-flash')
    expect(resolvePureChatGatewayId('minimax-m2.7')).toBe('minimax/minimax-m2.7')
  })

  it('requires complete USD pricing', () => {
    expect(() => assertPureChatPricingComplete()).not.toThrow()
  })

  it.each(addedModels)('maps the added model %s ↔ %s', (displayId, gatewayId) => {
    expect(resolvePureChatGatewayId(displayId)).toBe(gatewayId)
    expect(resolvePureChatDisplayId(gatewayId)).toBe(displayId)
    expect(getEnabledPureChatModel(displayId)?.enabled).toBe(true)
  })

  it.each(unavailableModels)('omits %s from the current free-tier catalog', (displayId) => {
    expect(getPureChatModel(displayId)).toBeUndefined()
    expect(getEnabledPureChatModel(displayId)).toBeUndefined()
  })

  it('keeps the default and plan-card models enabled', () => {
    expect(getEnabledPureChatModel(PURECHAT_DEFAULT_MODEL)?.recommended).toBe(true)
    for (const modelId of PURECHAT_PLAN_CARD_MODELS) {
      expect(getEnabledPureChatModel(modelId)).toBeDefined()
    }
    expect(purechatEnabledChatModels).toHaveLength(130)
  })

  it('computeChatCost matches gpt-5.4-nano sample', () => {
    const card = getPureChatModel('gpt-5.4-nano')!
    const result = computeChatCost(card.pricing, { inputTokens: 1000, outputTokens: 1000 })
    expect(result.totalCostUSD).toBeCloseTo(0.00145, 8)
    expect(result.totalCredits).toBe(1450)
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
