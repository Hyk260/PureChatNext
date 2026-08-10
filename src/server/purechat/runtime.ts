import { createOpenAI } from '@ai-sdk/openai'
import { PURECHAT_PROVIDER_ID } from '@pure/const'
import { CreditsModel } from '@pure/database/models/credits'
import {
  computeChatCost,
  getEnabledPureChatModel,
  getPureChatModel,
  resolvePureChatGatewayId,
} from '@pure/model-bank'
import { createNanoId } from '@pure/utils'
import type { LanguageModel } from 'ai'

import { llmEnv, resolveAiGatewayApiKey, resolveAiGatewayBaseURL } from '@/envs/llm'
import { PURECHAT_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purechat/gatewayError'
import { getShanghaiBillingPeriod } from '@/server/purechat/period'

export type PureChatSettlement = {
  settlementId: string
  settlementPeriod: string
}

export type PureChatUsageSource = {
  usage: {
    inputTokenDetails: { cacheReadTokens?: number | null }
    inputTokens?: number | null
    outputTokens?: number | null
  }
}

/** PureChat 渠道是否已启用且配置了 AI Gateway 密钥。 */
export const isPureChatRuntimeAvailable = () =>
  Boolean(llmEnv.PURECHAT_ENABLED && resolveAiGatewayApiKey()?.trim())

export const createPureChatLanguageModel = (displayModel: string): LanguageModel | null => {
  const gatewayId = resolvePureChatGatewayId(displayModel)
  const gatewayKey = resolveAiGatewayApiKey()
  if (!gatewayId || !gatewayKey) return null

  return createOpenAI({ apiKey: gatewayKey, baseURL: resolveAiGatewayBaseURL() })(gatewayId)
}

/**
 * PureChat 发请求前预检：开关、模型、Gateway Key、积分余额。
 * 失败抛 Error / FreePlanLimitError（文案可直接展示）。
 */
export async function assertPureChatCanChat(
  userId: string,
  model: string
): Promise<PureChatSettlement> {
  if (!llmEnv.PURECHAT_ENABLED) {
    throw new Error('PureChat is disabled')
  }
  if (!getEnabledPureChatModel(model)) {
    throw new Error(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)
  }
  if (!resolveAiGatewayApiKey()?.trim()) {
    throw new Error('PureChat temporarily unavailable')
  }

  const settlementPeriod = getShanghaiBillingPeriod()
  const settlementId = createNanoId(24)()
  await new CreditsModel().assertCanChat(userId, settlementPeriod)
  return { settlementId, settlementPeriod }
}

export async function chargePureChatGenerateUsage(params: {
  durationMs: number
  model: string
  result: PureChatUsageSource
  settlementId: string
  settlementPeriod: string
  userId: string
}): Promise<void> {
  const card = getPureChatModel(params.model)
  if (!card) return

  const usage = params.result.usage
  const cachedInputTokens = usage.inputTokenDetails.cacheReadTokens ?? undefined
  const inputTokens = usage.inputTokens ?? undefined
  const outputTokens = usage.outputTokens ?? undefined
  if (inputTokens == null && outputTokens == null) return

  const { totalCredits } = computeChatCost(card.pricing, {
    cachedInputTokens,
    inputTokens,
    outputTokens,
  })

  await new CreditsModel().chargeChatUsage({
    cachedInputTokens,
    credits: totalCredits,
    durationMs: params.durationMs,
    inputTokens,
    messageId: params.settlementId,
    model: params.model,
    outputTokens,
    period: params.settlementPeriod,
    provider: PURECHAT_PROVIDER_ID,
    userId: params.userId,
  })
}
