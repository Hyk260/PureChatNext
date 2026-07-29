import { CreditsModel, type UsageSortBy } from '@pure/database/models/credits'
import { NextResponse, type NextRequest } from 'next/server'

import { withAuth } from '@/libs/auth/get-session-user'
import { getShanghaiBillingPeriod } from '@/server/purehub'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const SORT_FIELDS = new Set<UsageSortBy>(['createdAt', 'credits', 'durationMs', 'totalTokens'])

const isValidDate = (value: string) => {
  if (!DATE_RE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year!, month! - 1, day!))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month! - 1 && parsed.getUTCDate() === day
}

const parsePositiveInt = (value: string | null, fallback: number, maximum: number) => {
  if (value === null) return fallback
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return parsed >= 1 && parsed <= maximum ? parsed : null
}

/** GET /api/user/usage - 当前用户的 PureHub 积分用量与明细。 */
export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const params = request.nextUrl.searchParams
  const period = getShanghaiBillingPeriod()
  const defaultStart = `${period}-01`
  const defaultEnd = new Date(Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0))
    .toISOString()
    .slice(0, 10)
  const startDate = params.get('startDate') ?? defaultStart
  const endDate = params.get('endDate') ?? defaultEnd
  const page = parsePositiveInt(params.get('page'), 1, 1_000_000)
  const pageSize = parsePositiveInt(params.get('pageSize'), 20, 100)
  const sortBy = (params.get('sortBy') ?? 'createdAt') as UsageSortBy
  const sortOrder = params.get('sortOrder') ?? 'desc'
  const type = params.get('type') ?? 'chat'
  const model = params.get('model')?.trim() || undefined
  const dateSpan = isValidDate(startDate) && isValidDate(endDate)
    ? (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000
    : Number.POSITIVE_INFINITY

  if (
    !isValidDate(startDate) ||
    !isValidDate(endDate) ||
    startDate > endDate ||
    dateSpan > 366 ||
    page === null ||
    pageSize === null ||
    !SORT_FIELDS.has(sortBy) ||
    !['asc', 'desc'].includes(sortOrder) ||
    !['all', 'chat'].includes(type) ||
    (model?.length ?? 0) > 100
  ) {
    return NextResponse.json({ error: 'Invalid usage query parameters' }, { status: 400 })
  }

  const modelInstance = new CreditsModel()
  const [balance, usage] = await Promise.all([
    modelInstance.getBalance(userId, period),
    modelInstance.getUsage({
      endAt: new Date(`${endDate}T23:59:59.999+08:00`),
      model,
      page,
      pageSize,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
      startAt: new Date(`${startDate}T00:00:00+08:00`),
      userId,
    }),
  ])

  return NextResponse.json({
    balance,
    dateRange: { endDate, startDate },
    ...usage,
  })
})
