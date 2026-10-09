import { withAuth } from '@/libs/auth/get-session-user'
import { ReferralService } from '@/server/services/referrals'
import { contextSchema, readBody, referralResponse } from '@/server/services/referrals/http'

export { OPTIONS } from '@/server/services/referrals/http'
export const POST = withAuth(async (request, { userId }) =>
  referralResponse(request, async () => {
    const body = await readBody(request, contextSchema)
    return new ReferralService().accept(body.context, userId)
  })
)
