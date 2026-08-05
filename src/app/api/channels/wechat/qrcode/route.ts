import { NextResponse } from 'next/server'

import { fetchQrCode } from '@pure/chat-adapter/wechat'

import { withAuth, jsonError } from '@/libs/auth/get-session-user'
import { isWechatGatewaySupported, requireWechatVaultSecret } from '@/libs/channels/wechat'

// 最大持续时间30秒
export const maxDuration = 30

/**
 * POST
 * /api/channels/wechat/qrcode
 * — 获取扫码二维码
 * */
export const POST = withAuth(async () => {
  if (!isWechatGatewaySupported()) return jsonError('当前部署不支持微信 Gateway，请使用 Docker 或本地 Gateway', 503)
  try {
    requireWechatVaultSecret()
  } catch {
    return jsonError('服务器未配置 KEY_VAULTS_SECRET', 503)
  }
  try {
    const qr = await fetchQrCode()
    return NextResponse.json(qr)
  } catch (error) {
    return jsonError('获取微信二维码失败，请稍后重试', 502)
  }
})
