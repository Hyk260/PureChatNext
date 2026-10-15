import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { CreditsModel } from '@pure/database/models/credits'
import { UserModel } from '@pure/database/models/user'
import { isRecord, toTrimmedString } from '@pure/utils/object'

import { jsonError, withAdmin } from '@/libs/auth/get-session-user'
import { getShanghaiBillingPeriod } from '@/server/purechat/period'

const parseJsonBody = async (request: NextRequest) => {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}

/** POST /api/admin/users/credits/reset — 重置用户本月额度。 */
export const POST = withAdmin(async (request) => {
  const body = await parseJsonBody(request)
  if (!isRecord(body)) return jsonError('Invalid JSON body')

  const id = toTrimmedString(body.id)
  if (!id) return jsonError('Missing or invalid "id" field')
  if (!(await new UserModel().findById(id))) return jsonError('User not found', 404)

  const balance = await new CreditsModel().resetPeriod(id, getShanghaiBillingPeriod())
  return NextResponse.json({
    credits: {
      grant: balance.grant,
      remaining: balance.remaining,
    },
  })
})
