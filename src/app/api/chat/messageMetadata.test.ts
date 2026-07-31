import type { LanguageModelUsage, StepResultPerformance, TextStreamPart, ToolSet } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createMessageMetadata, toModelPerformance, toModelUsage } from './messageMetadata'

const usage: LanguageModelUsage = {
  inputTokenDetails: {
    cacheReadTokens: 20,
    cacheWriteTokens: 5,
    noCacheTokens: 75,
  },
  inputTokens: 100,
  outputTokenDetails: {
    reasoningTokens: 40,
    textTokens: 60,
  },
  outputTokens: 100,
  totalTokens: 200,
}

const performance: StepResultPerformance = {
  effectiveOutputTokensPerSecond: 18,
  effectiveTotalTokensPerSecond: 30,
  inputTokensPerSecond: 90,
  outputTokensPerSecond: 20.25,
  responseTimeMs: 5000,
  stepTimeMs: 5200,
  timeToFirstOutputMs: 1100,
  toolExecutionMs: {},
}

describe('chat message metadata mapping', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps normalized usage fields', () => {
    expect(toModelUsage(usage)).toEqual({
      inputCachedTokens: 20,
      inputCacheMissTokens: 75,
      inputWriteCacheTokens: 5,
      outputReasoningTokens: 40,
      outputTextTokens: 60,
      totalInputTokens: 100,
      totalOutputTokens: 100,
      totalTokens: 200,
    })
  })

  it('uses streaming TPS and TTFT performance', () => {
    expect(toModelPerformance(performance)).toEqual({
      duration: 5200,
      latency: 5000,
      tps: 20.25,
      ttft: 1100,
    })
  })

  it('merges start, step and final metadata', () => {
    const messageMetadata = createMessageMetadata('deepseek-reasoner', 'deepseek')

    expect(messageMetadata({ part: { type: 'start' } })).toEqual({
      model: 'deepseek-reasoner',
      provider: 'deepseek',
    })

    const step = {
      finishReason: 'stop',
      performance,
      providerMetadata: undefined,
      rawFinishReason: undefined,
      response: { id: 'response-1', modelId: 'deepseek-reasoner', timestamp: new Date() },
      type: 'finish-step',
      usage,
    } as TextStreamPart<ToolSet>

    expect(messageMetadata({ part: step })).toMatchObject({
      model: 'deepseek-reasoner',
      performance: { tps: 20.25, ttft: 1100 },
      provider: 'deepseek',
      usage: { totalTokens: 200 },
    })
  })

  it('records reasoning duration when reasoning ends', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2450)
    const messageMetadata = createMessageMetadata('deepseek-reasoner', 'deepseek')

    expect(
      messageMetadata({ part: { id: 'reasoning-1', type: 'reasoning-start' } as TextStreamPart<ToolSet> })
    ).toBeUndefined()
    expect(
      messageMetadata({ part: { id: 'reasoning-1', type: 'reasoning-end' } as TextStreamPart<ToolSet> })
    ).toMatchObject({ reasoning: { duration: 1450 } })
  })
})
