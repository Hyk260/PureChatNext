import type { NextRequest } from 'next/server'

import { ReferralService } from '@/server/services/referrals'
import { contextSchema, readBody, referralResponse } from '@/server/services/referrals/http'

export { OPTIONS } from '@/server/services/referrals/http'
/** Reveal signup prefill only after the visitor explicitly chooses to accept. */
export const POST = (request: NextRequest) =>
  referralResponse(request, async () => {
    const body = await readBody(request, contextSchema)
    return new ReferralService().prepare(body.context)
  })
