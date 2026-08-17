import { NextResponse } from 'next/server'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@pure/database/models/channelBinding'
import { ChannelEventModel } from '@pure/database/models/channelEvent'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'

/**
 * POST /api/channels/wechat/events/retry
 * 将失败的微信渠道事件重新入队
 */
export const POST = withAuth(async (_request, { userId }) => {
  const binding = await new ChannelBindingModel().findByUserAndPlatform(userId, WECHAT_PLATFORM)
  if (!binding) return jsonError('WeChat not connected', 404)
  const requeued = await new ChannelEventModel().requeueFailed(binding.id, 100)
  return NextResponse.json({ ok: true, requeued })
})
