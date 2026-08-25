import { safeValidateUIMessages } from 'ai'
import type { UIMessage } from 'ai'
import { z } from 'zod'
import { searchDocsInputSchema } from '@/lib/ai-schema'

export const MAX_BODY_BYTES = 32 * 1024
export const MAX_MESSAGES = 8
export const MAX_USER_TEXT = 1000

const requestSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(MAX_MESSAGES),
  page: z.string().max(300).optional(),
})

type ChatRequestResult =
  | { data: { messages: UIMessage[]; page?: string }; success: true }
  | { error: string; success: false }

export async function parseChatRequest(rawBody: string): Promise<ChatRequestResult> {
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return { error: '请求内容过大', success: false }
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return { error: '请求格式无效', success: false }
  }

  const parsed = requestSchema.safeParse(json)
  if (!parsed.success) return { error: '消息格式无效', success: false }

  const validated = await safeValidateUIMessages({ messages: parsed.data.messages })
  if (!validated.success) return { error: '消息格式无效', success: false }

  const messages = validated.data
  const lastMessage = messages.at(-1)
  const invalidUserMessage = messages.some(
    (message) =>
      message.role === 'user' &&
      (message.parts.some((part) => part.type !== 'text') ||
        message.parts.reduce((length, part) => length + (part.type === 'text' ? part.text.length : 0), 0) > MAX_USER_TEXT),
  )
  const invalidAssistantMessage = messages.some(
    (message) =>
      message.role === 'assistant' &&
      message.parts.some((part) => {
        if (part.type === 'text' || part.type === 'step-start') return false
        if (part.type !== 'tool-searchDocs') return true
        if (part.state === 'input-streaming') return false
        return !searchDocsInputSchema.safeParse(part.input).success
      }),
  )

  if (invalidUserMessage || invalidAssistantMessage || lastMessage?.role !== 'user') {
    return { error: '消息内容无效', success: false }
  }

  return {
    data: { messages, ...(parsed.data.page ? { page: parsed.data.page } : {}) },
    success: true,
  }
}

export function getAIStreamErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return /429|rate.?limit|too many requests/i.test(message)
    ? 'Ask AI 请求较多，请稍后再试。'
    : 'Ask AI 暂时无法回答，请稍后重试。'
}
