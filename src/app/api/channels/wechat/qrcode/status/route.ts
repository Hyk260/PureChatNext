import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { pollQrStatus } from '@pure/chat-adapter/wechat'

import { withAuth, jsonError } from '@/libs/auth/get-session-user'
import { isWechatGatewaySupported } from '@/libs/channels/wechat'

export const maxDuration = 30

/**
 * GET /api/channels/wechat/qrcode/status
 * 轮询扫码状态
 * @param request - query `qrcode`
 */
export const GET = withAuth(async (request: NextRequest) => {
  if (!isWechatGatewaySupported()) return jsonError('当前部署不支持微信 Gateway', 503)
  const qrcode = request.nextUrl.searchParams.get('qrcode')?.trim()
  if (!qrcode || qrcode.length > 4096) return jsonError('Invalid qrcode')

  try {
    const status = await pollQrStatus(qrcode)
    // Never leak full bot_token to logs; client needs it once for bind
    return NextResponse.json(status)
  } catch (error) {
    return jsonError('查询扫码状态失败，请稍后重试', 502)
  }
})
