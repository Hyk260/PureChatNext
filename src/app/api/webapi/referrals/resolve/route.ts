import type { NextRequest } from 'next/server'

import { ReferralService } from '@/server/services/referrals'
import { contextSchema, readBody, referralResponse } from '@/server/services/referrals/http'

export { OPTIONS } from '@/server/services/referrals/http'
export const POST = (request: NextRequest) =>
  referralResponse(request, async () => {
    const body = await readBody(request, contextSchema)
    return new ReferralService().publicInfo(body.context)
  })
