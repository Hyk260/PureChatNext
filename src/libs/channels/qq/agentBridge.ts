import type { Message, Thread } from 'chat'
import debug from 'debug'

import { generateChannelAgentReply } from '../core/agentRuntime'
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
  const result = await generateChannelAgentReply({
    agentId: params.agentId,
    model: params.model,
    platform: 'qq',
    provider: params.provider,
    text: params.userText,
    userId: params.userId,
  })
  return result.text
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
