import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { ChannelGatewayLogModel } from '@pure/database/models/channelGatewayLog'
import { isChannelLogPlatform } from '@pure/types'
import { withAuth } from '@/libs/auth/get-session-user'

export const runtime = 'nodejs'

const readLogs = withAuth<{ platform: string }>(async (_request, { params, userId }) => {
  const { platform } = await params
  if (!isChannelLogPlatform(platform)) return NextResponse.json({ error: 'Unknown channel' }, { status: 404 })
  try {
    return NextResponse.json(await new ChannelGatewayLogModel().read(userId, platform))
  } catch {
    return NextResponse.json({ error: '无法读取服务端诊断日志，请稍后重试' }, { status: 503 })
  }
})

export async function GET(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  const response = await readLogs(request, context)
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}
