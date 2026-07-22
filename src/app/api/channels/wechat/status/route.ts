import { NextResponse } from 'next/server'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@/database/models/channelBinding'
import { withAuth } from '@/libs/auth/get-session-user'

/** GET /api/channels/wechat/status — 当前用户微信连接状态（不含凭证） */
export const GET = withAuth(async (_request, { userId }) => {
  const model = new ChannelBindingModel()
  const binding = await model.findByUserAndPlatform(userId, WECHAT_PLATFORM)

  if (!binding) {
    return NextResponse.json({
      connected: false,
      needsRebind: false,
    })
  }

  return NextResponse.json({
    agentId: binding.agentId,
    applicationId: binding.applicationId,
    connected: true,
    enabled: binding.enabled,
    lastActiveAt: binding.lastActiveAt?.toISOString() ?? null,
    needsRebind: binding.needsRebind,
  })
})
