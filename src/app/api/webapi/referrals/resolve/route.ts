import type { NextRequest } from 'next/server'

import { ReferralService } from '@/server/services/referrals'
import { contextSchema, readBody, referralResponse } from '@/server/services/referrals/http'

export { OPTIONS } from '@/server/services/referrals/http'

/**
 * POST /api/webapi/referrals/resolve
 * 根据邀请上下文获取公开邀请信息
 * @param request - JSON `{ context }`
 */
export const POST = (request: NextRequest) =>
  referralResponse(request, async () => {
    const body = await readBody(request, contextSchema)
    return new ReferralService().publicInfo(body.context)
  })
