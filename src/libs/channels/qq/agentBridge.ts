import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { PURECHAT_PROVIDER_ID } from '@pure/const'
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
import { isPureChatRestrictedModelError, PURECHAT_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purechat/gatewayError'

import { defaultQQModel, isQQProviderId } from './agentSupport'
import { formatQQInboundLog, resolveQQInboundKind } from './inboundLog'

const log = debug('channel:qq:bridge')
const inboundLog = debug('channel:qq:webhook')

/**
 * Generate a text reply using the bound agent (env-level provider keys or PureChat).
 */
export async function generateQQAgentReply(params: {
  agentId: string
  model?: string | null
  provider?: string | null
  userId: string
  userText: string
}): Promise<string> {
  const agentModel = new AgentModel(params.userId)
  const agent = await agentModel.findVisibleById(params.agentId)

  if (!agent) {
    throw new Error(`Agent not found: ${params.agentId}`)
  }

  const providerRaw = params.provider || agent.provider || 'deepseek'
  const provider = isQQProviderId(providerRaw) ? providerRaw : 'deepseek'
  const modelId = params.model || agent.model || defaultQQModel(provider)
  const isPureChat = provider === PURECHAT_PROVIDER_ID

  let languageModel: LanguageModel
  let settlement: Awaited<ReturnType<typeof assertPureChatCanChat>> | undefined

  if (isPureChat) {
    settlement = await assertPureChatCanChat(params.userId, modelId)
    const pureChatModel = createPureChatLanguageModel(modelId)
    if (!pureChatModel) {
      throw new Error('PureChat temporarily unavailable')
    }
    languageModel = pureChatModel
  } else {
    if (!isSupportedProviderId(provider)) {
      throw new Error(`Channel provider "${provider}" is not supported by the QQ gateway`)
    }
    const apiKey = resolveProviderApiKey(provider, undefined, undefined)
    if (!apiKey) {
      throw new Error(`No API key for provider "${provider}". Set OPENAI_API_KEY or DEEPSEEK_API_KEY for QQ replies.`)
    }
    languageModel = createProviderLanguageModel(provider, modelId, apiKey, undefined)
  }

  log('reply agent=%s provider=%s model=%s', agent.id, provider, modelId)

  const startedAt = Date.now()
  let result: Awaited<ReturnType<typeof generateText>>
  try {
    result = await generateText({
      messages: [{ content: params.userText, role: 'user' }],
      model: languageModel,
      ...(agent.systemRole ? { instructions: agent.systemRole } : {}),
    })
  } catch (error) {
    if (isPureChatRestrictedModelError(error)) {
      throw new Error(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)
    }
    throw error
  }

  if (isPureChat && settlement) {
    try {
      await chargePureChatGenerateUsage({
        durationMs: Date.now() - startedAt,
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

  const text = result.text?.trim()
  if (!text) return '（模型未返回内容）'
  return text
}

/**
 * Chat SDK handler: inbound message → Agent → thread.post.
 */
export async function handleQQMention(params: {
  agentId: string
  applicationId: string
  message: Message
  model?: string | null
  provider?: string | null
  thread: Thread
  userId: string
}): Promise<void> {
  const { agentId, applicationId, message, model, provider, thread, userId } = params

  if (message.author?.isBot === true) return

  const userText = message.text?.trim()
  inboundLog(
    formatQQInboundLog({
      applicationId,
      content: userText || '',
      externalUserId: message.author?.userId || 'unknown',
      messageKind: resolveQQInboundKind({ attachments: message.attachments, text: userText }),
    })
  )
  if (!userText) return

  try {
    await thread.startTyping().catch(() => {
      /* typing is best-effort / unsupported on QQ */
    })

    const reply = await generateQQAgentReply({ agentId, model, provider, userId, userText })
    await thread.post({ markdown: reply })
  } catch (error) {
    log('handleMention failed agent=%s: %O', agentId, error)
    const errMsg = error instanceof Error ? error.message : '处理失败'
    try {
      await thread.post({ markdown: `⚠️ ${errMsg}` })
    } catch {
      /* ignore send failure */
    }
  }
}
