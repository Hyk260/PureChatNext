import type { ModelMessage } from 'ai'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'

import { applyChannelFirstBindWelcome } from '../core/commands'
import { generateChannelAgentReply } from '../core/agentRuntime'
import { buildChannelContextMessages } from '../core/context'
import { getChannelHistoryTokenBudget, trimChannelHistory } from '../core/history'
import { resolveChannelModelConfig } from '../core/modelResolver'
import {
  beginQQGeneration,
  endQQGeneration,
  flushQQChatInvalidation,
  tryHandleQQCommand,
} from './commands'
import { formatQQAttachmentContext, formatQQInboundLog, resolveQQInboundKind } from './inboundLog'
import { buildQQPlatformPayload, resolveQQSessionLabel, resolveQQThreadType } from './thread'

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
  history?: ModelMessage[]
  model?: string | null
  provider?: string | null
  userId: string
  userText: string
}): Promise<string> {
  const result = await generateChannelAgentReply({
    abortSignal: params.abortSignal,
    agentId: params.agentId,
    history: params.history,
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
  bindingId: string
  message: Message
  model?: string | null
  provider?: string | null
  thread: Thread
  userId: string
}): Promise<void> {
  const { agentId, applicationId, bindingId, message, model, provider, thread, userId } = params

  if (message.author?.isBot === true) return

  const userText = buildQQUserText(message, message.text?.trim())
  const externalUserId = thread.id
  const messageKind = resolveQQInboundKind({ attachments: message.attachments, text: userText })
  inboundLog(
    formatQQInboundLog({
      applicationId,
      content: userText || '',
      externalUserId: message.author?.userId || 'unknown',
      messageKind,
    })
  )

  const eventModel = new ChannelEventModel()
  const threadType = resolveQQThreadType(thread.id)
  const platformPayload = buildQQPlatformPayload({
    attachments: message.attachments,
    authorId: message.author?.userId || 'unknown',
    threadId: thread.id,
    threadType,
  })

  if (messageKind === 'audio' || messageKind === 'video') {
    const { event, inserted } = await eventModel.ingestQQInbound({
      bindingId,
      content: userText || QQ_UNSUPPORTED_MESSAGE,
      externalUserId,
      externalUserName: resolveQQSessionLabel(thread, message),
      messageKind,
      platformMessageId: message.id,
      platformPayload,
      threadType,
    })
    if (!inserted) return
    await thread.post({ markdown: QQ_UNSUPPORTED_MESSAGE }).catch((error) => {
      log('unsupported message reply failed app=%s: %O', applicationId, error)
    })
    await eventModel
      .saveQQResponse(event.id, { text: QQ_UNSUPPORTED_MESSAGE })
      .catch((saveError) => log('save unsupported event failed app=%s: %O', applicationId, saveError))
    return
  }

  if (!userText) return

  const { event, inserted } = await eventModel.ingestQQInbound({
    bindingId,
    content: userText,
    externalUserId,
    externalUserName: resolveQQSessionLabel(thread, message),
    messageKind,
    platformMessageId: message.id,
    platformPayload,
    threadType,
  })
  if (!inserted) return

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
      const reply = await finalizeQQOutbound({ agentId, reply: commandReply, userId })
      await thread.post({ markdown: reply })
      await eventModel
        .saveQQResponse(event.id, { text: reply })
        .catch((saveError) => log('save command event failed app=%s: %O', applicationId, saveError))
      await flushQQChatInvalidation(applicationId).catch((error) => {
        log('invalidate after command failed app=%s: %O', applicationId, error)
      })
      return
    }

    const abortController = beginQQGeneration(applicationId, externalUserId)
    try {
      const { model: resolvedModel, provider: resolvedProvider } = resolveChannelModelConfig({
        channelName: 'QQ',
        fallbackProvider: 'deepseek',
        model,
        provider,
      })
      const historyRows = await eventModel.findContext(event.sessionId, event.conversationVersion)
      const history = buildChannelContextMessages(
        trimChannelHistory(
          historyRows,
          getChannelHistoryTokenBudget(resolvedProvider, resolvedModel, userText)
        )
      )
      const reply = await generateQQAgentReply({
        abortSignal: abortController.signal,
        agentId,
        history,
        model: resolvedModel,
        provider: resolvedProvider,
        userId,
        userText,
      })
      const finalReply = await finalizeQQOutbound({ agentId, reply, userId })
      await thread.post({ markdown: finalReply })
      await eventModel
        .saveQQResponse(event.id, {
          ...(model ? { model } : {}),
          ...(provider ? { provider } : {}),
          text: finalReply,
        })
        .catch((saveError) => log('save reply event failed app=%s: %O', applicationId, saveError))
    } finally {
      endQQGeneration(applicationId, externalUserId, abortController)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log('generation aborted agent=%s', agentId)
      await eventModel
        .saveQQResponse(event.id, {
          errorCode: 'ABORTED',
          errorMessage: 'generation aborted',
          status: 'failed',
          text: '',
        })
        .catch((saveError) => log('save aborted event failed app=%s: %O', applicationId, saveError))
      return
    }
    log('handleMention failed agent=%s: %O', agentId, error)
    try {
      await thread.post({ markdown: QQ_FAILURE_MESSAGE })
      await eventModel.saveQQResponse(event.id, {
        errorCode: 'PROCESSING_ERROR',
        errorMessage: error instanceof Error ? error.message : 'QQ message processing failed',
        status: 'failed',
        text: QQ_FAILURE_MESSAGE,
      })
    } catch (sendError) {
      log('failure reply failed app=%s: %O', applicationId, sendError)
      await eventModel
        .saveQQResponse(event.id, {
          errorCode: 'PROCESSING_ERROR',
          errorMessage: sendError instanceof Error ? sendError.message : 'QQ failure reply failed',
          status: 'failed',
          text: '',
        })
        .catch((saveError) => log('save failed event failed app=%s: %O', applicationId, saveError))
    }
  }
}
