import { type NextRequest, NextResponse } from 'next/server'

import { UNVERIFIED_USER_TTL_MS } from '@/const/auth'
import { UserModel } from '@pure/database/models/user'
import { logger } from '@/libs/logger'

/**
 * GET /api/cron/cleanup-unverified-users
 * 清理超过 24h 仍未验证邮箱的用户（Vercel Cron / 手动带 CRON_SECRET 调用）
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await UserModel.deleteUnverifiedOlderThan(UNVERIFIED_USER_TTL_MS)
    logger.info({ cutoff: result.cutoff.toISOString(), deleted: result.deleted }, 'cleanup-unverified-users')
    return NextResponse.json({
      cutoff: result.cutoff.toISOString(),
      deleted: result.deleted,
      ok: true,
    })
  } catch (error) {
    logger.error(error, 'cleanup-unverified-users failed:')
    return NextResponse.json({ error: 'Internal server error', ok: false }, { status: 500 })
  }
}
