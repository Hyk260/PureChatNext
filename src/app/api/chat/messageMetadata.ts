import type { LanguageModelUsage, StepResultPerformance, TextStreamPart, ToolSet } from 'ai'

import type { ChatMessageMetadata, ModelPerformance, ModelUsage } from '@pure/types'

const finiteNumber = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

export const toModelUsage = (usage: LanguageModelUsage): ModelUsage => ({
  inputCachedTokens: finiteNumber(usage.inputTokenDetails.cacheReadTokens),
  inputCacheMissTokens: finiteNumber(usage.inputTokenDetails.noCacheTokens),
  inputWriteCacheTokens: finiteNumber(usage.inputTokenDetails.cacheWriteTokens),
  outputReasoningTokens: finiteNumber(usage.outputTokenDetails.reasoningTokens),
  outputTextTokens: finiteNumber(usage.outputTokenDetails.textTokens),
  totalInputTokens: finiteNumber(usage.inputTokens),
  totalOutputTokens: finiteNumber(usage.outputTokens),
  totalTokens: finiteNumber(usage.totalTokens),
})

export const toModelPerformance = (performance: StepResultPerformance): ModelPerformance => ({
  duration: finiteNumber(performance.stepTimeMs),
  latency: finiteNumber(performance.responseTimeMs),
  tps: finiteNumber(performance.outputTokensPerSecond ?? performance.effectiveOutputTokensPerSecond),
  ttft: finiteNumber(performance.timeToFirstOutputMs),
})

export const createMessageMetadata = (model: string, provider: string) => {
  let metadata: ChatMessageMetadata = { model, provider }
  let reasoningStartedAt: number | undefined

  const finishReasoning = () => {
    if (reasoningStartedAt === undefined) return false

    metadata = {
      ...metadata,
      reasoning: {
        duration: (metadata.reasoning?.duration ?? 0) + Math.max(0, Date.now() - reasoningStartedAt),
      },
    }
    reasoningStartedAt = undefined
    return true
  }

  return ({ part }: { part: TextStreamPart<ToolSet> }): ChatMessageMetadata | undefined => {
    if (part.type === 'reasoning-start') {
      reasoningStartedAt ??= Date.now()
      return undefined
    }

    if (part.type === 'reasoning-end') {
      return finishReasoning() ? metadata : undefined
    }

    if (part.type === 'finish-step') {
      finishReasoning()
      metadata = {
        ...metadata,
        performance: toModelPerformance(part.performance),
        usage: toModelUsage(part.usage),
      }
      return metadata
    }

    if (part.type === 'finish') {
      finishReasoning()
      metadata = { ...metadata, usage: toModelUsage(part.totalUsage) }
      return metadata
    }

    return part.type === 'start' ? metadata : undefined
  }
}
