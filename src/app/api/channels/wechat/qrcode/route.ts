import { NextResponse } from 'next/server'

import { withAuth, jsonError } from '@/libs/auth/get-session-user'
import { fetchQrCode } from '@/libs/channels/wechat'

export const maxDuration = 30

/** POST /api/channels/wechat/qrcode — 获取扫码二维码 */
export const POST = withAuth(async () => {
  try {
    const qr = await fetchQrCode()
    return NextResponse.json(qr)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get QR code'
    return jsonError(message, 502)
  }
})
