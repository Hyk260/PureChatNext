import { withAuth } from '@/libs/auth/get-session-user'
import { ReferralService } from '@/server/services/referrals'
import { referralResponse } from '@/server/services/referrals/http'

export { OPTIONS } from '@/server/services/referrals/http'

/** GET /api/webapi/referrals/summary — 当前用户的分享信息与推荐奖励概览。 */
export const GET = withAuth(async (request, { userId }) =>
  referralResponse(request, () => new ReferralService().summary(userId))
)
