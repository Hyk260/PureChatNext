import debug from 'debug'

import {
  fetchOpenAICompatibleModels,
  isSupportedProviderId,
  resolveApiKeyFromHeader,
  resolveModelsListBaseURL,
  resolveProviderApiKey,
  type SupportedProviderId,
} from '@/libs/ai-providers/resolveClient'
import { ChatSDKError } from '@/libs/errors'

export const maxDuration = 30

const log = debug('providers:models')

const BUILTIN_FALLBACK: Record<SupportedProviderId, Array<{ displayName: string; id: string }>> = {
  deepseek: [
    { displayName: 'DeepSeek V4 Flash', id: 'deepseek-v4-flash' },
    { displayName: 'DeepSeek V4 Pro', id: 'deepseek-v4-pro' },
  ],
  openai: [
    { displayName: 'GPT-4o', id: 'gpt-4o' },
    { displayName: 'GPT-4o Mini', id: 'gpt-4o-mini' },
    { displayName: 'OpenAI o1', id: 'o1' },
    { displayName: 'OpenAI o3-mini', id: 'o3-mini' },
  ],
}

/**
 * List provider models (OpenAI-compatible)
 * POST /api/providers/models
 *
 * Body: { provider, apiKey?, baseURL? }
 * Optional header: Authorization: Bearer <api-key>
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

  const apiKey = resolveProviderApiKey(
    provider,
    resolveApiKeyFromHeader(request),
    body.apiKey,
  )
  const baseURL = resolveModelsListBaseURL(provider, body.baseURL)

  if (!apiKey) {
    return new ChatSDKError(
      'bad_request:api',
      `Missing API key for provider "${provider}"`,
    ).toResponse()
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
