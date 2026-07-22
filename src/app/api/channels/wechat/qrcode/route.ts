import { NextResponse } from 'next/server'

import { fetchQrCode } from '@pure/chat-adapter-wechat'

import { withAuth, jsonError } from '@/libs/auth/get-session-user'

// 最大持续时间30秒
export const maxDuration = 30

/**
 * POST
 * /api/channels/wechat/qrcode
 * — 获取扫码二维码
 * */
export const POST = withAuth(async () => {
  try {
    const qr = await fetchQrCode()
    return NextResponse.json(qr)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get QR code'
    return jsonError(message, 502)
  }
})
