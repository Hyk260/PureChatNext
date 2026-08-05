import { describe, expect, it } from 'vitest'

import {
  assertPureHubPricingComplete,
  computeChatCost,
  getPureHubModel,
  getShanghaiBillingPeriod,
  getNextShanghaiResetAt,
  resolvePureHubDisplayId,
  resolvePureHubGatewayId,
} from './index'

describe('purehub re-exports from model-bank', () => {
  it('maps display id ↔ gateway id', () => {
    expect(resolvePureHubGatewayId('gpt-5.4-mini')).toBe('openai/gpt-5.4-mini')
    expect(resolvePureHubDisplayId('anthropic/claude-sonnet-4.6')).toBe('claude-sonnet-4-6')
    expect(resolvePureHubGatewayId('nope')).toBeUndefined()
  })

  it('requires pricing on all models', () => {
    expect(() => assertPureHubPricingComplete()).not.toThrow()
  })
})

describe('computeChatCost', () => {
  it('matches doc sample for gpt-5.4-mini 1k/1k', () => {
    const card = getPureHubModel('gpt-5.4-mini')
    expect(card).toBeTruthy()
    const result = computeChatCost(card!.pricing, { inputTokens: 1000, outputTokens: 1000 })
    expect(result.totalCostUSD).toBeCloseTo(0.00525, 8)
    expect(result.totalCredits).toBe(5250)
  })
})

describe('shanghai period', () => {
  it('formats YYYY-MM in Asia/Shanghai', () => {
    expect(getShanghaiBillingPeriod(new Date('2026-06-30T23:30:00.000Z'))).toBe('2026-07')
    expect(getShanghaiBillingPeriod(new Date('2026-06-30T15:30:00.000Z'))).toBe('2026-06')
  })

  it('next reset is Shanghai month start', () => {
    const reset = getNextShanghaiResetAt(new Date('2026-07-15T08:00:00.000Z'))
    expect(reset.toISOString()).toBe('2026-07-31T16:00:00.000Z')
  })
})
