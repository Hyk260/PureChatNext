import { buildConversationFileContext } from '../core/files'
import { getErrorMessage } from '@pure/utils/error'
import { createHash } from 'node:crypto'
import { QQAdapter } from '@pure/chat-adapter/qq'
import { QQSpeechModel } from '@pure/database/models/qqSpeech'
import { QQ_SPEECH_LIMITS, stripQwenTtsTags } from '@pure/const'

import type { ModelMessage } from 'ai'
import type { Message, Thread } from 'chat'
import debug from 'debug'

import { AgentService } from '@/server/agents/service'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { chunkQQTextLimited } from '@pure/utils/qqText'
import { resolveChatToolInstructions, resolveChatTools } from '@/server/chat/toolRegistry'
import type { ChannelToolArtifact, ChannelToolContext } from '@/server/chat/toolRegistry'
import { channelErrorCode, recordChannelGatewayLog } from '@/server/channel-gateway/diagnostics'

import { applyChannelFirstBindWelcome } from '../core/commands'
import { createChannelGenerationControls, generateChannelAgentReply } from '../core/agentRuntime'
import { buildChannelContextMessages } from '../core/context'
import { getChannelHistoryTokenBudget, trimChannelHistory } from '../core/history'
import { resolveChannelModelConfig } from '../core/modelResolver'
import type { ChannelAgentResponse } from '../core/types'
import { listWechatConversationFiles, persistWechatFile, readWechatFile } from '../wechat/fileArtifacts'
import { prepareQQFileForAgent } from './inboundMedia'
import type { PreparedQQFile } from './inboundMedia'
import {
  beginQQGeneration,
  canUseQQTTSCommand,
  endQQGeneration,
  flushQQChatInvalidation,
  parseQQTTSCommand,
  tryHandleQQCommand,
} from './commands'
import {
  formatQQAttachmentContext,
  formatQQUnsupportedMessage,
  logQQInbound,
  recordQQAgentReplyDiagnostic,
  recordQQInboundDiagnostic,
  resolveQQInboundKind,
} from './inboundLog'
import {
  evaluateQQInboundAccess,
  normalizeQQChannelSettings,
  QQ_MIN_CHAR_LIMIT,
  QQ_PLATFORM_MAX_TEXT_LENGTH,
} from './advancedSettings'
import { QQ_MAX_PASSIVE_REPLIES } from './passiveReply'
import { buildQQPlatformPayload, resolveQQAuthorLabel, resolveQQSessionLabel, resolveQQThreadType } from './thread'
import { isQQSpeechCandidate, tryQQSpeech } from './speech'
import type { QQReplySender } from './speech'

const log = debug('channel:qq:bridge')
export const QQ_UNSUPPORTED_MESSAGE = formatQQUnsupportedMessage
const QQ_FAILURE_MESSAGE = '消息处理失败，请稍后重试。'

/**
 * 按 `charLimit` 分片后多次 `thread.post`（对齐微信多条发送）。
 * 被动回复窗口最多 {@link QQ_MAX_PASSIVE_REPLIES} 条，超出部分截断并加省略号。
 * 中途配额耗尽时保留已发出的分片（不抛错），避免网页侧整单标失败、也不再补空消息。
 */
async function postQQMarkdown(
  thread: Thread,
  text: string,
  charLimit: number,
  diagnosticOwner: { bindingId: string; userId: string },
  sender?: QQReplySender,
): Promise<{ sentCount: number; text: string }> {
  const limit = Math.min(QQ_PLATFORM_MAX_TEXT_LENGTH, Math.max(QQ_MIN_CHAR_LIMIT, Math.round(charLimit)))
  const chunks = chunkQQTextLimited(text, limit, QQ_MAX_PASSIVE_REPLIES)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
  if (chunks.length === 0) return { sentCount: 0, text }

  const sentParts: string[] = []
  for (const chunk of chunks) {
    try {
      if (sender) await sender.sendText(chunk)
      else await thread.post(chunk)
      sentParts.push(chunk)
    } catch (error) {
      await recordChannelGatewayLog({ ...diagnosticOwner, platform: 'qq', event: 'send_failed', code: channelErrorCode(error) })
      if (sentParts.length > 0) {
        log('postQQMarkdown stopped after %d/%d chunks: %O', sentParts.length, chunks.length, error)
        return { sentCount: sentParts.length, text: sentParts.join('') }
      }
      throw error
    }
  }
  return { sentCount: sentParts.length, text: sentParts.join('') }
}

async function handleQQTTSCommand(params: {
  agentId: string
  applicationId: string
  authorId: string
  bindingId: string
  command: NonNullable<ReturnType<typeof parseQQTTSCommand>>
  event: { id: string }
  eventModel: ChannelEventModel
  message: Message
  model?: string | null
  provider?: string | null
  settings: ReturnType<typeof normalizeQQChannelSettings>
  thread: Thread
  threadType: ReturnType<typeof resolveQQThreadType>
  userId: string
}): Promise<void> {
  const {
    agentId,
    applicationId,
    authorId,
    bindingId,
    command,
    event,
    eventModel,
    message,
    model,
    provider,
    settings,
    thread,
    threadType,
    userId,
  } = params
  const abortController = beginQQGeneration(applicationId, thread.id)
  const sender = (threadType === 'c2c' || threadType === 'group') && thread.adapter instanceof QQAdapter
    ? thread.adapter.createReplySender(thread.id, message.id, {
        createdAt: message.metadata.dateSent,
        signal: abortController.signal,
        onConsume: (_seq, fallbackSlots) => new QQSpeechModel().reserveReply(event.id, 1, fallbackSlots),
      })
    : undefined
  const reply = async (text: string) => {
    const outbound = await postQQMarkdown(thread, text, settings.charLimit, { userId, bindingId }, sender)
    await eventModel.saveQQResponse(event.id, { sentChunkCount: outbound.sentCount, text: outbound.text })
  }

  try {
    if ('error' in command) {
      await reply('用法：/tts text=\'[excited]今天的天气真不错！[laughing]我们一起出去玩吧！\'')
      return
    }

    const text = command.text.trim()
    if (!text) {
      await reply('text 参数不能为空。用法：/tts text=\'[excited]今天的天气真不错！[laughing]我们一起出去玩吧！\'')
      return
    }
    if (Array.from(text).length > QQ_SPEECH_LIMITS.characters) {
      await reply(`text 参数过长，请控制在 ${QQ_SPEECH_LIMITS.characters} 个字符以内。`)
      return
    }
    if (!sender) {
      await reply('该语音指令需要在 QQ 私聊或群聊中使用。')
      return
    }

    const delivery = await tryQQSpeech({
      agentId,
      bindingId,
      eventId: event.id,
      userId,
      senderId: authorId,
      threadType,
      input: message.text ?? '',
      reply: text,
      model: model ?? '',
      provider: provider ?? '',
      signal: abortController.signal,
      sender,
      force: true,
    })
    if (delivery === 'sent') {
      await eventModel.saveQQResponse(event.id, { sentChunkCount: 1, text })
      return
    }
    if (delivery === 'stopped') {
      await eventModel.saveQQResponse(event.id, {
        errorCode: 'QQ_REPLY_STOPPED',
        status: 'failed',
        text,
        sentChunkCount: 0,
      })
      return
    }

    const textFallback = stripQwenTtsTags(text)
    await reply(`语音合成未能发送，以下为纯文本：\n${textFallback}`)
  } finally {
    endQQGeneration(applicationId, thread.id, abortController)
  }
}

function buildQQUserText(message: Message, text?: string): string | undefined {
  const attachmentText = formatQQAttachmentContext(message.attachments)

  const userText = [text, attachmentText].filter(Boolean).join('\n')
  return userText || undefined
}

async function finalizeQQOutbound(params: { agentId: string; reply: string; userId: string }): Promise<string> {
  const bindingModel = new ChannelBindingModel()
  const binding = await bindingModel.findByUserAndPlatform(params.userId, QQ_PLATFORM)
  if (!binding) return params.reply
  const agent = await new AgentService(params.userId).findVisibleById(params.agentId)
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
}): Promise<ChannelAgentResponse> {
  const channelContext = params.toolContext
  const tools = resolveChatTools({ channel: 'qq', channelContext, searchMode: 'auto' })
  const instructions = [
    '调用工具后必须用中文直接回答用户，不要只回复“正在查询”，不要输出工具调用、XML 或 DSML 标记。',
    'QQ 平台会按配置处理语音合成。用户要求语音时仍生成直接回答的文字，不要声称无法发语音，也不要承诺语音已经发送。',
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
      ...createChannelGenerationControls('qq'),
      tools,
    },
    history: params.history,
    model: params.model,
    platform: 'qq',
    provider: params.provider,
    trigger: 'qq',
    text: params.userText,
    userId: params.userId,
  })
  return result
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

  const settings = normalizeQQChannelSettings(
    (await new ChannelBindingModel().findById(bindingId))?.settings
  )
  const userText = buildQQUserText(message, message.text?.trim())
  const externalUserId = thread.id
  const messageKind = resolveQQInboundKind({ attachments: message.attachments, text: userText })
  const threadType = resolveQQThreadType(thread.id)
  const authorId = message.author?.userId || 'unknown'
  logQQInbound({
    applicationId,
    content: userText || '',
    externalUserId: message.author?.userId || 'unknown',
    messageKind,
  })
  const recordInboundDiagnostic = () =>
    recordQQInboundDiagnostic({
      applicationId,
      bindingId,
      content: userText || '',
      externalUserId: message.author?.userId || 'unknown',
      identityType: threadType === 'group' ? 'member_openid' : 'user_openid',
      messageKind,
      openid: authorId,
      username: resolveQQAuthorLabel(message),
      userId,
    })

  const eventModel = new ChannelEventModel()
  const platformPayload = buildQQPlatformPayload({
    attachments: message.attachments,
    authorId,
    authorName: resolveQQAuthorLabel(message),
    threadId: thread.id,
    threadType,
  })

  const access = evaluateQQInboundAccess({
    authorId,
    settings,
    threadType,
  })
  if (!access.ok) {
    const { event, inserted } = await eventModel.ingestQQInbound({
      bindingId,
      content: userText || access.notice,
      externalUserId,
      externalUserName: resolveQQSessionLabel(thread, message),
      messageKind: messageKind === 'audio' || messageKind === 'video' ? messageKind : 'text',
      platformMessageId: message.id,
      platformPayload,
      threadType,
    })
    if (!inserted) return
    await recordInboundDiagnostic()
    const posted = await postQQMarkdown(thread, access.notice, settings.charLimit, { userId, bindingId }).catch((error) => {
      log('access rejection reply failed app=%s: %O', applicationId, error)
      return { sentCount: 0, text: access.notice }
    })
    await eventModel
      .saveQQResponse(event.id, { sentChunkCount: posted.sentCount, text: posted.text })
      .catch((saveError) => log('save access rejection failed app=%s: %O', applicationId, saveError))
    return
  }

  if (messageKind === 'audio' || messageKind === 'video') {
    const unsupportedMessage = QQ_UNSUPPORTED_MESSAGE(messageKind)
    const { event, inserted } = await eventModel.ingestQQInbound({
      bindingId,
      content: userText || unsupportedMessage,
      externalUserId,
      externalUserName: resolveQQSessionLabel(thread, message),
      messageKind,
      platformMessageId: message.id,
      platformPayload,
      threadType,
    })
    if (!inserted) return
    await recordInboundDiagnostic()
    const posted = await postQQMarkdown(thread, unsupportedMessage, settings.charLimit, { userId, bindingId }).catch((error) => {
      log('unsupported message reply failed app=%s: %O', applicationId, error)
      return { sentCount: 0, text: unsupportedMessage }
    })
    await eventModel
      .saveQQResponse(event.id, { sentChunkCount: posted.sentCount, text: posted.text })
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
  await recordInboundDiagnostic()

  if (message.attachments?.length) {
    log('processing attachments agent=%s count=%d', agentId, message.attachments.length)
  }

  let diagnosticStage: 'processing_failed' | 'send_failed' = 'processing_failed'
  try {
    await thread.startTyping().catch(() => {
      /* typing is best-effort / unsupported on QQ */
    })

    const speechCommand = parseQQTTSCommand(userText)
    if (speechCommand && await canUseQQTTSCommand(userId)) {
      await handleQQTTSCommand({
        agentId,
        applicationId,
        authorId,
        bindingId,
        command: speechCommand,
        event,
        eventModel,
        message,
        model,
        provider,
        settings,
        thread,
        threadType,
        userId,
      })
      return
    }

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
      diagnosticStage = 'send_failed'
      const outbound = await postQQMarkdown(thread, reply, settings.charLimit, { userId, bindingId })
      await eventModel
        .saveQQResponse(event.id, { sentChunkCount: outbound.sentCount, text: outbound.text })
        .catch((saveError) => log('save command event failed app=%s: %O', applicationId, saveError))
      flushQQChatInvalidation(applicationId).catch((error) => {
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
      const replyResult = await generateQQAgentReply({
        abortSignal: abortController.signal,
        agentId,
        attachmentContext: buildConversationFileContext(conversationFiles, 'qq'),
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
      await recordQQAgentReplyDiagnostic({
        agentId: replyResult.diagnostics.agentId,
        aiOutput: replyResult.text,
        bindingId,
        contextMessageCount: replyResult.diagnostics.contextMessageCount,
        durationMs: replyResult.durationMs,
        finish: replyResult.diagnostics.finish,
        model: replyResult.model,
        platform: 'qq',
        provider: replyResult.provider,
        steps: replyResult.diagnostics.steps,
        toolsAvailable: replyResult.diagnostics.toolsAvailable,
        toolsCalled: replyResult.diagnostics.toolsCalled,
        userId,
      })
      const reply = replyResult.text
      const finalReply = await finalizeQQOutbound({ agentId, reply, userId })
      const textReply = stripQwenTtsTags(finalReply)
      diagnosticStage = 'send_failed'
      abortController.signal.throwIfAborted()
      const speechEligible =
        isQQSpeechCandidate(message.text ?? '', finalReply, settings.speechModel?.replyMode) &&
        (threadType === 'c2c' || threadType === 'group')
      const sender = (threadType === 'c2c' || threadType === 'group') && thread.adapter instanceof QQAdapter
        ? thread.adapter.createReplySender(thread.id, message.id, {
            createdAt: message.metadata.dateSent,
            signal: abortController.signal,
            onConsume: (_seq, fallbackSlots) => new QQSpeechModel().reserveReply(event.id, 1, fallbackSlots),
          })
        : undefined
      let outbound: { sentCount: number; text: string }
      let speechSent = false
      try {
        const delivery = speechEligible && sender ? await tryQQSpeech({
          agentId, bindingId, eventId: event.id, userId, senderId: authorId, threadType,
          input: message.text ?? '', reply: finalReply, model: resolvedModel, provider: resolvedProvider,
          signal: abortController.signal, sender,
        }) : 'text'
        abortController.signal.throwIfAborted()
        if (delivery === 'stopped') {
          await eventModel.saveQQResponse(event.id, { status: 'failed', errorCode: 'QQ_REPLY_STOPPED', text: finalReply, sentChunkCount: 0 })
          return
        }
        speechSent = delivery === 'sent'
        outbound = delivery === 'sent'
          ? { sentCount: 1, text: finalReply }
          : await postQQMarkdown(thread, textReply, settings.charLimit, { userId, bindingId }, sender)
      } catch {
        // The generated answer is the fallback. Never replace it with a second generic failure reply.
        await eventModel.saveQQResponse(event.id, {
          status: 'failed', errorCode: abortController.signal.aborted ? 'ABORTED' : 'QQ_REPLY_FAILED',
          text: finalReply, sentChunkCount: 0,
        }).catch(() => {})
        await recordChannelGatewayLog({ userId, bindingId, platform: 'qq', event: 'send_failed', code: abortController.signal.aborted ? 'ABORTED' : 'QQ_REPLY_FAILED' })
        return
      }
      const senderReply = speechSent ? finalReply : textReply
      await eventModel
        .saveQQResponse(event.id, {
          ...(model ? { model } : {}),
          ...(provider ? { provider } : {}),
          sentChunkCount: outbound.sentCount,
          text: sender ? senderReply : outbound.text,
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
    await recordChannelGatewayLog({ userId, platform: 'qq', bindingId, event: diagnosticStage, code: channelErrorCode(error) })
    log('handleMention failed agent=%s: %O', agentId, error)
    const errorMessage = getErrorMessage(error, 'QQ message processing failed')
    // 配额耗尽时再发失败提示只会继续 40034128，且把已成功的分片在网页标成失败。
    if (/passive reply budget exhausted|40034128/.test(errorMessage)) {
      await eventModel
        .saveQQResponse(event.id, {
          errorCode: 'PASSIVE_REPLY_BUDGET',
          errorMessage,
          status: 'failed',
          text: '',
        })
        .catch((saveError) => log('save budget-exhausted event failed app=%s: %O', applicationId, saveError))
      return
    }
    try {
      const outbound = await postQQMarkdown(thread, QQ_FAILURE_MESSAGE, settings.charLimit, { userId, bindingId })
      await eventModel.saveQQResponse(event.id, {
        errorCode: 'PROCESSING_ERROR',
        errorMessage,
        sentChunkCount: outbound.sentCount,
        status: 'failed',
        text: outbound.text,
      })
    } catch (sendError) {
      await recordChannelGatewayLog({ userId, platform: 'qq', bindingId, event: 'send_failed', code: channelErrorCode(sendError) })
      log('failure reply failed app=%s: %O', applicationId, sendError)
      await eventModel
        .saveQQResponse(event.id, {
          errorCode: 'PROCESSING_ERROR',
          errorMessage: getErrorMessage(sendError, 'QQ failure reply failed'),
          status: 'failed',
          text: '',
        })
        .catch((saveError) => log('save failed event failed app=%s: %O', applicationId, saveError))
    }
  }
}
