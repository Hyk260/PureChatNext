import { createOpenAI } from '@ai-sdk/openai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai'
import debug from 'debug'

import { ChatSDKError } from '@/libs/errors'

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
  baseURL: string | undefined,
) => {
  const resolvedProvider = provider ?? 'deepseek'
  const resolvedModel = model ?? 'deepseek-v4-flash'
  const options = resolveProviderOptions(apiKey, baseURL)

  switch (resolvedProvider) {
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
 * Optional header: `Authorization: Bearer <api-key>`
 * When present, overrides `DEEPSEEK_API_KEY` / `OPENAI_API_KEY`.
 * Optional body `baseURL` overrides the provider default endpoint.
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

  const apiKey = resolveApiKeyFromHeader(request)
  const resolvedBaseURL = typeof baseURL === 'string' && baseURL.trim() ? baseURL.trim() : undefined

  const resolvedModel = resolveModel(provider, model, apiKey, resolvedBaseURL)

  log('modelId: %o, provider: %o', resolvedModel.modelId, resolvedModel.provider)

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: resolvedModel,
    ...(system?.trim() ? { system: system.trim() } : {}),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      sendReasoning: true,
      stream: result.stream,
    }),
  })
}
