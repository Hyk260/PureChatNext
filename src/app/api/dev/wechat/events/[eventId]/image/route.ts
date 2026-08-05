import { NextResponse } from 'next/server'

import { WechatApiClient } from '@pure/chat-adapter/wechat'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import { downloadStoredWechatImage, parseWechatImageContent } from '@/libs/channels/wechat/inboundMedia'

export const GET = withAuth<{ eventId: string }>(async (_request, { params, userId }) => {
  const { eventId } = await params
  if (!eventId?.trim()) return jsonError('Invalid eventId', 400)

  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (!binding) return jsonError('WeChat not bound', 404)

  const event = await new ChannelEventModel().findById(eventId)
  if (!event || event.bindingId !== binding.id) return jsonError('Event not found', 404)
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
        'Cache-Control': 'private, max-age=300',
        'Content-Type': downloaded.mimeType,
      },
      status: 200,
    })
  } catch {
    return jsonError('Image download error', 502)
  }
})
