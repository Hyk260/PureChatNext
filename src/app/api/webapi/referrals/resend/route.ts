import { z } from 'zod'

import { ReferralModel, ReferralRuleError } from '@pure/database/models/referral'
import { withAuth } from '@/libs/auth/get-session-user'
import { ReferralService } from '@/server/services/referrals'
import { readBody, referralResponse } from '@/server/services/referrals/http'

export { OPTIONS } from '@/server/services/referrals/http'
export const maxDuration = 30
const schema = z.object({ id: z.string().uuid(), requestKey: z.string().uuid() })
export const POST = withAuth(async (request, { userId }) =>
  referralResponse(request, async () => {
    const body = await readBody(request, schema)
    const row = await new ReferralModel().find(body.id)
    if (!row || row.inviterId !== userId) throw new ReferralRuleError('邀请不存在', 404)
    return new ReferralService().send(userId, [row.email], body.requestKey, row.id)
  })
)
