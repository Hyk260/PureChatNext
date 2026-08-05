import { generateText } from 'ai'
import type { ModelMessage } from 'ai'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { AgentModel } from '@pure/database/models/agent'
import {
  createProviderLanguageModel,
  isSupportedProviderId,
  resolveProviderApiKey,
} from '@/libs/ai-providers/resolveClient'

const log = debug('channel:wechat:bridge')

/**
 * Generate a text reply using the bound agent (env-level provider keys).
 */
export async function generateWechatAgentReply(params: {
  abortSignal?: AbortSignal
  agentId: string
  history?: Array<{ content: string; responseText: string | null }>
  userId: string
  userText: string
}): Promise<string> {
  const agentModel = new AgentModel(params.userId)
  const agent = await agentModel.findVisibleById(params.agentId)

  if (!agent) {
    throw new Error(`Agent not found: ${params.agentId}`)
  }

  const providerRaw = agent.provider?.trim() || 'deepseek'
  if (!isSupportedProviderId(providerRaw)) {
    throw new Error(`Agent provider "${providerRaw}" is not supported by the WeChat gateway`)
  }
  const provider = providerRaw
  const modelId = agent.model ?? (provider === 'openai' ? 'gpt-5.4-mini' : 'deepseek-v4-flash')
  const apiKey = resolveProviderApiKey(provider, undefined, undefined)

  if (!apiKey) {
    throw new Error(`No API key for provider "${provider}". Set OPENAI_API_KEY or DEEPSEEK_API_KEY for WeChat replies.`)
  }

  const languageModel = createProviderLanguageModel(provider, modelId, apiKey, undefined)

  log('reply agent=%s provider=%s model=%s', agent.id, provider, modelId)

  const messages: ModelMessage[] = []
  for (const turn of params.history ?? []) {
    messages.push({ content: turn.content, role: 'user' })
    if (turn.responseText) messages.push({ content: turn.responseText, role: 'assistant' })
  }
  messages.push({ content: params.userText, role: 'user' })

  const result = await generateText({
    abortSignal: params.abortSignal,
    messages,
    model: languageModel,
    ...(agent.systemRole ? { instructions: agent.systemRole } : {}),
  })

  const text = result.text?.trim()
  if (!text) {
    return '（模型未返回内容）'
  }
  return text
}

/**
 * Chat SDK handler: inbound DM → Agent → thread.post.
 */
export async function handleWechatMention(params: {
  agentId: string
  message: Message
  thread: Thread
  userId: string
}): Promise<void> {
  const { agentId, message, thread, userId } = params

  if (message.author?.isBot === true) return

  const userText = message.text?.trim()
  if (!userText) return

  try {
    await thread.startTyping().catch(() => {
      /* typing is best-effort */
    })

    const reply = await generateWechatAgentReply({ agentId, userId, userText })
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
