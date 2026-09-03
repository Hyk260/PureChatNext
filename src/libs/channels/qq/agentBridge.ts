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
import { formatQQAttachmentContext, formatQQInboundLog, resolveQQInboundKind } from './inboundLog'

const log = debug('channel:qq:bridge')
const inboundLog = debug('channel:qq:webhook')
export const QQ_UNSUPPORTED_MESSAGE = '当前版本暂不支持语音或视频消息，请发送文本、图片或文件。'
const QQ_FAILURE_MESSAGE = '消息处理失败，请稍后重试。'

function buildQQUserText(message: Message, text?: string): string | undefined {
  const attachmentText = formatQQAttachmentContext(message.attachments)

  const userText = [text, attachmentText].filter(Boolean).join('\n')
  return userText || undefined
}

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

  const userText = buildQQUserText(message, message.text?.trim())
  const externalUserId = message.author?.userId || 'unknown'
  const messageKind = resolveQQInboundKind({ attachments: message.attachments, text: userText })
  inboundLog(
    formatQQInboundLog({
      applicationId,
      content: userText || '',
      externalUserId,
      messageKind,
    })
  )
  if (messageKind === 'audio' || messageKind === 'video') {
    await thread.post({ markdown: QQ_UNSUPPORTED_MESSAGE }).catch((error) => {
      log('unsupported message reply failed app=%s: %O', applicationId, error)
    })
    return
  }
  if (!userText) return
  if (message.attachments?.length) {
    log('processing attachments agent=%s count=%d', agentId, message.attachments.length)
  }

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
    try {
      await thread.post({ markdown: QQ_FAILURE_MESSAGE })
    } catch (sendError) {
      log('failure reply failed app=%s: %O', applicationId, sendError)
    }
  }
}
