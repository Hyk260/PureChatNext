import { createHash } from 'node:crypto'

import { isStepCount } from 'ai'
import type { ModelMessage } from 'ai'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { resolveChatToolInstructions, resolveChatTools } from '@/server/chat/toolRegistry'
import type { ChannelToolArtifact, ChannelToolContext } from '@/server/chat/toolRegistry'

import { applyChannelFirstBindWelcome } from '../core/commands'
import { generateChannelAgentReply } from '../core/agentRuntime'
import { buildChannelContextMessages } from '../core/context'
import { getChannelHistoryTokenBudget, trimChannelHistory } from '../core/history'
import { resolveChannelModelConfig } from '../core/modelResolver'
import { listWechatConversationFiles, persistWechatFile, readWechatFile } from '../wechat/fileArtifacts'
import { prepareQQFileForAgent } from './inboundMedia'
import type { PreparedQQFile } from './inboundMedia'
import { beginQQGeneration, endQQGeneration, flushQQChatInvalidation, tryHandleQQCommand } from './commands'
import { formatQQAttachmentContext, formatQQInboundLog, resolveQQInboundKind } from './inboundLog'
import { buildQQPlatformPayload, resolveQQSessionLabel, resolveQQThreadType } from './thread'

const log = debug('channel:qq:bridge')
const inboundLog = debug('channel:qq:webhook')
const MAX_GENERATION_STEPS = 5
const FINAL_ANSWER_STEP = 3
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
  attachmentContext?: string
  history?: ModelMessage[]
  model?: string | null
  provider?: string | null
  userId: string
  userContent?: string
  userText: string
  toolContext?: ChannelToolContext
}): Promise<string> {
  const channelContext = params.toolContext
  const tools = resolveChatTools({ channel: 'qq', channelContext, searchMode: 'auto' })
  const instructions = [
    resolveChatToolInstructions({ channel: 'qq', channelContext, searchMode: 'auto' }).join('\n\n'),
    params.attachmentContext,
  ]
    .filter(Boolean)
    .join('\n\n')
  const result = await generateChannelAgentReply({
    abortSignal: params.abortSignal,
    agentId: params.agentId,
    generation: {
      instructions,
      messages: [...(params.history ?? []), { content: params.userContent ?? params.userText, role: 'user' }],
      onStepEnd: (event) => {
        const step = event as {
          finishReason?: string
          stepNumber?: number
          toolCalls?: Array<{ toolName: string }>
          toolResults?: unknown[]
        }
        log(
          'step platform=qq step=%d finish=%s tools=%s results=%d',
          step.stepNumber ?? 0,
          step.finishReason ?? '-',
          step.toolCalls?.map((call) => call.toolName).join(',') || '-',
          step.toolResults?.length ?? 0
        )
      },
      prepareStep: (event) => {
        const stepNumber = (event as { stepNumber?: number }).stepNumber ?? 0
        return stepNumber >= FINAL_ANSWER_STEP ? { activeTools: [], toolChoice: 'none' as const } : undefined
      },
      stopWhen: isStepCount(MAX_GENERATION_STEPS),
      tools,
    },
    history: params.history,
    model: params.model,
    platform: 'qq',
    provider: params.provider,
    text: params.userText,
    userId: params.userId,
  })
  return result.text
}

type QQPreparedAttachment = {
  artifact: Awaited<ReturnType<typeof persistWechatFile>>
  prepared: PreparedQQFile
}

async function prepareAndPersistQQAttachments(params: {
  attachments?: Array<{
    fetchData?: () => Promise<Buffer>
    mimeType?: string
    name?: string
    size?: number
    type?: string
    url?: string
  }>
  event: { conversationVersion: number; id: string; sessionId: string }
  userId: string
}): Promise<{ failures: string[]; files: QQPreparedAttachment[] }> {
  const failures: string[] = []
  const files: QQPreparedAttachment[] = []
  for (const attachment of params.attachments ?? []) {
    if (attachment.type && attachment.type !== 'file') continue
    if (!attachment.fetchData) {
      failures.push(attachment.name || 'qq-file')
      log('QQ attachment has no fetchData handler name=%s', attachment.name || 'qq-file')
      continue
    }
    try {
      const buffer = await attachment.fetchData()
      const prepared = await prepareQQFileForAgent({
        buffer,
        fileName: attachment.name,
        mimeType: attachment.mimeType,
      })
      const artifact = await persistWechatFile({
        buffer: prepared.buffer,
        contentType: prepared.mimeType,
        direction: 'input',
        event: params.event,
        filename: prepared.fileName,
        operationHash: createHash('sha256')
          .update(`${prepared.fileName}:${buffer.length}:${buffer.subarray(0, 1024).toString('base64')}`)
          .digest('hex'),
        summary: 'QQ 用户上传的文件',
        userId: params.userId,
      })
      files.push({ artifact, prepared })
      log(
        'persisted QQ attachment name=%s bytes=%d artifact=%s',
        attachment.name || 'qq-file',
        buffer.length,
        artifact.artifactId
      )
    } catch (error) {
      const name = attachment.name || 'qq-file'
      failures.push(name)
      log('persist QQ attachment failed name=%s url=%s: %O', name, attachment.url, error)
    }
  }
  return { failures, files }
}

function buildQQConversationFileContext(
  conversationFiles: Awaited<ReturnType<typeof listWechatConversationFiles>>
): string | undefined {
  if (!conversationFiles.length) return undefined

  return [
    '<qq_conversation_files>',
    ...conversationFiles.map(({ artifact, file }) =>
      JSON.stringify({
        direction: artifact.direction,
        fileId: file.id,
        filename: file.name,
        summary: artifact.summary,
        version: artifact.version,
      })
    ),
    '</qq_conversation_files>',
    '用户说“这个文件/上面的文件”时，默认使用列表中最新的 output，否则使用最新 input。多个同等候选时先询问。',
  ].join('\n')
}

function buildQQFileAgentContent(files: QQPreparedAttachment[], caption?: string | null) {
  if (!files.length) return { userContent: undefined, userText: caption || undefined }

  const names = files.map(({ prepared }) => prepared.fileName).join('、')
  const filePrompt =
    files.length === 1
      ? `用户发送了文件：${names}。请结合附件内容回答用户问题。`
      : `用户发送了 ${files.length} 个文件：${names}。请结合附件内容回答用户问题。`
  const userText = caption && caption !== '[文件]' ? `${caption}\n${filePrompt}` : filePrompt
  const sections = files
    .map(({ artifact, prepared }) =>
      [
        `文件 ID：${artifact.file.id}`,
        `<附件内容>${prepared.truncated ? '\n（内容已截断）' : ''}`,
        prepared.content,
        '</附件内容>',
      ].join('\n')
    )
    .join('\n\n')

  return { userContent: `${userText}\n\n${sections}`, userText }
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
      eventId: event.id,
      eventModel,
      externalUserId,
      sessionId: event.sessionId,
      text: userText,
      userId,
    })
    if (commandReply) {
      const reply = await finalizeQQOutbound({ agentId, reply: commandReply, userId })
      await thread.post({ markdown: reply })
      await eventModel
        .saveQQResponse(event.id, { text: reply })
        .catch((saveError) => log('save command event failed app=%s: %O', applicationId, saveError))
      void flushQQChatInvalidation(applicationId).catch((error) => {
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
        trimChannelHistory(historyRows, getChannelHistoryTokenBudget(resolvedProvider, resolvedModel, userText))
      )
      const fileAttachments =
        messageKind === 'file'
          ? (message.attachments ?? [])
          : (message.attachments?.filter((attachment) => attachment.type === 'file') ?? [])
      const attachmentResult = await prepareAndPersistQQAttachments({
        attachments: fileAttachments,
        event: { conversationVersion: event.conversationVersion, id: event.id, sessionId: event.sessionId },
        userId,
      })
      if (attachmentResult.failures.length) {
        throw new Error(`文件保存失败：${attachmentResult.failures.join('、')}`)
      }
      if (messageKind === 'file' && attachmentResult.files.length === 0) {
        throw new Error('文件保存失败：未找到可处理的文件附件。')
      }
      const agentContent =
        messageKind === 'file'
          ? buildQQFileAgentContent(attachmentResult.files, message.text?.trim())
          : { userContent: undefined, userText }
      const conversationFiles = await listWechatConversationFiles(event.sessionId, event.conversationVersion)
      const producedArtifacts: ChannelToolArtifact[] = []
      const reply = await generateQQAgentReply({
        abortSignal: abortController.signal,
        agentId,
        attachmentContext: buildQQConversationFileContext(conversationFiles),
        history,
        model: resolvedModel,
        provider: resolvedProvider,
        userId,
        userContent: agentContent.userContent,
        userText: agentContent.userText ?? userText,
        toolContext: {
          conversationVersion: event.conversationVersion,
          event: { conversationVersion: event.conversationVersion, id: event.id, sessionId: event.sessionId },
          files: { list: listWechatConversationFiles, persist: persistWechatFile, read: readWechatFile },
          producedArtifacts,
          sessionId: event.sessionId,
          userId,
        },
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
