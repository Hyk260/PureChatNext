import { generateText } from 'ai'
import debug from 'debug'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { FreePlanLimitError } from '@pure/database/models/credits'
import { getEnabledPureChatModel, PURECHAT_DEFAULT_MODEL } from '@pure/model-bank'
import {
  createProviderLanguageModel,
  resolveApiKeyFromHeader,
} from '@/libs/ai-providers/resolveClient'
import { MISSING_USER_PROVIDER_SECRET_MESSAGE, resolveUserProviderCredentials } from '@/libs/ai-providers/userSecrets'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { assertPureChatCanChat, chargePureChatGenerateUsage, createPureChatLanguageModel } from '@/server/purechat'
import { isPureChatRestrictedModelError, PURECHAT_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purechat/gatewayError'

export const maxDuration = 30

const log = debug('agents:generate-profile')
const GENERATE_MODEL = 'deepseek-v4-flash'
const GENERATE_PROVIDER = 'deepseek' as const
const MAX_OPENING_QUESTIONS = 3

const bodySchema = z.object({
  description: z.string().trim().min(1).max(1000),
  systemRole: z.string().trim().max(8000).optional(),
  title: z.string().trim().max(100).optional(),
})

const profileSchema = z.object({
  openingMessage: z.string(),
  openingQuestions: z.array(z.string()),
})

export type GeneratedAgentProfile = {
  openingMessage: string
  openingQuestions: string[]
}

const extractJsonObject = (text: string): unknown => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced?.[1] ?? text
  const keyIndex = raw.search(/"openingMessage"/)
  const start = keyIndex === -1 ? raw.indexOf('{') : raw.lastIndexOf('{', keyIndex)
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

export function parseGeneratedAgentProfile(text: string): GeneratedAgentProfile | null {
  const parsed = profileSchema.safeParse(extractJsonObject(text))
  if (!parsed.success) return null

  const openingMessage = parsed.data.openingMessage.trim()
  const openingQuestions = parsed.data.openingQuestions
    .map((question) => question.trim())
    .filter(Boolean)
    .slice(0, MAX_OPENING_QUESTIONS)

  if (!openingMessage || openingQuestions.length === 0) return null
  return { openingMessage, openingQuestions }
}

const buildPrompt = (input: z.infer<typeof bodySchema>) => {
  const lines = [`描述：${input.description}`]
  if (input.title) lines.unshift(`名称：${input.title}`)
  if (input.systemRole) lines.push(`系统提示词：${input.systemRole}`)
  return lines.join('\n')
}

const toPureChatError = (error: unknown) => {
  if (error instanceof FreePlanLimitError) return jsonError(error.message, 429)
  const message = error instanceof Error ? error.message : 'PureChat temporarily unavailable'
  if (message === PURECHAT_MODEL_UNAVAILABLE_MESSAGE) return jsonError(message)
  if (message === 'PureChat is disabled') return jsonError(MISSING_USER_PROVIDER_SECRET_MESSAGE)
  if (message === 'PureChat temporarily unavailable') return jsonError(message, 503)
  return null
}

/**
 * POST /api/agents/generate-profile
 * 根据名称、描述和系统提示词生成开场消息与开场问题
 * @param request - JSON body（description 必填）
 */
export const POST = withAuth(async (request, { userId }) => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('Invalid request body')
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return jsonError('请先填写简短描述')

  const credentials = await resolveUserProviderCredentials({
    allowEnvFallback: true,
    headerKey: resolveApiKeyFromHeader(request),
    provider: GENERATE_PROVIDER,
    userId,
  })

  let languageModel = credentials
    ? createProviderLanguageModel(GENERATE_PROVIDER, GENERATE_MODEL, credentials.apiKey, credentials.baseURL)
    : null
  let model = GENERATE_MODEL
  let provider: 'deepseek' | 'purechat' = GENERATE_PROVIDER
  let settlementId: string | undefined
  let settlementPeriod: string | undefined

  if (!languageModel) {
    // ponytail: PureChat 目录未启用 flash，无 DeepSeek key 时回落默认模型
    model = getEnabledPureChatModel(GENERATE_MODEL)?.id ?? PURECHAT_DEFAULT_MODEL
    provider = 'purechat'
    try {
      const settlement = await assertPureChatCanChat(userId, model)
      settlementId = settlement.settlementId
      settlementPeriod = settlement.settlementPeriod
    } catch (error) {
      const response = toPureChatError(error)
      if (response) return response
      throw error
    }

    languageModel = createPureChatLanguageModel(model)
    if (!languageModel) return jsonError('PureChat temporarily unavailable', 503)
  }

  const startedAt = Date.now()

  try {
    const result = await generateText({
      instructions:
        '你为自定义助理补全开场内容。只输出 JSON：{"openingMessage":"...","openingQuestions":["...","...","..."]}。openingMessage 用 1–3 句中文欢迎用户，点明能帮什么，不要 Markdown。openingQuestions 恰好 3 条、每条不超过 24 字，像用户会点的短问题。',
      maxOutputTokens: 2_048,
      model: languageModel,
      prompt: buildPrompt(parsed.data),
      temperature: 0.4,
    })

    const raw = [result.text, result.reasoningText].filter((part) => part?.trim()).join('\n')
    const profile = parseGeneratedAgentProfile(raw)
    if (!profile) {
      log('unparseable profile text: %s', raw.slice(0, 500))
      return jsonError('模型返回内容无法解析，请重试', 502)
    }

    if (provider === 'purechat' && settlementId && settlementPeriod) {
      try {
        await chargePureChatGenerateUsage({
          durationMs: Date.now() - startedAt,
          model,
          result,
          settlementId,
          settlementPeriod,
          trigger: 'web',
          userId,
        })
      } catch (error) {
        log('charge usage failed: %o', error)
      }
    }

    return NextResponse.json(profile)
  } catch (error) {
    log('generate profile failed: %o', error)
    if (isPureChatRestrictedModelError(error)) return jsonError(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (/429|rate.?limit/i.test(errorMessage)) return jsonError('上游限流，请稍后重试', 429)
    return jsonError('生成失败，请稍后重试', 502)
  }
})
