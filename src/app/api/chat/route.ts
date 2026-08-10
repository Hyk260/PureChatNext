import { createOpenAI } from '@ai-sdk/openai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { PUREHUB_PROVIDER_ID } from '@pure/const'
import { CreditsModel, FreePlanLimitError } from '@pure/database/models/credits'
import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream } from 'ai'
import type { UIMessage } from 'ai'
import debug from 'debug'
import { createNanoId } from '@pure/utils'

import { getAuthenticatedUserId } from '@/libs/auth/get-session-user'
import { validateBaseURL } from '@/libs/ai-providers/resolveClient'
import { ChatSDKError } from '@/libs/errors'
import { llmEnv, resolveAiGatewayApiKey, resolveAiGatewayBaseURL } from '@/envs/llm'
import {
  computeChatCost,
  getEnabledPureHubModel,
  getPureHubModel,
  getShanghaiBillingPeriod,
  PUREHUB_DEFAULT_MODEL,
  resolvePureHubGatewayId,
} from '@/server/purehub'
import {
  getPureHubStreamErrorMessage,
  isPureHubRestrictedModelError,
  PUREHUB_MODEL_UNAVAILABLE_MESSAGE,
} from '@/server/purehub/gatewayError'

import { createMessageMetadata } from './messageMetadata'

export const maxDuration = 30

const log = debug('chat:route')

/** Prefer Authorization: Bearer <token>; otherwise fall back to provider env keys. */
const resolveApiKeyFromHeader = (request: Request) => {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return undefined

  const token = authHeader.slice('Bearer '.length).trim()
  return token || undefined
}

const resolveProviderOptions = (apiKey: string | undefined, baseURL: string | undefined) => {
  const options: { apiKey?: string; baseURL?: string } = {}
  if (apiKey) options.apiKey = apiKey
  if (baseURL) options.baseURL = baseURL
  return Object.keys(options).length > 0 ? options : undefined
}

const resolveModel = (
  provider: string | undefined,
  model: string | undefined,
  apiKey: string | undefined,
  baseURL: string | undefined
) => {
  const resolvedProvider = provider ?? 'deepseek'
  const resolvedModel = model ?? 'deepseek-v4-flash'
  const options = resolveProviderOptions(apiKey, baseURL)

  switch (resolvedProvider) {
    case PUREHUB_PROVIDER_ID: {
      const gatewayId = resolvePureHubGatewayId(resolvedModel)
      if (!gatewayId) {
        throw new ChatSDKError('bad_request:api', `Unknown PureHub model "${resolvedModel}"`)
      }
      return createOpenAI(options)(gatewayId)
    }
    case 'openai':
      return createOpenAI(options)(resolvedModel)
    case 'deepseek':
    default:
      return createDeepSeek(options)(resolvedModel)
  }
}

/**
 * chat API
 * POST /api/chat
 *
 * PureHub：需登录；使用服务端 AI_GATEWAY_API_KEY；按 usage 扣免费积分。
 * 自配 openai / deepseek：不扣积分；可选 Authorization Bearer 覆盖 env Key。
 */
export async function POST(request: Request) {
  let requestBody: {
    baseURL?: string
    messages: UIMessage[]
    model?: string
    provider?: string
    system?: string
  }

  try {
    requestBody = await request.json()
  } catch {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const { baseURL, messages, model, provider, system } = requestBody

  if (!Array.isArray(messages)) {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const resolvedProvider = provider ?? 'deepseek'
  const isPureHub = resolvedProvider === PUREHUB_PROVIDER_ID

  let userId: string | null = null
  let settlementId: string | undefined
  let settlementPeriod: string | undefined
  let displayModel = model

  if (isPureHub) {
    if (!llmEnv.PUREHUB_ENABLED) {
      return new ChatSDKError('bad_request:api', 'PureHub is disabled').toResponse()
    }

    userId = await getAuthenticatedUserId()
    if (!userId) {
      return new ChatSDKError('unauthorized:chat').toResponse()
    }

    const resolvedDisplayModel = model?.trim() || PUREHUB_DEFAULT_MODEL
    displayModel = resolvedDisplayModel
    const card = getPureHubModel(resolvedDisplayModel)
    if (!card) {
      return new ChatSDKError('bad_request:api', `Unknown PureHub model "${resolvedDisplayModel}"`).toResponse()
    }
    if (!getEnabledPureHubModel(resolvedDisplayModel)) {
      return new ChatSDKError('bad_request:api', PUREHUB_MODEL_UNAVAILABLE_MESSAGE).toResponse()
    }

    const gatewayKey = resolveAiGatewayApiKey()
    if (!gatewayKey) {
      log('PureHub missing AI_GATEWAY_API_KEY')
      return new ChatSDKError('bad_request:api', 'PureHub temporarily unavailable').toResponse()
    }

    settlementPeriod = getShanghaiBillingPeriod()
    settlementId = createNanoId(24)()

    try {
      await new CreditsModel().assertCanChat(userId, settlementPeriod)
    } catch (error) {
      if (error instanceof FreePlanLimitError) {
        return new ChatSDKError('free_plan_limit:chat', error.message).toResponse()
      }
      throw error
    }

    try {
      const usageStartedAt = Date.now()
      const resolvedModel = resolveModel(
        PUREHUB_PROVIDER_ID,
        resolvedDisplayModel,
        gatewayKey,
        resolveAiGatewayBaseURL()
      )

      log('purehub modelId: %o', resolvedModel.modelId)

      const result = streamText({
        messages: await convertToModelMessages(messages),
        model: resolvedModel,
        ...(system?.trim() ? { system: system.trim() } : {}),
        async onFinish({ totalUsage, usage }) {
          if (!userId || !settlementId || !settlementPeriod || !displayModel) return

          const cardForCost = getPureHubModel(displayModel)
          if (!cardForCost) return

          const inputTokens = totalUsage?.inputTokens ?? usage?.inputTokens
          const outputTokens = totalUsage?.outputTokens ?? usage?.outputTokens
          const cachedInputTokens =
            // AI SDK usage shapes vary by provider
            (totalUsage as { cachedInputTokens?: number } | undefined)?.cachedInputTokens ??
            (usage as { cachedInputTokens?: number } | undefined)?.cachedInputTokens

          if (inputTokens == null && outputTokens == null) {
            log('purehub onFinish: no usage, skip charge')
            return
          }

          const { totalCredits } = computeChatCost(cardForCost.pricing, {
            cachedInputTokens,
            inputTokens,
            outputTokens,
          })

          try {
            const charged = await new CreditsModel().chargeChatUsage({
              cachedInputTokens,
              credits: totalCredits,
              durationMs: Date.now() - usageStartedAt,
              inputTokens,
              messageId: settlementId,
              model: displayModel,
              outputTokens,
              period: settlementPeriod,
              provider: PUREHUB_PROVIDER_ID,
              userId,
            })
            log('purehub charged: %o', charged)
          } catch (error) {
            log('purehub charge failed: %o', error)
          }
        },
      })

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          messageMetadata: createMessageMetadata(resolvedDisplayModel, PUREHUB_PROVIDER_ID),
          onError: getPureHubStreamErrorMessage,
          sendReasoning: true,
          stream: result.stream,
        }),
      })
    } catch (error) {
      log('purehub streamText failed: %o', error)
      if (isPureHubRestrictedModelError(error)) {
        return new ChatSDKError('bad_request:api', PUREHUB_MODEL_UNAVAILABLE_MESSAGE).toResponse()
      }
      const message = error instanceof Error ? error.message : 'Failed to start chat stream'
      // 上游鉴权失败等：不扣积分（尚未 onFinish）
      if (/401|unauthorized|invalid.*key/i.test(message)) {
        return new ChatSDKError('bad_request:api', '服务暂不可用，请稍后重试').toResponse()
      }
      if (/429|rate.?limit/i.test(message)) {
        return new ChatSDKError('rate_limit:chat', '上游限流，请稍后重试').toResponse()
      }
      return new ChatSDKError('bad_request:api', message).toResponse()
    }
  }

  const apiKey = resolveApiKeyFromHeader(request)
  let resolvedBaseURL: string | undefined
  try {
    resolvedBaseURL = typeof baseURL === 'string' && baseURL.trim() ? validateBaseURL(baseURL.trim()) : undefined
  } catch (error) {
    return new ChatSDKError('bad_request:api', (error as Error).message).toResponse()
  }

  // Fail fast with a JSON error so the client can surface it (streamText would
  // otherwise return 200 with a broken stream when the env key is missing).
  if (!apiKey) {
    const envKey = resolvedProvider === 'openai' ? process.env.OPENAI_API_KEY : process.env.DEEPSEEK_API_KEY
    if (!envKey?.trim()) {
      return new ChatSDKError('bad_request:api', `Missing API key for provider "${resolvedProvider}"`).toResponse()
    }
  }

  try {
    const resolvedModel = resolveModel(provider, model, apiKey, resolvedBaseURL)

    log('modelId: %o, provider: %o', resolvedModel.modelId, resolvedModel.provider)

    const result = streamText({
      messages: await convertToModelMessages(messages),
      model: resolvedModel,
      ...(system?.trim() ? { system: system.trim() } : {}),
    })

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        messageMetadata: createMessageMetadata(model?.trim() || 'deepseek-v4-flash', resolvedProvider),
        sendReasoning: true,
        stream: result.stream,
      }),
    })
  } catch (error) {
    log('streamText failed: %o', error)
    const message = error instanceof Error ? error.message : 'Failed to start chat stream'
    return new ChatSDKError('bad_request:api', message).toResponse()
  }
}
