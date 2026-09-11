import debug from 'debug'

import {
  fetchOpenAICompatibleModels,
  isSupportedProviderId,
  resolveApiKeyFromHeader,
  resolveModelsListBaseURL,
} from '@/libs/ai-providers/resolveClient'
import type { SupportedProviderId } from '@/libs/ai-providers/resolveClient'
import { MISSING_USER_PROVIDER_SECRET_MESSAGE, resolveUserProviderCredentials } from '@/libs/ai-providers/userSecrets'
import { getAuthenticatedUserId } from '@/libs/auth/get-session-user'
import { ChatSDKError } from '@/libs/errors'

export const maxDuration = 30

const log = debug('providers:models')

const BUILTIN_FALLBACK: Record<SupportedProviderId, Array<{ displayName: string; id: string }>> = {
  deepseek: [
    { displayName: 'DeepSeek V4 Flash', id: 'deepseek-v4-flash' },
    { displayName: 'DeepSeek V4 Flash Vision Exp', id: 'deepseek-v4-flash-vision-exp' },
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
 * @param request - JSON `{ provider, baseURL? }`；密钥来自账号金库，可选 Header `Authorization: Bearer <api-key>` 或服务端 env
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

  const userId = await getAuthenticatedUserId()
  const credentials = await resolveUserProviderCredentials({
    allowEnvFallback: true,
    headerKey: resolveApiKeyFromHeader(request),
    provider,
    requestBaseURL: body.baseURL,
    userId,
  })

  if (!credentials) {
    const message = userId ? MISSING_USER_PROVIDER_SECRET_MESSAGE : `Missing API key for provider "${provider}"`
    return new ChatSDKError('bad_request:api', message).toResponse()
  }

  const baseURL = resolveModelsListBaseURL(provider, credentials.baseURL ?? body.baseURL)

  log('list models provider=%o baseURL=%o', provider, baseURL)

  try {
    const models = await fetchOpenAICompatibleModels({ apiKey: credentials.apiKey, baseURL })
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
