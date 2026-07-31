import { describe, expect, it } from 'vitest'

import { getMessageUsageDetails } from '@/features/chat/usageDetails'

describe('getMessageUsageDetails', () => {
  it('builds output and cache breakdowns', () => {
    const details = getMessageUsageDetails({
      usage: {
        inputCachedTokens: 20,
        inputWriteCacheTokens: 5,
        outputReasoningTokens: 40,
        outputTextTokens: 60,
        totalInputTokens: 100,
        totalOutputTokens: 100,
        totalTokens: 200,
      },
    })

    expect(details.output.map(({ key, value }) => [key, value])).toEqual([
      ['reasoning-output', 40],
      ['text-output', 60],
    ])
    expect(details.input.map(({ key, value }) => [key, value])).toEqual([
      ['uncached-input', 75],
      ['cached-input', 20],
      ['cache-write-input', 5],
      ['output', 100],
    ])
    expect(details.totalTokens).toBe(200)
  })

  it('derives text and total tokens while clamping negative values', () => {
    const details = getMessageUsageDetails({
      usage: {
        inputCachedTokens: 80,
        outputReasoningTokens: 120,
        totalInputTokens: 50,
        totalOutputTokens: 90,
      },
    })

    expect(details.input.find((item) => item.key === 'uncached-input')).toBeUndefined()
    expect(details.output.find((item) => item.key === 'text-output')).toBeUndefined()
    expect(details.totalTokens).toBe(140)
  })

  it('omits unavailable metrics instead of rendering zero rows', () => {
    expect(getMessageUsageDetails({})).toEqual({ input: [], output: [] })
  })
})
