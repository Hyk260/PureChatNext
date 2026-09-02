import type { Message, Thread } from 'chat'
import debug from 'debug'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'

import { applyChannelFirstBindWelcome } from '../core/commands'
import { generateChannelAgentReply } from '../core/agentRuntime'
import {
  beginQQGeneration,
  endQQGeneration,
  flushQQChatInvalidation,
  tryHandleQQCommand,
} from './commands'
import { formatQQInboundLog, resolveQQInboundKind } from './inboundLog'

const log = debug('channel:qq:bridge')
const inboundLog = debug('channel:qq:webhook')

async function finalizeQQOutbound(params: { agentId: string; reply: string; userId: string }): Promise<string> {
  const bindingModel = new ChannelBindingModel()
  const binding = await bindingModel.findByUserAndPlatform(params.userId, QQ_PLATFORM)
  if (!binding) return params.reply
  const agent = await new AgentModel(params.userId).findVisibleById(params.agentId)
  return applyChannelFirstBindWelcome({
    agentTitle: agent?.title ?? '助手',
    bindingId: binding.id,
    clearPendingWelcome: (id) => bindingModel.clearPendingWelcome(id),
    pendingWelcome: binding.pendingWelcome,
    reply: params.reply,
  })
}

/**
 * Generate a text reply using the bound agent (env-level provider keys or PureChat).
 */
export async function generateQQAgentReply(params: {
  abortSignal?: AbortSignal
  agentId: string
  model?: string | null
  provider?: string | null
  userId: string
  userText: string
}): Promise<string> {
  const result = await generateChannelAgentReply({
    abortSignal: params.abortSignal,
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
 * Chat SDK handler: inbound message → command or Agent → thread.post.
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
  const externalUserId = message.author?.userId || 'unknown'
  inboundLog(
    formatQQInboundLog({
      applicationId,
      content: userText || '',
      externalUserId,
      messageKind: resolveQQInboundKind({ attachments: message.attachments, text: userText }),
    })
  )
  if (!userText) return

  try {
    await thread.startTyping().catch(() => {
      /* typing is best-effort / unsupported on QQ */
    })

    const commandReply = await tryHandleQQCommand({
      applicationId,
      externalUserId,
      text: userText,
      userId,
    })
    if (commandReply) {
      await thread.post({ markdown: await finalizeQQOutbound({ agentId, reply: commandReply, userId }) })
      await flushQQChatInvalidation(applicationId).catch((error) => {
        log('invalidate after command failed app=%s: %O', applicationId, error)
      })
      return
    }

    const abortController = beginQQGeneration(applicationId, externalUserId)
    try {
      const reply = await generateQQAgentReply({
        abortSignal: abortController.signal,
        agentId,
        model,
        provider,
        userId,
        userText,
      })
      await thread.post({ markdown: await finalizeQQOutbound({ agentId, reply, userId }) })
    } finally {
      endQQGeneration(applicationId, externalUserId, abortController)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log('generation aborted agent=%s', agentId)
      return
    }
    log('handleMention failed agent=%s: %O', agentId, error)
    const errMsg = error instanceof Error ? error.message : '处理失败'
    try {
      await thread.post({ markdown: `⚠️ ${errMsg}` })
    } catch {
      /* ignore send failure */
    }
  }
}
