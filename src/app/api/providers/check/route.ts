import { generateText } from 'ai'
import debug from 'debug'

import {
  createProviderLanguageModel,
  isSupportedProviderId,
  resolveApiKeyFromHeader,
  resolveOptionalBaseURL,
  resolveProviderApiKey,
} from '@/libs/ai-providers/resolveClient'
import { ChatSDKError } from '@/libs/errors'

export const maxDuration = 30

const log = debug('providers:check')

/**
 * Provider connectivity check
 * POST /api/providers/check
 *
 * Body: { provider, model, apiKey?, baseURL? }
 * Optional header: Authorization: Bearer <api-key>
 */
export async function POST(request: Request) {
  let body: {
    apiKey?: string
    baseURL?: string
    model?: string
    provider?: string
  }

  try {
    body = await request.json()
  } catch {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const provider = body.provider
  const model = typeof body.model === 'string' ? body.model.trim() : ''

  if (!provider || !isSupportedProviderId(provider)) {
    return new ChatSDKError('bad_request:api', 'Unsupported provider').toResponse()
  }

  if (!model) {
    return new ChatSDKError('bad_request:api', 'Missing model').toResponse()
  }

  const apiKey = resolveProviderApiKey(provider, resolveApiKeyFromHeader(request), body.apiKey)
  const baseURL = resolveOptionalBaseURL(body.baseURL)

  if (!apiKey) {
    return new ChatSDKError('bad_request:api', `Missing API key for provider "${provider}"`).toResponse()
  }

  const languageModel = createProviderLanguageModel(provider, model, apiKey, baseURL)

  log('check provider=%o model=%o baseURL=%o', provider, model, baseURL ?? '(default)')

  try {
    const result = await generateText({
      model: languageModel,
      prompt: 'hello',
    })

    if (!result.text?.trim()) {
      return Response.json(
        {
          ok: false,
          error: {
            message: 'Connection check returned empty response',
            type: 'ConnectionCheckFailed',
          },
        },
        { status: 502 }
      )
    }

    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('check failed: %o', message)

    return Response.json(
      {
        ok: false,
        error: {
          body: {
            message,
            model,
            provider,
          },
          message,
          type: 'ConnectionCheckFailed',
        },
      },
      { status: 502 }
    )
  }
}
