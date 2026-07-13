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

const resolveModel = (
  provider: string | undefined,
  model: string | undefined,
  apiKey: string | undefined,
) => {
  const resolvedProvider = provider ?? 'deepseek'
  const resolvedModel = model ?? 'deepseek-v4-flash'

  switch (resolvedProvider) {
    case 'openai':
      return createOpenAI(apiKey ? { apiKey } : undefined)(resolvedModel)
    case 'deepseek':
    default:
      return createDeepSeek(apiKey ? { apiKey } : undefined)(resolvedModel)
  }
}

/**
 * chat API
 * POST /api/chat
 *
 * Optional header: `Authorization: Bearer <api-key>`
 * When present, overrides `DEEPSEEK_API_KEY` / `OPENAI_API_KEY`.
 */
export async function POST(request: Request) {
  let requestBody: {
    messages: UIMessage[]
    model?: string
    provider?: string
  }

  try {
    requestBody = await request.json()
  } catch {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const { messages, model, provider } = requestBody

  if (!Array.isArray(messages)) {
    return new ChatSDKError('bad_request:api').toResponse()
  }

  const apiKey = resolveApiKeyFromHeader(request)

  const resolvedModel = resolveModel(provider, model, apiKey)

  log('modelId: %o, provider: %o', resolvedModel.modelId, resolvedModel.provider)

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: resolvedModel,
    // system: 'You are a helpful assistant.',
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      sendReasoning: true,
      stream: result.stream,
    }),
  })
}
