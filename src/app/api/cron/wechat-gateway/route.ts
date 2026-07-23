import { waitUntil } from '@vercel/functions'
import { type NextRequest, NextResponse } from 'next/server'

import { ChannelBindingModel, WECHAT_PLATFORM } from '@/database/models/channelBinding'
import { DEFAULT_DURATION_MS, pollBinding } from '@/libs/channels/wechat'
import { logger } from '@/libs/logger'

export const maxDuration = 300

/**
 * GET /api/cron/wechat-gateway
 * 续命微信 iLink 长轮询（需 CRON_SECRET）。建议每 5 分钟触发一次。
 * 使用 waitUntil 在后台跑完本轮 poll，避免 HTTP 响应挂满 duration。
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const model = new ChannelBindingModel()
    const bindings = await model.findEnabledByPlatform(WECHAT_PLATFORM)

    for (const binding of bindings) {
      waitUntil(
        pollBinding(binding, { durationMs: DEFAULT_DURATION_MS }).catch((error) => {
          logger.error({ bindingId: binding.id, error }, 'wechat-gateway poll failed')
        })
      )
    }

    logger.info({ started: bindings.length }, 'wechat-gateway cron started')
    return NextResponse.json({ ok: true, started: bindings.length })
  } catch (error) {
    logger.error(error, 'wechat-gateway cron failed:')
    return NextResponse.json({ error: 'Internal server error', ok: false }, { status: 500 })
  }
}
