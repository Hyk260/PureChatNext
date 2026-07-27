import { generateText } from 'ai'
import { type Message, type Thread } from 'chat'
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
  agentId: string
  userId: string
  userText: string
}): Promise<string> {
  const agentModel = new AgentModel(params.userId)
  const agent = await agentModel.findVisibleById(params.agentId)

  if (!agent) {
    throw new Error(`Agent not found: ${params.agentId}`)
  }

  const providerRaw = agent.provider ?? 'deepseek'
  const provider = isSupportedProviderId(providerRaw) ? providerRaw : 'deepseek'
  const modelId = agent.model ?? (provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-v4-flash')
  const apiKey = resolveProviderApiKey(provider, undefined, undefined)

  if (!apiKey) {
    throw new Error(`No API key for provider "${provider}". Set OPENAI_API_KEY or DEEPSEEK_API_KEY for WeChat replies.`)
  }

  const languageModel = createProviderLanguageModel(provider, modelId, apiKey, undefined)

  log('reply agent=%s provider=%s model=%s', agent.id, provider, modelId)

  const result = await generateText({
    messages: [{ content: params.userText, role: 'user' }],
    model: languageModel,
    system: agent.systemRole || undefined,
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
