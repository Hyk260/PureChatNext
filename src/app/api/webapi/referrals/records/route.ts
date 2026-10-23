import { ReferralRuleError } from '@pure/database/models/referral'
import { withAuth } from '@/libs/auth/get-session-user'
import { ReferralService } from '@/server/services/referrals'
import { referralResponse } from '@/server/services/referrals/http'

export { OPTIONS } from '@/server/services/referrals/http'

/** GET /api/webapi/referrals/records — 当前邀请人的分页注册与奖励记录。 */
export const GET = withAuth(async (request, { userId }) =>
  referralResponse(request, async () => {
    const page = request.nextUrl.searchParams.get('page') ?? '1'
    if (!/^[1-9]\d{0,5}$/.test(page)) throw new ReferralRuleError('分页参数无效')
    return new ReferralService().records(userId, Number(page))
  })
)
