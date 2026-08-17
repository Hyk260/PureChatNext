import debug from 'debug'

import {
  fetchOpenAICompatibleModels,
  isSupportedProviderId,
  resolveApiKeyFromHeader,
  resolveModelsListBaseURL,
  resolveProviderApiKey,
} from '@/libs/ai-providers/resolveClient'
import type { SupportedProviderId } from '@/libs/ai-providers/resolveClient'
import { ChatSDKError } from '@/libs/errors'

export const maxDuration = 30

const log = debug('providers:models')

const BUILTIN_FALLBACK: Record<SupportedProviderId, Array<{ displayName: string; id: string }>> = {
  deepseek: [
    { displayName: 'DeepSeek V4 Flash', id: 'deepseek-v4-flash' },
    { displayName: 'DeepSeek V4 Pro', id: 'deepseek-v4-pro' },
  ],
  openai: [
    { displayName: 'GPT-5.6 Sol', id: 'gpt-5.6-sol' },
    { displayName: 'GPT-5.5', id: 'gpt-5.5' },
    { displayName: 'GPT-5.4 mini', id: 'gpt-5.4-mini' },
    { displayName: 'GPT-5.4 nano', id: 'gpt-5.4-nano' },
  ],
}

/**
 * POST /api/providers/models
 * 列出 Provider 模型（OpenAI 兼容 /models）
 * @param request - JSON `{ provider, apiKey?, baseURL? }`；可选 Header `Authorization: Bearer <api-key>`
 */
export async function POST(request: Request) {
  let body: {
    apiKey?: string
    baseURL?: string
    provider?: string
  }

  try {
    body = await request.json()
  } catch {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const provider = body.provider
  if (!provider || !isSupportedProviderId(provider)) {
    return new ChatSDKError('bad_request:api', 'Unsupported provider').toResponse()
  }

  const apiKey = resolveProviderApiKey(provider, resolveApiKeyFromHeader(request), body.apiKey)
  const baseURL = resolveModelsListBaseURL(provider, body.baseURL)

  if (!apiKey) {
    return new ChatSDKError('bad_request:api', `Missing API key for provider "${provider}"`).toResponse()
  }

  log('list models provider=%o baseURL=%o', provider, baseURL)

  try {
    const models = await fetchOpenAICompatibleModels({ apiKey, baseURL })
    return Response.json({ fallback: false, models })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('list models failed, fallback builtin: %o', message)

    return Response.json({
      fallback: true,
      message,
      models: BUILTIN_FALLBACK[provider],
    })
  }
}
