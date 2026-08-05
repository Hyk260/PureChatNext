import { NextResponse } from 'next/server'

import { WechatApiClient } from '@pure/chat-adapter/wechat'
import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/wechat/encrypt'
import { downloadStoredWechatFile, parseWechatFileContent } from '@/libs/channels/wechat/inboundMedia'

function contentDispositionFilename(fileName: string) {
  const safe = fileName.replaceAll(/["\\\r\n]/g, '_').slice(0, 180) || 'file'
  const encoded = encodeURIComponent(fileName).replaceAll(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`
}

export const GET = withAuth<{ eventId: string }>(async (_request, { params, userId }) => {
  const { eventId } = await params
  if (!eventId?.trim()) return jsonError('Invalid eventId', 400)

  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (!binding) return jsonError('WeChat not bound', 404)

  const event = await new ChannelEventModel().findById(eventId)
  if (!event || event.bindingId !== binding.id) return jsonError('Event not found', 404)
  if (event.messageKind !== 'file') return jsonError('Not a file event', 400)

  const payload = parseWechatFileContent(event.content)
  if (!payload) return jsonError('Invalid file payload', 400)

  try {
    const credentials = decryptCredentials(binding.credentials)
    const api = new WechatApiClient(credentials.botToken, credentials.botId)
    const downloaded = await downloadStoredWechatFile(api, payload)
    if (!downloaded) return jsonError('Failed to download file', 502)

    return new NextResponse(new Uint8Array(downloaded.buffer), {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'Content-Disposition': contentDispositionFilename(downloaded.fileName),
        'Content-Type': downloaded.mimeType,
      },
      status: 200,
    })
  } catch {
    return jsonError('File download error', 502)
  }
})
