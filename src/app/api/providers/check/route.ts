import { generateText } from 'ai'
import debug from 'debug'

import { FreePlanLimitError } from '@pure/database/models/credits'
import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'

import { DEFAULT_PROVIDER_CHECK_TIMEOUT_MS } from '@/libs/ai-providers/checkTimeout'
import {
  createProviderLanguageModel,
  isSupportedProviderId,
  resolveApiKeyFromHeader,
  resolveOptionalBaseURL,
  resolveProviderApiKey,
} from '@/libs/ai-providers/resolveClient'
import { getAuthenticatedUserId } from '@/libs/auth/get-session-user'
import { ChatSDKError } from '@/libs/errors'
import { withHealthTimeout } from '@/server/health/dependencies'
import {
  assertPureChatCanChat,
  chargePureChatGenerateUsage,
  createPureChatLanguageModel,
} from '@/server/purechat/runtime'

export const maxDuration = 150

const log = debug('providers:check')
const DEFAULT_TIMEOUT_MS = DEFAULT_PROVIDER_CHECK_TIMEOUT_MS
const MIN_TIMEOUT_MS = 1_000
const MAX_TIMEOUT_MS = 120_000
const HEALTH_CHECK_DEFAULT_MAX_OUTPUT_TOKENS = 128
const HEALTH_CHECK_REASONING_MAX_OUTPUT_TOKENS = 256
const HEALTH_CHECK_MAX_OUTPUT_TOKEN_CAP = 1_024

const getHealthCheckPlan = (provider: string, model: string) => {
  const card = getAiModel(provider as ModelProviderId, model)
  const modelMaxOutputTokens = card?.maxOutput && card.maxOutput > 0 ? card.maxOutput : 4_096
  const hardCap = Math.min(modelMaxOutputTokens, HEALTH_CHECK_MAX_OUTPUT_TOKEN_CAP)
  const initial = card?.abilities?.reasoning
    ? HEALTH_CHECK_REASONING_MAX_OUTPUT_TOKENS
    : HEALTH_CHECK_DEFAULT_MAX_OUTPUT_TOKENS

  return {
    card,
    budgets: [...new Set([Math.min(initial, hardCap), hardCap])],
  }
}

const normalizeTimeoutMs = (value: unknown) => {
  const timeoutMs = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_TIMEOUT_MS
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, timeoutMs))
}

const truncate = (value: string, maxLength = 120) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value

const getErrorValues = (error: unknown) => {
  const values: unknown[] = []
  const pending: unknown[] = [error]
  const visited = new Set<object>()

  while (pending.length > 0) {
    const current = pending.shift()
    if (current == null) continue

    values.push(current)
    if (typeof current !== 'object') continue
    if (visited.has(current)) continue
    visited.add(current)

    const candidate = current as {
      cause?: unknown
      errors?: unknown
      lastError?: unknown
    }
    if (candidate.lastError) pending.push(candidate.lastError)
    if (candidate.cause) pending.push(candidate.cause)
    if (Array.isArray(candidate.errors)) pending.push(...candidate.errors)
  }

  return values
}

const getStatusCode = (error: unknown) => {
  for (const value of getErrorValues(error)) {
    if (!value || typeof value !== 'object') continue
    const candidate = value as { status?: unknown; statusCode?: unknown }
    const status = candidate.status ?? candidate.statusCode
    if (typeof status === 'number') return status
  }

  return undefined
}

const summarizeCheckError = (error: unknown, timeoutMs: number) => {
  const rawMessage = getErrorValues(error)
    .map((value) => (value instanceof Error ? value.message : typeof value === 'string' ? value : ''))
    .filter(Boolean)
    .join(' | ')
  const message = rawMessage.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/sk-[\w-]+/gi, '[redacted]')
  const status = getStatusCode(error) ?? message.match(/\b(401|403|404|408|429|5\d{2})\b/)?.[1]

  if (error instanceof Error && error.name === 'AbortError') return `请求超时（${Math.round(timeoutMs / 1000)} 秒）`
  if (/timeout|timed out|aborted/i.test(message)) return `请求超时（${Math.round(timeoutMs / 1000)} 秒）`
  if (status === 401 || /unauthorized|invalid api key|authentication/i.test(message)) return '鉴权失败'
  if (status === 403 || /forbidden|permission/i.test(message)) return '无权限'
  if (status === 404 || /not found|model.*exist/i.test(message)) return '模型不存在或接口地址错误'
  if (status === 429 || /rate limit|too many requests/i.test(message)) return '上游限流，请稍后重试'
  if (/fetch failed|network|connect|dns/i.test(message)) return '网络请求失败'

  return `接口错误：${truncate(message || '未知错误')}`
}

const getFailureStatus = (error: unknown) => (getStatusCode(error) === 429 ? 429 : 502)

const failedResponse = (model: string, provider: string, message: string, status = 502) =>
  Response.json(
    {
      ok: false,
      model,
      provider,
      error: {
        message,
        type: 'ConnectionCheckFailed',
      },
    },
    { status }
  )

/**
 * POST /api/providers/check
 * 检测 Provider 连通性（发起一次最小生成请求）
 * @param request - JSON `{ provider, model, apiKey?, baseURL? }`；可选 Header `Authorization: Bearer <api-key>`
 */
export async function POST(request: Request) {
  let body: {
    apiKey?: string
    baseURL?: string
    model?: string
    provider?: string
    timeoutMs?: number
  }

  try {
    body = await request.json()
  } catch {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const provider = body.provider
  const model = typeof body.model === 'string' ? body.model.trim() : ''
  const timeoutMs = normalizeTimeoutMs(body.timeoutMs)

  if (!provider || (provider !== 'purechat' && !isSupportedProviderId(provider))) {
    return new ChatSDKError('bad_request:api', 'Unsupported provider').toResponse()
  }

  if (!model) {
    return new ChatSDKError('bad_request:api', 'Missing model').toResponse()
  }

  const baseURL = resolveOptionalBaseURL(body.baseURL)
  let languageModel
  let pureChatContext:
    | {
        settlementId: string
        settlementPeriod: string
        userId: string
      }
    | undefined

  if (provider === 'purechat') {
    const userId = await getAuthenticatedUserId()
    if (!userId) return new ChatSDKError('unauthorized:chat').toResponse()

    try {
      const settlement = await assertPureChatCanChat(userId, model)
      const pureChatModel = createPureChatLanguageModel(model)
      if (!pureChatModel) return failedResponse(model, provider, 'PureChat 暂不可用', 503)

      languageModel = pureChatModel
      pureChatContext = { ...settlement, userId }
    } catch (error) {
      if (error instanceof FreePlanLimitError) {
        return new ChatSDKError('free_plan_limit:chat', error.message).toResponse()
      }

      const message = error instanceof Error ? error.message : String(error)
      return failedResponse(
        model,
        provider,
        summarizeCheckError(error, timeoutMs),
        /disabled|unavailable/i.test(message) ? 503 : 400
      )
    }
  } else {
    const apiKey = resolveProviderApiKey(provider, resolveApiKeyFromHeader(request), body.apiKey)

    if (!apiKey) {
      return new ChatSDKError('bad_request:api', `Missing API key for provider "${provider}"`).toResponse()
    }

    languageModel = createProviderLanguageModel(provider, model, apiKey, baseURL, { timeoutMs })
  }

  log('check provider=%o model=%o baseURL=%o timeoutMs=%o', provider, model, baseURL ?? '(default)', timeoutMs)

  try {
    const startedAt = Date.now()
    const { budgets, card } = getHealthCheckPlan(provider, model)
    const totalUsage = {
      inputTokenDetails: {} as { cacheReadTokens?: number | null },
      inputTokens: undefined as number | undefined,
      outputTokens: undefined as number | undefined,
    }
    let responseText = ''
    let lastFinishReason: unknown

    for (const [attempt, maxOutputTokens] of budgets.entries()) {
      const result = await withHealthTimeout(
        (signal) =>
          generateText({
            abortSignal: signal,
            ...(card?.abilities?.reasoning ? { reasoning: 'minimal' as const } : {}),
            maxOutputTokens,
            maxRetries: 0,
            model: languageModel,
            prompt: 'Reply with exactly pong.',
          }),
        { timeoutMs }
      )

      const inputTokens = result.usage?.inputTokens
      const outputTokens = result.usage?.outputTokens
      const cacheReadTokens = result.usage?.inputTokenDetails?.cacheReadTokens
      if (typeof inputTokens === 'number') {
        totalUsage.inputTokens = (totalUsage.inputTokens ?? 0) + inputTokens
      }
      if (typeof outputTokens === 'number') {
        totalUsage.outputTokens = (totalUsage.outputTokens ?? 0) + outputTokens
      }
      if (typeof cacheReadTokens === 'number') {
        totalUsage.inputTokenDetails.cacheReadTokens =
          (totalUsage.inputTokenDetails.cacheReadTokens ?? 0) + cacheReadTokens
      }

      responseText = result.text?.trim() || ''
      lastFinishReason = result.finishReason
      if (responseText) break

      log(
        'check returned empty response provider=%o model=%o attempt=%o maxOutputTokens=%o finishReason=%o',
        provider,
        model,
        attempt + 1,
        maxOutputTokens,
        result.finishReason
      )
      if (result.finishReason !== 'length') break
    }

    if (!responseText) {
      return failedResponse(
        model,
        provider,
        lastFinishReason === 'length' ? '模型输出达到上限，仍未生成最终文本' : '模型返回空响应'
      )
    }

    if (pureChatContext) {
      await chargePureChatGenerateUsage({
        durationMs: Date.now() - startedAt,
        model,
        result: { usage: totalUsage },
        settlementId: pureChatContext.settlementId,
        settlementPeriod: pureChatContext.settlementPeriod,
        userId: pureChatContext.userId,
      }).catch((error) => log('purechat health check charge failed: %o', error))
    }

    return Response.json({
      durationMs: Date.now() - startedAt,
      model,
      ok: true,
      provider,
    })
  } catch (error) {
    const message = summarizeCheckError(error, timeoutMs)
    const status = getFailureStatus(error)
    log(
      'check failed provider=%o model=%o status=%o errorType=%o reason=%o',
      provider,
      model,
      status,
      error instanceof Error ? error.name : typeof error,
      message
    )
    return failedResponse(model, provider, message, status)
  }
}
