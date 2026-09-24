import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, QQ_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { ChannelEventFileModel } from '@pure/database/models/channelEventFile'
import type { ChannelEventItem } from '@pure/database/schemas/channel'
import { jsonError, withAdmin } from '@/libs/auth/get-session-user'
import { persistWechatFile, WechatFileArtifactError } from '@/libs/channels/wechat/fileArtifacts'
import { canSendQQDevOutbound, sendQQDevOutbound, QQOutboundError } from '@/libs/channels/qq/outbound'
import type { QQOutboundMedia } from '@/libs/channels/qq/outbound'
import { QQ_MAX_OUTBOUND_FILE_BYTES, QQ_MAX_OUTBOUND_FILES, qqOutboundFileLimitLabel } from '@/libs/channels/qq/outboundLimits'
import { resolveQQPassiveReply } from '@/libs/channels/qq/passiveReply'
import { expandQQEventsToMessages } from '@/libs/channels/qq/timeline'
import { resolveQQThreadType } from '@/libs/channels/qq/thread'
import {
  advanceWechatTimelineCursor,
  encodeWechatTimelineCursor,
  parseWechatTimelineCursor,
} from '@/libs/channels/wechat/timelineCursor'

const MAX_OUTBOUND_TEXT_LENGTH = 2000

function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim() || 'file'
  return base.slice(0, 180) || 'file'
}

function readOutboundTextSent(payload: Record<string, unknown> | null | undefined) {
  return Boolean(payload && payload.textSent === true)
}

async function parseOutboundBody(request: Request): Promise<{ media: QQOutboundMedia[]; requestId: string; text: string }> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const textValue = form.get('text')
    const text = typeof textValue === 'string' ? textValue.trim() : ''
    const requestIdValue = form.get('requestId')
    const requestId = typeof requestIdValue === 'string' ? requestIdValue.trim() : ''
    const entries = form.getAll('files').filter((item): item is File => item instanceof File)
    if (entries.length > QQ_MAX_OUTBOUND_FILES) {
      throw new QQOutboundError(`一次最多发送 ${QQ_MAX_OUTBOUND_FILES} 个附件`)
    }
    const media: QQOutboundMedia[] = []
    for (const file of entries) {
      const buffer = Buffer.from(await file.arrayBuffer())
      if (buffer.byteLength <= 0) throw new QQOutboundError(`附件「${file.name}」为空`)
      if (buffer.byteLength > QQ_MAX_OUTBOUND_FILE_BYTES) {
        throw new QQOutboundError(`附件「${file.name}」超过 ${qqOutboundFileLimitLabel()} 限制`)
      }
      media.push({
        buffer,
        fileName: safeFileName(file.name || 'file'),
        mimeType: file.type || 'application/octet-stream',
      })
    }
    return { media, requestId, text }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    throw new QQOutboundError('Invalid JSON body')
  }
  const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : ''
  const requestId =
    typeof (body as { requestId?: unknown })?.requestId === 'string'
      ? (body as { requestId: string }).requestId.trim()
      : ''
  return { media: [], requestId, text }
}

function outboundAttachments(eventId: string) {
  return new ChannelEventFileModel()
    .listForEvent(eventId)
    .then((rows) =>
      rows
        .filter(({ artifact }) => artifact.direction === 'output')
        .map(({ artifact, file }) => ({
          deliveryError: artifact.deliveryError,
          deliveryStatus: artifact.deliveryStatus,
          direction: artifact.direction,
          fileId: file.id,
          fileName: file.name,
          fileSize: file.size,
          id: artifact.id,
          summary: artifact.summary,
          version: artifact.version,
        }))
    )
}

function outboundMessage(event: ChannelEventItem, attachments: Awaited<ReturnType<typeof outboundAttachments>>) {
  const [message] = expandQQEventsToMessages([
    {
      ...event,
      attachments,
      completedAt: new Date(),
      status: 'completed',
    },
  ])
  return message ?? null
}

/**
 * GET /api/admin/qq/sessions/[sessionId]/messages
 * 管理员：分页拉取 QQ 会话时间线消息
 */
export const GET = withAdmin<{ sessionId: string }>(async (request, { params, userId }) => {
  const { sessionId } = await params
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  const myBinding = await new ChannelBindingModel().findByUserAndPlatform(userId, QQ_PLATFORM)
  const limitParam = Number(request.nextUrl.searchParams.get('limit') ?? '50')
  const limit = Number.isFinite(limitParam) ? limitParam : 50
  const cursorParam = request.nextUrl.searchParams.get('cursor')
  const after = cursorParam ? parseWechatTimelineCursor(cursorParam) : null
  if (cursorParam && !after) return jsonError('Invalid cursor', 400)
  const conversationVersionParam = request.nextUrl.searchParams.get('conversationVersion')
  const conversationVersion = conversationVersionParam === null ? undefined : Number(conversationVersionParam)
  if (conversationVersion !== undefined && (!Number.isInteger(conversationVersion) || conversationVersion < 1)) {
    return jsonError('Invalid conversationVersion', 400)
  }
  const watchEventIds = request.nextUrl.searchParams
    .getAll('watchEventId')
    .filter((id) => id.length > 0 && id.length <= 128)
    .slice(0, 20)

  const result = await new ChannelEventModel().listTimelineBySession(sessionId, {
    ...(after ? { after } : {}),
    conversationVersion,
    limit,
    watchEventIds,
  })
  if (!result) return jsonError('Session not found', 404)

  const sessionBinding = await new ChannelBindingModel().findById(result.session.bindingId)
  if (!sessionBinding || sessionBinding.platform !== QQ_PLATFORM) {
    return jsonError('Session not found', 404)
  }

  const { events, session } = result
  const effectiveAgentId = session.activeAgentId || sessionBinding.agentId
  const agent = await new AgentModel(userId).findVisibleById(effectiveAgentId)
  const isOwnBinding = Boolean(myBinding && session.bindingId === myBinding.id)

  const responseCursor = encodeWechatTimelineCursor(
    advanceWechatTimelineCursor(
      after,
      events.map(({ createdAt, id }) => ({ createdAt, id }))
    ) ?? { createdAt: new Date(0), id: '' }
  )
  const expandedMessages = expandQQEventsToMessages(events, {
    sessionUserName: session.externalUserName,
  })

  return NextResponse.json({
    cursor: responseCursor,
    messages: cursorParam ? expandedMessages : expandedMessages.slice(-Math.min(Math.max(limit, 1), 200)),
    session: {
      activeAgentId: session.activeAgentId,
      agentId: effectiveAgentId,
      agentTitle: agent?.title ?? null,
      applicationId: sessionBinding.applicationId,
      bindingId: session.bindingId,
      canSend: isOwnBinding && Boolean(myBinding?.enabled && !myBinding.needsRebind),
      conversationVersion: session.conversationVersion,
      externalUserId: session.externalUserId,
      externalUserName: session.externalUserName,
      id: session.id,
      isOwnBinding,
      lastActiveAt: session.lastActiveAt.toISOString(),
      threadType: session.threadType,
    },
  })
})

/**
 * POST /api/admin/qq/sessions/[sessionId]/messages
 * 管理员：向本人绑定的 QQ 会话代发文本 / 附件
 */
export const POST = withAdmin<{ sessionId: string }>(async (request, { params, userId }) => {
  const { sessionId } = await params
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  let requestId = ''
  let text = ''
  let media: QQOutboundMedia[] = []
  try {
    ;({ media, requestId, text } = await parseOutboundBody(request))
  } catch (error) {
    if (error instanceof QQOutboundError) return jsonError(error.message, 400)
    return jsonError('Invalid request body', 400)
  }
  if (!text && media.length === 0) return jsonError('请输入文字或选择附件')
  if (!requestId || requestId.length > 128) return jsonError('Invalid requestId', 400)
  if (text.length > MAX_OUTBOUND_TEXT_LENGTH) {
    return jsonError(`text exceeds ${MAX_OUTBOUND_TEXT_LENGTH} characters`)
  }

  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, QQ_PLATFORM)
  if (!binding) return jsonError('QQ not bound', 404)
  if (!binding.enabled || binding.needsRebind) return jsonError('QQ binding inactive or needs rebind', 409)

  const eventModel = new ChannelEventModel()
  const session = await eventModel.getSession(sessionId)
  if (!session || session.bindingId !== binding.id) return jsonError('Session not found', 404)
  if (!canSendQQDevOutbound(binding, session)) return jsonError('仅可向本人绑定的 QQ 会话代发', 403)

  const inbound = await eventModel.findLatestInboundBySession(session.id, session.conversationVersion)
  const outboundCount = inbound
    ? await eventModel.countCompletedOutboundAfter(session.id, session.conversationVersion, inbound.createdAt)
    : 0

  const platformMessageId = `web-outbound:${requestId}`
  let event = await eventModel.findByPlatformMessageId(binding.id, platformMessageId)
  if (event && event.sessionId !== session.id) return jsonError('Invalid requestId', 400)
  if (event?.status === 'completed') {
    const message = outboundMessage(event, await outboundAttachments(event.id))
    if (!message) return jsonError('已发送消息记录为空', 500)
    return NextResponse.json({ message })
  }

  const inFlightChunks = event && event.status !== 'completed' ? event.sentChunkCount : 0
  const reply = resolveQQPassiveReply({
    hasAgentReply: Boolean(inbound?.responseText?.trim()),
    inboundCreatedAt: inbound?.createdAt,
    outboundCount: outboundCount + inFlightChunks,
    platformMessageId: inbound?.platformMessageId,
    threadType: resolveQQThreadType(session.externalUserId),
  })
  if (!reply.ok) return jsonError(reply.error, 409)

  if (!event) {
    event = await eventModel.insertQQOutbound({
      bindingId: binding.id,
      conversationVersion: session.conversationVersion,
      externalUserId: session.externalUserId,
      platformMessageId,
      platformPayload: {
        threadId: session.externalUserId,
        threadType: session.threadType ?? resolveQQThreadType(session.externalUserId),
      },
      responseText: text,
      sessionId: session.id,
    })
  } else {
    event = (await eventModel.resumeOutbound(event.id)) ?? event
    if (text && text !== (event.responseText ?? '')) {
      await eventModel.setOutboundSentChunkCount(event.id, event.sentChunkCount, { responseText: text })
      event = { ...event, responseText: text }
    }
  }

  const textSent = readOutboundTextSent(event.platformPayload)
  const skipText = Boolean(text) && textSent
  let chunksSent = event.sentChunkCount
  try {
    const persisted = await Promise.all(
      media.map(async (item, index) => {
        const operationHash = createHash('sha256')
          .update(`${requestId}:${index}:${item.fileName}:${item.buffer.byteLength}`)
          .digest('hex')
        const artifact = await persistWechatFile({
          buffer: item.buffer,
          contentType: item.mimeType,
          deliveryStatus: 'pending',
          direction: 'output',
          event: { conversationVersion: session.conversationVersion, id: event!.id, sessionId: session.id },
          filename: item.fileName,
          operationHash,
          summary: '网页代发附件',
          userId,
        })
        return { artifactId: artifact.artifactId, deliveryStatus: artifact.deliveryStatus, index }
      })
    )

    const sendable = media
      .map((item, index) => ({ index, item }))
      .filter(({ index }) => persisted[index]?.deliveryStatus !== 'sent')
    const outboundText = skipText ? '' : text
    if (outboundText || sendable.length > 0) {
      await sendQQDevOutbound({
        binding,
        media: sendable.map(({ item }) => item),
        onMediaSent: async (sendIndex) => {
          const target = persisted[sendable[sendIndex]!.index]
          if (target) await new ChannelEventFileModel().markSent(target.artifactId)
          chunksSent += 1
          await eventModel.setOutboundSentChunkCount(event!.id, chunksSent)
        },
        onTextSent: async () => {
          chunksSent += 1
          await eventModel.setOutboundSentChunkCount(event!.id, chunksSent, { textSent: true })
        },
        reply: reply.reply,
        session,
        text: outboundText,
      })
    }
    if (chunksSent > 0) await eventModel.setOutboundSentChunkCount(event.id, chunksSent)
    await eventModel.completeOutbound(event.id)
  } catch (error) {
    await eventModel.failOutbound(event.id, error instanceof Error ? error.message : 'Send failed')
    if (error instanceof QQOutboundError || error instanceof WechatFileArtifactError) {
      return jsonError(error.message, 400)
    }
    const message = error instanceof Error ? error.message : 'Send failed'
    return jsonError(message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').slice(0, 200), 502)
  }

  const message = outboundMessage(
    { ...event, responseText: text || event.responseText || '' },
    await outboundAttachments(event.id)
  )
  if (!message) return jsonError('发送成功但未返回消息记录', 500)
  return NextResponse.json({ message })
})
