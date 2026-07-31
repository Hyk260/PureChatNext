import type { ChatMessageMetadata } from '@pure/types'

export interface UsageDetailItem {
  color: string
  key: string
  label: string
  value: number
}

export interface MessageUsageDetails {
  input: UsageDetailItem[]
  output: UsageDetailItem[]
  totalTokens?: number
}

const nonNegative = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : undefined

const positiveItem = (key: string, label: string, color: string, value: number | undefined) =>
  value !== undefined && value > 0 ? { color, key, label, value } : undefined

export const getMessageUsageDetails = (metadata: ChatMessageMetadata): MessageUsageDetails => {
  const usage = metadata.usage
  if (!usage) return { input: [], output: [] }

  const totalInput = nonNegative(usage.totalInputTokens)
  const cachedInput = nonNegative(usage.inputCachedTokens)
  const cacheWriteInput = nonNegative(usage.inputWriteCacheTokens)
  const inputTool = nonNegative(usage.inputToolTokens)
  const uncachedInput =
    nonNegative(usage.inputCacheMissTokens) ??
    (totalInput === undefined
      ? undefined
      : Math.max(0, totalInput - (cachedInput ?? 0) - (cacheWriteInput ?? 0) - (inputTool ?? 0)))

  const totalOutput = nonNegative(usage.totalOutputTokens)
  const reasoningOutput = nonNegative(usage.outputReasoningTokens)
  const imageOutput = nonNegative(usage.outputImageTokens)
  const audioOutput = nonNegative(usage.outputAudioTokens)
  const textOutput =
    nonNegative(usage.outputTextTokens) ??
    (totalOutput === undefined
      ? undefined
      : Math.max(0, totalOutput - (reasoningOutput ?? 0) - (imageOutput ?? 0) - (audioOutput ?? 0)))

  const totalTokens =
    nonNegative(usage.totalTokens) ??
    (totalInput !== undefined || totalOutput !== undefined ? (totalInput ?? 0) + (totalOutput ?? 0) : undefined)

  return {
    input: [
      positiveItem('uncached-input', '未缓存输入', '#d9d9d9', uncachedInput),
      positiveItem('cached-input', '缓存读取', '#faad14', cachedInput),
      positiveItem('cache-write-input', '缓存写入', '#fadb14', cacheWriteInput),
      positiveItem('tool-input', '工具输入', '#597ef7', inputTool),
      positiveItem('output', '输出', '#34a853', totalOutput),
    ].filter((item): item is UsageDetailItem => Boolean(item)),
    output: [
      positiveItem('reasoning-output', '深度思考', '#eb2f96', reasoningOutput),
      positiveItem('text-output', '文本输出', '#34a853', textOutput),
      positiveItem('image-output', '图像输出', '#722ed1', imageOutput),
      positiveItem('audio-output', '音频输出', '#13c2c2', audioOutput),
    ].filter((item): item is UsageDetailItem => Boolean(item)),
    totalTokens,
  }
}
