import { PURECHAT_PROVIDER_ID, SHANGHAI_TIMEZONE } from '@pure/const'
import { generateText, isStepCount } from 'ai'
import type { LanguageModel, ModelMessage } from 'ai'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { AgentModel } from '@pure/database/models/agent'
import {
  createProviderLanguageModel,
  isSupportedProviderId,
  resolveProviderApiKey,
} from '@/libs/ai-providers/resolveClient'
import {
  assertPureChatCanChat,
  chargePureChatGenerateUsage,
  createPureChatLanguageModel,
} from '@/server/purechat'
import type { PureChatSettlement } from '@/server/purechat'
import { isPureChatRestrictedModelError, PURECHAT_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purechat/gatewayError'
import { resolveChatToolInstructions, resolveChatTools } from '@/server/chat/toolRegistry'
import type { WechatToolArtifact, WechatToolContext } from '@/server/chat/toolRegistry'

const log = debug('channel:wechat:bridge')
const MAX_GENERATION_STEPS = 5
const FINAL_ANSWER_STEP = 3
type WechatUserContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image'; image: string | Uint8Array | URL; mediaType?: string }
    >

export type WechatAgentReply = {
  artifacts: WechatToolArtifact[]
  durationMs: number
  model: string
  provider: string
  text: string
}

export const buildWechatRuntimeInstructions = (now = new Date()) => {
  const currentTime = new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'full',
    timeStyle: 'long',
    timeZone: SHANGHAI_TIMEZONE,
  }).format(now)

  return [
    `当前服务器时间：${currentTime}（${SHANGHAI_TIMEZONE}）。涉及“今天、明天、现在”等相对时间时，以此为准。`,
    '调用工具后必须给出完整最终回答，不要只回复“正在查询”或“稍等”。引用网页资料时附上来源 URL。',
    '不得声称已修改、生成或发送文件，除非相应文件工具明确返回 success=true。',
  ].join('\n')
}

/** 使用绑定 Agent 生成文本回复（环境级 provider 密钥或 PureChat 积分）。 */
export async function generateWechatAgentReply(params: {
  abortSignal?: AbortSignal
  agentId: string
  history?: Array<{ content: string; responseText: string | null }>
  model: string
  provider: string
  userId: string
  userText: string
  userContent?: WechatUserContent
  attachmentContext?: string
  wechatToolContext?: WechatToolContext
}): Promise<WechatAgentReply> {
  const agentModel = new AgentModel(params.userId)
  const agent = await agentModel.findVisibleById(params.agentId)

  if (!agent) {
    throw new Error(`Agent not found: ${params.agentId}`)
  }

  const provider = params.provider
  const modelId = params.model
  const isPureChat = provider === PURECHAT_PROVIDER_ID

  let languageModel: LanguageModel
  let settlement: PureChatSettlement | undefined

  if (isPureChat) {
    settlement = await assertPureChatCanChat(params.userId, modelId)
    const pureChatModel = createPureChatLanguageModel(modelId)
    if (!pureChatModel) {
      throw new Error('PureChat temporarily unavailable')
    }
    languageModel = pureChatModel
  } else {
    if (!isSupportedProviderId(provider)) {
      throw new Error(`Channel provider "${provider}" is not supported by the WeChat gateway`)
    }
    const apiKey = resolveProviderApiKey(provider, undefined, undefined)
    if (!apiKey) {
      throw new Error(
        `No API key for provider "${provider}". Set OPENAI_API_KEY or DEEPSEEK_API_KEY for WeChat replies.`
      )
    }
    languageModel = createProviderLanguageModel(provider, modelId, apiKey, undefined)
  }

  const toolContext = { channel: 'wechat' as const, searchMode: 'auto' as const, wechat: params.wechatToolContext }
  const tools = resolveChatTools(toolContext)

  log('reply agent=%s provider=%s model=%s', agent.id, provider, modelId)

  const messages: ModelMessage[] = []
  for (const turn of params.history ?? []) {
    if (turn.content) messages.push({ content: turn.content, role: 'user' })
    if (turn.responseText) messages.push({ content: turn.responseText, role: 'assistant' })
  }
  messages.push({ content: params.userContent ?? params.userText, role: 'user' })

  const startedAt = Date.now()
  let result: Awaited<ReturnType<typeof generateText>>
  try {
    result = await generateText({
      abortSignal: params.abortSignal,
      messages,
      model: languageModel,
      instructions: [
        agent.systemRole,
        buildWechatRuntimeInstructions(),
        ...resolveChatToolInstructions(toolContext),
        params.attachmentContext,
      ].filter(Boolean).join('\n\n'),
      onStepEnd: ({ finishReason, stepNumber, toolCalls, toolResults }) => {
        log(
          'step agent=%s step=%d finish=%s tools=%s results=%d',
          agent.id,
          stepNumber,
          finishReason,
          toolCalls.map((call) => call.toolName).join(',') || '-',
          toolResults.length
        )
      },
      prepareStep: ({ stepNumber }) =>
        stepNumber >= FINAL_ANSWER_STEP ? { activeTools: [], toolChoice: 'none' as const } : undefined,
      stopWhen: isStepCount(MAX_GENERATION_STEPS),
      tools,
    })
  } catch (error) {
    if (isPureChatRestrictedModelError(error)) {
      throw new Error(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)
    }
    throw error
  }

  const durationMs = Date.now() - startedAt

  if (isPureChat && settlement) {
    try {
      await chargePureChatGenerateUsage({
        durationMs,
        model: modelId,
        result,
        settlementId: settlement.settlementId,
        settlementPeriod: settlement.settlementPeriod,
        userId: params.userId,
      })
    } catch (error) {
      log('charge usage failed agent=%s: %O', agent.id, error)
    }
  }

  log('reply complete agent=%s steps=%d finish=%s chars=%d', agent.id, result.steps.length, result.finishReason, result.text.length)

  const text = result.text?.trim()
  return {
    artifacts: params.wechatToolContext?.producedArtifacts ?? [],
    durationMs,
    model: modelId,
    provider,
    text: text || '（模型未返回内容）',
  }
}

/** Chat SDK 处理器：入站私聊 → Agent → thread.post。 */
export async function handleWechatMention(params: {
  agentId: string
  message: Message
  model: string
  provider: string
  thread: Thread
  userId: string
}): Promise<void> {
  const { agentId, message, model, provider, thread, userId } = params

  if (message.author?.isBot === true) return

  const userText = message.text?.trim()
  if (!userText) return

  try {
    await thread.startTyping().catch(() => {
      /* 正在输入指示为尽力而为 */
    })

    const reply = await generateWechatAgentReply({ agentId, model, provider, userId, userText })
    await thread.post({ markdown: reply.text })
  } catch (error) {
    log('handleMention failed agent=%s: %O', agentId, error)
    const errMsg = error instanceof Error ? error.message : '处理失败'
    try {
      await thread.post({ markdown: `⚠️ ${errMsg}` })
    } catch {
      /* 忽略发送失败 */
    }
  }
}
