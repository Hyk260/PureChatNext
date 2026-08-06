import { createOpenAI } from '@ai-sdk/openai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { normalizeProviderId, PURECHAT_PROVIDER_ID } from '@pure/const'
import { CreditsModel, FreePlanLimitError } from '@pure/database/models/credits'
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, toUIMessageStream } from 'ai'
import type { UIMessage } from 'ai'
import debug from 'debug'
import { createNanoId } from '@pure/utils'

import { getAuthenticatedUserId } from '@/libs/auth/get-session-user'
import { ChatSDKError } from '@/libs/errors'
import { llmEnv, resolveAiGatewayApiKey, resolveAiGatewayBaseURL } from '@/envs/llm'
import {
  computeChatCost,
  getEnabledPureChatModel,
  getPureChatModel,
  getShanghaiBillingPeriod,
  PURECHAT_DEFAULT_MODEL,
  resolvePureChatGatewayId,
} from '@/server/purechat'
import {
  getPureChatStreamErrorMessage,
  isPureChatRestrictedModelError,
  PURECHAT_MODEL_UNAVAILABLE_MESSAGE,
} from '@/server/purechat/gatewayError'
import { resolveChatTools } from '@/server/chat/toolRegistry'

import { createMessageMetadata } from './messageMetadata'

export const maxDuration = 60

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
    case PURECHAT_PROVIDER_ID: {
      const gatewayId = resolvePureChatGatewayId(resolvedModel)
      if (!gatewayId) {
        throw new ChatSDKError('bad_request:api', `Unknown PureChat model "${resolvedModel}"`)
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
 * PureChat：需登录；使用服务端 AI_GATEWAY_API_KEY；按 usage 扣免费积分。
 * 自配 openai / deepseek：不扣积分；可选 Authorization Bearer 覆盖 env Key。
 */
export async function POST(request: Request) {
  let requestBody: {
    baseURL?: string
    messages: UIMessage[]
    model?: string
    provider?: string
    searchMode?: unknown
    system?: string
  }

  try {
    requestBody = await request.json()
  } catch {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const { baseURL, messages, model, system } = requestBody
  const provider = normalizeProviderId(requestBody.provider)

  if (!Array.isArray(messages)) {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  if (requestBody.searchMode !== undefined && requestBody.searchMode !== 'off' && requestBody.searchMode !== 'auto') {
    return new ChatSDKError('bad_request:api', 'Invalid search mode').toResponse()
  }

  const searchMode = requestBody.searchMode ?? 'off'
  const tools = resolveChatTools({ channel: 'web', searchMode })
  const searchOptions =
    Object.keys(tools).length > 0
      ? {
          stopWhen: isStepCount(3),
          tools,
        }
      : {}

  const resolvedProvider = provider ?? 'deepseek'
  const isPureChat = resolvedProvider === PURECHAT_PROVIDER_ID

  let userId: string | null = null
  let settlementId: string | undefined
  let settlementPeriod: string | undefined
  let displayModel = model

  if (isPureChat) {
    if (!llmEnv.PURECHAT_ENABLED) {
      return new ChatSDKError('bad_request:api', 'PureChat is disabled').toResponse()
    }

    userId = await getAuthenticatedUserId()
    if (!userId) {
      return new ChatSDKError('unauthorized:chat').toResponse()
    }

    const resolvedDisplayModel = model?.trim() || PURECHAT_DEFAULT_MODEL
    displayModel = resolvedDisplayModel
    const card = getPureChatModel(resolvedDisplayModel)
    if (!card) {
      return new ChatSDKError('bad_request:api', `Unknown PureChat model "${resolvedDisplayModel}"`).toResponse()
    }
    if (!getEnabledPureChatModel(resolvedDisplayModel)) {
      return new ChatSDKError('bad_request:api', PURECHAT_MODEL_UNAVAILABLE_MESSAGE).toResponse()
    }

    const gatewayKey = resolveAiGatewayApiKey()
    if (!gatewayKey) {
      log('PureChat missing AI_GATEWAY_API_KEY')
      return new ChatSDKError('bad_request:api', 'PureChat temporarily unavailable').toResponse()
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
        PURECHAT_PROVIDER_ID,
        resolvedDisplayModel,
        gatewayKey,
        resolveAiGatewayBaseURL()
      )

      log('purechat modelId: %o', resolvedModel.modelId)

      const result = streamText({
        messages: await convertToModelMessages(messages),
        model: resolvedModel,
        ...searchOptions,
        ...(system?.trim() ? { instructions: system.trim() } : {}),
        async onEnd({ usage }) {
          if (!userId || !settlementId || !settlementPeriod || !displayModel) return

          const cardForCost = getPureChatModel(displayModel)
          if (!cardForCost) return

          const inputTokens = usage.inputTokens
          const outputTokens = usage.outputTokens
          const cachedInputTokens = usage.inputTokenDetails.cacheReadTokens

          if (inputTokens == null && outputTokens == null) {
            log('purechat onEnd: no usage, skip charge')
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
              provider: PURECHAT_PROVIDER_ID,
              userId,
            })
            log('purechat charged: %o', charged)
          } catch (error) {
            log('purechat charge failed: %o', error)
          }
        },
      })

      return createUIMessageStreamResponse({
        stream: toUIMessageStream({
          messageMetadata: createMessageMetadata(resolvedDisplayModel, PURECHAT_PROVIDER_ID),
          onError: getPureChatStreamErrorMessage,
          sendReasoning: true,
          stream: result.stream,
        }),
      })
    } catch (error) {
      log('purechat streamText failed: %o', error)
      if (isPureChatRestrictedModelError(error)) {
        return new ChatSDKError('bad_request:api', PURECHAT_MODEL_UNAVAILABLE_MESSAGE).toResponse()
      }
      const message = error instanceof Error ? error.message : 'Failed to start chat stream'
      // 上游鉴权失败等：不扣积分（尚未 onEnd）
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
  const resolvedBaseURL = typeof baseURL === 'string' && baseURL.trim() ? baseURL.trim() : undefined

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
      ...searchOptions,
      ...(system?.trim() ? { instructions: system.trim() } : {}),
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
