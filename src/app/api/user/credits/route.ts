import { withAuth } from '@/libs/auth/get-session-user'
import { CreditsModel } from '@pure/database/models/credits'
import { NextResponse } from 'next/server'

import {
  formatResetCountdown,
  getShanghaiBillingPeriod,
  PURECHAT_DEFAULT_MODEL,
  PURECHAT_ENABLED_MODELS,
} from '@/server/purechat'

/**
 * GET /api/user/credits
 * 当前上海自然月免费积分余额（懒发放）。
 */
export const GET = withAuth(async (_request, { userId }) => {
  const period = getShanghaiBillingPeriod()
  const balance = await new CreditsModel().getBalance(userId, period)
  const countdown = formatResetCountdown()

  return NextResponse.json({
    ...balance,
    defaultModel: PURECHAT_DEFAULT_MODEL,
    models: PURECHAT_ENABLED_MODELS.map((m) => ({
      displayId: m.id,
      displayName: m.displayName,
      recommended: Boolean(m.recommended),
    })),
    resetAt: countdown.resetAt,
    resetIn: { days: countdown.days, hours: countdown.hours },
  })
})
