import { NextResponse } from 'next/server'

import { ChannelBindingModel, QQ_PLATFORM } from '@/database/models/channelBinding'
import { appEnv } from '@/envs/app'
import { withAuth } from '@/libs/auth/get-session-user'
import { decryptCredentials } from '@/libs/channels/qq'

function resolveAppBaseUrl(): string {
  const fromEnv = appEnv.APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  return 'http://localhost:3000'
}

/** GET /api/channels/qq/status — 当前用户 QQ 连接状态（不含 Secret） */
export const GET = withAuth(async (_request, { userId }) => {
  const model = new ChannelBindingModel()
  const binding = await model.findByUserAndPlatform(userId, QQ_PLATFORM)

  if (!binding) {
    return NextResponse.json({
      connected: false,
    })
  }

  let connectionMode: 'websocket' | 'webhook' = 'websocket'
  let appId = binding.applicationId
  try {
    const credentials = decryptCredentials(binding.credentials)
    connectionMode = credentials.connectionMode
    appId = credentials.appId || binding.applicationId
  } catch {
    /* credentials decrypt failure — still report connected */
  }

  const webhookUrl = `${resolveAppBaseUrl()}/api/channels/qq/webhook/${encodeURIComponent(binding.applicationId)}`

  return NextResponse.json({
    agentId: binding.agentId,
    appId,
    applicationId: binding.applicationId,
    connected: true,
    connectionMode,
    enabled: binding.enabled,
    lastActiveAt: binding.lastActiveAt?.toISOString() ?? null,
    webhookUrl,
  })
})
