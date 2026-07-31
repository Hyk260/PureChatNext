import { CREDITS_PER_DOLLAR } from '@pure/const'

import type { ModelTokenPricing } from './types/aiModel'

/** CNY → USD 粗算汇率（仅自配 deepseek 成本展示；PureHub 禁止走此路径）。 */
export const USD_TO_CNY = 7.12

export type ChatTokenUsage = {
  inputTokens?: number | null
  outputTokens?: number | null
  cachedInputTokens?: number | null
  cacheWriteTokens?: number | null
}

export type ChatCostResult = {
  /** 已换算为 USD */
  totalCostUSD: number
  totalCredits: number
}

const tokens = (n: number | null | undefined) => Math.max(0, Number(n) || 0)

const toUsd = (amount: number, currency: ModelTokenPricing['currency']) =>
  currency === 'CNY' ? amount / USD_TO_CNY : amount

/**
 * 按百万 tokens 单价计算成本（统一折算为 USD），再换算积分。
 * totalCredits = round(totalCostUSD * CREDITS_PER_DOLLAR)
 */
export const computeChatCost = (pricing: ModelTokenPricing, usage: ChatTokenUsage): ChatCostResult => {
  const input = tokens(usage.inputTokens)
  const output = tokens(usage.outputTokens)
  const cacheRead = tokens(usage.cachedInputTokens)
  const cacheWrite = tokens(usage.cacheWriteTokens)

  const billableInput = Math.max(0, input - cacheRead)

  let totalNative = (billableInput / 1_000_000) * pricing.textInput + (output / 1_000_000) * pricing.textOutput

  if (pricing.textInputCacheRead != null && cacheRead > 0) {
    totalNative += (cacheRead / 1_000_000) * pricing.textInputCacheRead
  } else if (cacheRead > 0) {
    totalNative += (cacheRead / 1_000_000) * pricing.textInput
  }

  if (pricing.textInputCacheWrite != null && cacheWrite > 0) {
    totalNative += (cacheWrite / 1_000_000) * pricing.textInputCacheWrite
  }

  const totalCostUSD = toUsd(totalNative, pricing.currency)
  const totalCredits = Math.round(totalCostUSD * CREDITS_PER_DOLLAR)
  return { totalCostUSD, totalCredits }
}
