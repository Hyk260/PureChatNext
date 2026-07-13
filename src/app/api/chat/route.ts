import { openai } from '@ai-sdk/openai'
import { deepseek } from '@ai-sdk/deepseek'
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai'

import { ChatSDKError } from '@/libs/errors'

export const maxDuration = 30

const resolveModel = (provider: string | undefined, model: string | undefined) => {
  const resolvedProvider = provider ?? 'deepseek'
  const resolvedModel = model ?? 'deepseek-chat'

  switch (resolvedProvider) {
    case 'openai':
      return openai(resolvedModel)
    case 'deepseek':
    default:
      return deepseek(resolvedModel)
  }
}

/**
 * chat API
 * POST /api/chat
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

  const result = streamText({
    messages: await convertToModelMessages(messages),
    model: resolveModel(provider, model),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  })
}
