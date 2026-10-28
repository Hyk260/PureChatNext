import { NextResponse } from 'next/server'

import { WechatApiClient } from '@pure/chat-adapter/wechat'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { jsonError, withAdmin } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import { downloadStoredWechatImage, parseWechatImageContent } from '@/libs/channels/wechat/inboundMedia'

/**
 * GET /api/admin/wechat/events/[eventId]/image
 * 管理员：下载微信入站图片事件内容
 */
export const GET = withAdmin<{ eventId: string }>(async (_request, { params }) => {
  const { eventId } = await params
  if (!eventId?.trim()) return jsonError('Invalid eventId', 400)
  const eventModel = new ChannelEventModel()
  const event = await eventModel.findById(eventId)
  if (!event) return jsonError('Event not found', 404)
  const [binding, session] = await Promise.all([
    new ChannelBindingModel().findById(event.bindingId),
    eventModel.getSession(event.sessionId),
  ])
  if (!binding || binding.platform !== WECHAT_PLATFORM || session?.bindingId !== binding.id) {
    return jsonError('Event not found', 404)
  }
  if (event.messageKind !== 'image') return jsonError('Not an image event', 400)

  const payload = parseWechatImageContent(event.content)
  if (!payload) return jsonError('Invalid image payload', 400)

  try {
    const credentials = decryptCredentials(binding.credentials)
    const api = new WechatApiClient(credentials.botToken, credentials.botId)
    const downloaded = await downloadStoredWechatImage(api, payload)
    if (!downloaded) return jsonError('Failed to download image', 502)

    return new NextResponse(new Uint8Array(downloaded.buffer), {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': downloaded.mimeType,
      },
      status: 200,
    })
  } catch {
    return jsonError('Image download error', 502)
  }
})
