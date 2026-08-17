import { createHash } from 'node:crypto'

import { NextResponse } from 'next/server'

import { AgentModel } from '@pure/database/models/agent'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { ChannelEventFileModel } from '@pure/database/models/channelEventFile'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import { persistWechatFile } from '@/libs/channels/wechat/fileArtifacts'
import { WECHAT_MAX_INBOUND_FILE_BYTES } from '@/libs/channels/wechat/inboundMedia'
import {
  canSendWechatDevOutbound,
  sendWechatOutbound,
  WechatOutboundError,
} from '@/libs/channels/wechat/outbound'
import type { WechatOutboundMedia } from '@/libs/channels/wechat/outbound'
import { expandEventsToMessages } from '@/libs/channels/wechat/timeline'
import {
  advanceWechatTimelineCursor,
  encodeWechatTimelineCursor,
  parseWechatTimelineCursor,
} from '@/libs/channels/wechat/timelineCursor'

const MAX_OUTBOUND_TEXT_LENGTH = 40_000
const MAX_OUTBOUND_FILES = 5

function resolveOwnerExternalUserId(credentials: string): string {
  try {
    return decryptCredentials(credentials).userId?.trim() || ''
  } catch {
    return ''
  }
}

function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim() || 'file'
  return base.slice(0, 180) || 'file'
}

async function parseOutboundBody(request: Request): Promise<{ media: WechatOutboundMedia[]; requestId: string; text: string }> {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData()
    const textValue = form.get('text')
    const text = typeof textValue === 'string' ? textValue.trim() : ''
    const requestIdValue = form.get('requestId')
    const requestId = typeof requestIdValue === 'string' ? requestIdValue.trim() : ''
    const entries = form.getAll('files').filter((item): item is File => item instanceof File)
    if (entries.length > MAX_OUTBOUND_FILES) {
      throw new WechatOutboundError(`一次最多发送 ${MAX_OUTBOUND_FILES} 个附件`)
    }
    const media: WechatOutboundMedia[] = []
    for (const file of entries) {
      const buffer = Buffer.from(await file.arrayBuffer())
      if (buffer.byteLength <= 0) throw new WechatOutboundError(`附件「${file.name}」为空`)
      if (buffer.byteLength > WECHAT_MAX_INBOUND_FILE_BYTES) {
        throw new WechatOutboundError(`附件「${file.name}」超过 10MB 限制`)
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
    throw new WechatOutboundError('Invalid JSON body')
  }
  const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim() : ''
  const requestId = typeof (body as { requestId?: unknown })?.requestId === 'string' ? (body as { requestId: string }).requestId.trim() : ''
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

/**
 * GET /api/dev/wechat/sessions/[sessionId]/messages
 * 开发环境：分页拉取微信会话时间线消息
 * @param request - query `limit` / `cursor` / `conversationVersion` / `watchEventId`
 */
export const GET = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  const { sessionId } = await params
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  const myBinding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)
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
  if (!sessionBinding || sessionBinding.platform !== WECHAT_PLATFORM) {
    return jsonError('Session not found', 404)
  }

  const { events, session } = result
  const effectiveAgentId = session.activeAgentId || sessionBinding.agentId
  const agent = await new AgentModel(userId).findVisibleById(effectiveAgentId)
  const isOwnBinding = Boolean(myBinding && session.bindingId === myBinding.id)
  const ownerExternalUserId = myBinding ? resolveOwnerExternalUserId(myBinding.credentials) : ''

  const responseCursor = encodeWechatTimelineCursor(
    advanceWechatTimelineCursor(
      after,
      events.map(({ createdAt, id }) => ({ createdAt, id }))
    ) ?? { createdAt: new Date(0), id: '' }
  )
  const expandedMessages = expandEventsToMessages(events)

  return NextResponse.json({
    cursor: responseCursor,
    messages: cursorParam ? expandedMessages : expandedMessages.slice(-Math.min(Math.max(limit, 1), 200)),
    session: {
      activeAgentId: session.activeAgentId,
      agentId: effectiveAgentId,
      agentTitle: agent?.title ?? null,
      applicationId: sessionBinding.applicationId,
      bindingId: session.bindingId,
      canSend:
        isOwnBinding && canSendWechatDevOutbound(ownerExternalUserId, session.externalUserId),
      conversationVersion: session.conversationVersion,
      externalUserId: session.externalUserId,
      externalUserName: session.externalUserName,
      id: session.id,
      isOwnBinding,
      lastActiveAt: session.lastActiveAt.toISOString(),
    },
  })
})

/**
 * POST /api/dev/wechat/sessions/[sessionId]/messages
 * 开发环境：向微信会话发送出站消息
 */
export const POST = withAuth<{ sessionId: string }>(async (request, { params, userId }) => {
  const { sessionId } = await params
  if (!sessionId?.trim()) return jsonError('Invalid sessionId', 400)

  let requestId = ''
  let text = ''
  let media: WechatOutboundMedia[] = []
  try {
    ;({ media, requestId, text } = await parseOutboundBody(request))
  } catch (error) {
    if (error instanceof WechatOutboundError) return jsonError(error.message, 400)
    return jsonError('Invalid request body', 400)
  }
  if (!text && media.length === 0) return jsonError('请输入文字或选择附件')
  if (!requestId || requestId.length > 128) return jsonError('Invalid requestId', 400)
  if (text.length > MAX_OUTBOUND_TEXT_LENGTH) {
    return jsonError(`text exceeds ${MAX_OUTBOUND_TEXT_LENGTH} characters`)
  }

  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (!binding) return jsonError('WeChat not bound', 404)
  if (!binding.enabled || binding.needsRebind) return jsonError('WeChat binding inactive or needs rebind', 409)

  const eventModel = new ChannelEventModel()
  const session = await eventModel.getSession(sessionId)
  if (!session || session.bindingId !== binding.id) return jsonError('Session not found', 404)

  const ownerExternalUserId = resolveOwnerExternalUserId(binding.credentials)
  if (!canSendWechatDevOutbound(ownerExternalUserId, session.externalUserId)) {
    return jsonError('仅可向扫码授权的微信账号代发', 403)
  }

  const platformMessageId = `web-outbound:${requestId}`
  let event = await eventModel.findByPlatformMessageId(binding.id, platformMessageId)
  if (event && event.sessionId !== session.id) return jsonError('Invalid requestId', 400)
  const encryptedContextToken = event?.encryptedContextToken ?? (await eventModel.findLatestEncryptedContextToken(sessionId))
  if (!encryptedContextToken) {
    return jsonError('该联系人尚无可用会话 token，请先用微信发一条消息', 400)
  }

  if (!event) {
    event = await eventModel.insertOutboundMessage({
      bindingId: binding.id,
      conversationVersion: session.conversationVersion,
      encryptedContextToken,
      externalUserId: session.externalUserId,
      platformMessageId,
      responseText: text,
      sessionId: session.id,
      status: 'processing',
    })
  } else if (event.status === 'completed') {
    const attachments = await outboundAttachments(event.id)
    const [message] = expandEventsToMessages([{ ...event, attachments }])
    if (!message) return jsonError('已发送消息记录为空', 500)
    return NextResponse.json({ message })
  } else {
    event = (await eventModel.resumeOutbound(event.id)) ?? event
  }

  const persisted = [] as Array<{ artifactId: string; deliveryStatus: string; fileId: string }>
  try {
    for (const [index, item] of media.entries()) {
      const operationHash = createHash('sha256')
        .update(`${requestId}:${index}:${item.fileName}:${item.buffer.byteLength}`)
        .digest('hex')
      const artifact = await persistWechatFile({
        buffer: item.buffer,
        contentType: item.mimeType,
        deliveryStatus: 'pending',
        direction: 'output',
        event: { conversationVersion: session.conversationVersion, id: event.id, sessionId: session.id },
        filename: item.fileName,
        operationHash,
        summary: '网页代发附件',
        userId,
      })
      persisted.push({ artifactId: artifact.artifactId, deliveryStatus: artifact.deliveryStatus, fileId: artifact.file.id })
    }

    const sendable = media
      .map((item, index) => ({ item, index }))
      .filter(({ index }) => persisted[index]?.deliveryStatus !== 'sent')
    if ((event.sentChunkCount === 0 && text) || sendable.length > 0) {
      await sendWechatOutbound({
        credentials: binding.credentials,
        encryptedContextToken,
        media: sendable.map(({ item }) => item),
        onMediaSent: async (sendIndex) => {
          const target = persisted[sendable[sendIndex]!.index]
          if (target) await new ChannelEventFileModel().markSent(target.artifactId)
        },
        onTextSent: () => eventModel.markOutboundTextSent(event!.id),
        text: event.sentChunkCount > 0 ? '' : text,
        toUserId: session.externalUserId,
      })
    }
    await eventModel.completeOutbound(event.id)
  } catch (error) {
    await eventModel.failOutbound(event.id, error instanceof Error ? error.message : 'Send failed')
    if (error instanceof WechatOutboundError) return jsonError(error.message, 400)
    const message = error instanceof Error ? error.message : 'Send failed'
    return jsonError(message.replace(/[A-Za-z0-9_-]{24,}/g, '[redacted]').slice(0, 200), 502)
  }

  const attachments = await outboundAttachments(event.id)
  const [message] = expandEventsToMessages([
    {
      attachments,
      completedAt: new Date(),
      content: event.content,
      createdAt: event.createdAt,
      durationMs: event.durationMs,
      id: event.id,
      lastErrorCode: event.lastErrorCode,
      lastErrorMessage: event.lastErrorMessage,
      messageKind: event.messageKind,
      model: event.model,
      provider: event.provider,
      responseText: event.responseText,
      status: 'completed',
    },
  ])

  return NextResponse.json({ message })
})
