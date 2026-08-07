import { normalizeProviderId, PURECHAT_PROVIDER_ID } from '@pure/const'
import { FreePlanLimitError } from '@pure/database/models/credits'
import { ChatMessageModel } from '@pure/database/models/chatMessage'
import { ChatTopicModel } from '@pure/database/models/chatTopic'
import { generateText } from 'ai'
import type { LanguageModel, UIMessage } from 'ai'
import debug from 'debug'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

import {
  createProviderLanguageModel,
  isSupportedProviderId,
  resolveApiKeyFromHeader,
  resolveOptionalBaseURL,
  resolveProviderApiKey,
} from '@/libs/ai-providers/resolveClient'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import {
  assertPureChatCanChat,
  chargePureChatGenerateUsage,
  createPureChatLanguageModel,
} from '@/server/purechat'
import { isPureChatRestrictedModelError, PURECHAT_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purechat/gatewayError'

export const maxDuration = 30

const log = debug('chat:auto-rename')
const MAX_TRANSCRIPT_LENGTH = 12_000
const MAX_TITLE_LENGTH = 30

const bodySchema = z.object({
  baseURL: z.string().trim().max(2048).optional(),
  model: z.string().trim().min(1).max(256),
  provider: z.string().trim().min(1).max(64),
})

const getMessageText = (message: UIMessage) =>
  message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim()

const buildTranscript = (messages: UIMessage[]) => {
  const transcript = messages
    .map((message) => {
      const text = getMessageText(message)
      if (!text) return ''
      const role = message.role === 'user' ? '用户' : message.role === 'assistant' ? '助手' : '系统'
      return `${role}：${text}`
    })
    .filter(Boolean)
    .join('\n\n')

  return transcript.length > MAX_TRANSCRIPT_LENGTH
    ? transcript.slice(transcript.length - MAX_TRANSCRIPT_LENGTH)
    : transcript
}

export const normalizeGeneratedTitle = (value: string) => {
  const firstLine = value
    .replace(/```(?:text)?/gi, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean)

  if (!firstLine) return ''

  const title = firstLine
    .replace(/^#{1,6}\s*/, '')
    .replace(/^(?:会话)?标题\s*[:：]\s*/i, '')
    .replace(/^[`'"“”‘’]+|[`'"“”‘’]+$/g, '')
    .trim()

  if (!title) return ''
  if (title.length <= MAX_TITLE_LENGTH) return title
  return `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`
}

const createSelfHostedModel = (request: NextRequest, provider: string, model: string, baseURL?: string) => {
  if (!isSupportedProviderId(provider)) return null

  const apiKey = resolveProviderApiKey(provider, resolveApiKeyFromHeader(request), undefined)
  if (!apiKey) return null

  return createProviderLanguageModel(provider, model, apiKey, resolveOptionalBaseURL(baseURL))
}

export const POST = withAuth<{ id: string }>(async (request, { params, userId }) => {
  const { id } = await params
  const topicModel = new ChatTopicModel(userId)
  const topic = await topicModel.findById(id)
  if (!topic) return jsonError('Topic not found', 404)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid request body')
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.message)

  const { baseURL, model } = parsed.data
  const provider = normalizeProviderId(parsed.data.provider) ?? parsed.data.provider
  const messages = await new ChatMessageModel(userId).listByTopic(id)
  const transcript = buildTranscript(messages)
  if (!transcript) return jsonError('Topic has no text messages')

  const isPureChat = provider === PURECHAT_PROVIDER_ID
  let languageModel: LanguageModel | null
  let settlementId: string | undefined
  let settlementPeriod: string | undefined

  if (isPureChat) {
    try {
      const settlement = await assertPureChatCanChat(userId, model)
      settlementId = settlement.settlementId
      settlementPeriod = settlement.settlementPeriod
    } catch (error) {
      if (error instanceof FreePlanLimitError) return jsonError(error.message, 429)
      const message = error instanceof Error ? error.message : 'PureChat temporarily unavailable'
      if (message === PURECHAT_MODEL_UNAVAILABLE_MESSAGE) return jsonError(message)
      if (message === 'PureChat is disabled') return jsonError(message)
      if (message === 'PureChat temporarily unavailable') return jsonError(message, 503)
      throw error
    }

    languageModel = createPureChatLanguageModel(model)
    if (!languageModel) return jsonError('PureChat temporarily unavailable', 503)
  } else {
    languageModel = createSelfHostedModel(request, provider, model, baseURL)
    if (!isSupportedProviderId(provider)) return jsonError('Unsupported provider')
    if (!languageModel) return jsonError(`Missing API key for provider "${provider}"`)
  }

  const startedAt = Date.now()
  try {
    const result = await generateText({
      instructions:
        '请根据对话生成一个简洁、具体的中文会话标题。标题最多 30 个字符，只输出标题本身，不要解释、引号、Markdown 或句末标点。',
      maxOutputTokens: 64,
      model: languageModel,
      prompt: transcript,
      temperature: 0.2,
    })
    const title = normalizeGeneratedTitle(result.text)
    if (!title) return jsonError('Model returned an empty title', 502)

    if (isPureChat && settlementId && settlementPeriod) {
      try {
        await chargePureChatGenerateUsage({
          durationMs: Date.now() - startedAt,
          model,
          result,
          settlementId,
          settlementPeriod,
          userId,
        })
      } catch (error) {
        log('charge usage failed: %o', error)
      }
    }

    const updated = await topicModel.update(id, { title })
    if (!updated) return jsonError('Topic not found', 404)
    return NextResponse.json(updated)
  } catch (error) {
    log('generate title failed: %o', error)
    if (isPureChatRestrictedModelError(error)) return jsonError(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)

    const errorMessage = error instanceof Error ? error.message : String(error)
    if (/429|rate.?limit/i.test(errorMessage)) return jsonError('上游限流，请稍后重试', 429)
    return jsonError('智能重命名失败，请稍后重试', 502)
  }
})
