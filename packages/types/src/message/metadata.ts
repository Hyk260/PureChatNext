export interface ModelTokensUsage {
  acceptedPredictionTokens?: number
  inputAudioTokens?: number
  inputCachedAudioTokens?: number
  inputCachedImageTokens?: number
  inputCachedTextTokens?: number
  inputCachedTokens?: number
  inputCachedVideoTokens?: number
  inputCacheMissTokens?: number
  inputCitationTokens?: number
  inputImageTokens?: number
  inputTextTokens?: number
  inputToolTokens?: number
  inputVideoTokens?: number
  inputWriteCacheTokens?: number
  outputAudioTokens?: number
  outputImageTokens?: number
  outputReasoningTokens?: number
  outputTextTokens?: number
  rejectedPredictionTokens?: number
  totalInputTokens?: number
  totalOutputTokens?: number
  totalTokens?: number
}

export interface ModelUsage extends ModelTokensUsage {
  cost?: number
}

export interface ModelPerformance {
  duration?: number
  latency?: number
  tps?: number
  ttft?: number
}

export interface MessageReasoningMetadata {
  duration?: number
}

export interface ChatMessageMetadata {
  model?: string
  performance?: ModelPerformance
  provider?: string
  reasoning?: MessageReasoningMetadata
  usage?: ModelUsage
}
