import { NextResponse } from 'next/server'

import { WechatApiClient } from '@pure/chat-adapter/wechat'
import { ChannelBindingModel } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import { downloadStoredWechatFile, parseWechatFileContent } from '@/libs/channels/wechat/inboundMedia'

function contentDispositionFilename(fileName: string) {
  const safe = fileName.replaceAll(/["\\\r\n]/g, '_').slice(0, 180) || 'file'
  const encoded = encodeURIComponent(fileName).replaceAll(/['()]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  )
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`
}

/** Read a WeChat file only through a session owned by the authenticated account. */
export const GET = withAuth<{ eventId: string; platform: string; sessionId: string }>(
  async (_request, { params, userId }) => {
    const { eventId, platform, sessionId } = await params
    if (platform !== 'wechat') return jsonError('Event not found', 404)
    if (!eventId?.trim() || !sessionId?.trim()) return jsonError('Invalid media reference', 400)

    const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, 'wechat')
    if (!binding) return jsonError('Event not found', 404)
    const eventModel = new ChannelEventModel()
    const session = await eventModel.getSessionByBinding(sessionId, binding.id)
    if (!session) return jsonError('Event not found', 404)
    const event = await eventModel.findMediaEventBySessionAndBinding(eventId, session.id, binding.id)
    if (!event) return jsonError('Event not found', 404)
    if (event.messageKind !== 'file') return jsonError('Not a file event', 400)

    const payload = parseWechatFileContent(event.content)
    if (!payload) return jsonError('Invalid file payload', 400)
    try {
      const credentials = decryptCredentials(binding.credentials)
      const downloaded = await downloadStoredWechatFile(
        new WechatApiClient(credentials.botToken, credentials.botId),
        payload
      )
      if (!downloaded) return jsonError('Failed to download file', 502)

      return new NextResponse(new Uint8Array(downloaded.buffer), {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Disposition': contentDispositionFilename(downloaded.fileName),
          'Content-Type': downloaded.mimeType,
        },
      })
    } catch {
      return jsonError('File download error', 502)
    }
  }
)
