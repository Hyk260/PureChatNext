import { z } from 'zod'

import { ReferralModel, ReferralRuleError } from '@pure/database/models/referral'
import { withAuth } from '@/libs/auth/get-session-user'
import { referralEmailsSchema } from '@/libs/referrals/helpers'
import { ReferralService, serializeReferral } from '@/server/services/referrals'
import { readBody, referralResponse } from '@/server/services/referrals/http'

export { OPTIONS } from '@/server/services/referrals/http'
export const maxDuration = 120
const sendSchema = z.object({ emails: referralEmailsSchema, requestKey: z.string().uuid() })
const cursorSchema = z.object({ date: z.string().datetime(), id: z.string().uuid() })
const querySchema = z.object({
  days: z.enum(['7', '30', '90', '0']).default('90'),
  cursor: z.string().max(256).optional(),
})

export const POST = withAuth(async (request, { userId }) =>
  referralResponse(request, async () => {
    const body = await readBody(request, sendSchema)
    return new ReferralService().send(userId, [...new Set(body.emails)], body.requestKey)
  })
)

export const GET = withAuth(async (request, { userId }) =>
  referralResponse(request, async () => {
    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
    if (!parsed.success) throw new ReferralRuleError('历史查询参数无效')
    let cursor: { date: Date; id: string } | undefined
    if (parsed.data.cursor) {
      try {
        const raw = cursorSchema.parse(JSON.parse(Buffer.from(parsed.data.cursor, 'base64url').toString('utf8')))
        cursor = { date: new Date(raw.date), id: raw.id }
      } catch {
        throw new ReferralRuleError('分页游标无效')
      }
    }
    const result = await new ReferralModel().history(userId, Number(parsed.data.days), cursor)
    const last = result.items.at(-1)
    const nextCursor =
      result.hasMore && last
        ? Buffer.from(JSON.stringify({ date: last.createdAt.toISOString(), id: last.id })).toString('base64url')
        : null
    return { items: result.items.map(serializeReferral), nextCursor, totalSent: result.totalSent }
  })
)
