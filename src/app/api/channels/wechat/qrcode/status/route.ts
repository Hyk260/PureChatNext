import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { pollQrStatus } from '@pure/chat-adapter/wechat'

import { withAuth, jsonError } from '@/libs/auth/get-session-user'

export const maxDuration = 30

/**
 * GET
 * /api/channels/wechat/qrcode/status?qrcode=
 * — 轮询扫码状态
 * */
export const GET = withAuth(async (request: NextRequest) => {
  const qrcode = request.nextUrl.searchParams.get('qrcode')?.trim()
  if (!qrcode) return jsonError('qrcode is required')

  try {
    const status = await pollQrStatus(qrcode)
    // Never leak full bot_token to logs; client needs it once for bind
    return NextResponse.json(status)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to poll QR status'
    return jsonError(message, 502)
  }
})
