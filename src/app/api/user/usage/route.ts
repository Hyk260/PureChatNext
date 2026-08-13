import { CreditsModel } from '@pure/database/models/credits'
import type { UsageSortBy } from '@pure/database/models/credits'
import { FileModel } from '@pure/database/models/file'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { fileStorageLimitBytes } from '@/envs/file'
import { withAuth } from '@/libs/auth/get-session-user'
import { formatResetCountdown, getShanghaiBillingPeriod } from '@/server/purechat'

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

/** GET /api/user/usage - 当前用户的 PureChat 积分用量与明细。 */
export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const params = request.nextUrl.searchParams
  const period = getShanghaiBillingPeriod()
  const startDate = params.get('startDate')
  const endDate = params.get('endDate')
  const page = parsePositiveInt(params.get('page'), 1, 1_000_000)
  const pageSize = parsePositiveInt(params.get('pageSize'), 10, 100)
  const sortBy = (params.get('sortBy') ?? 'createdAt') as UsageSortBy
  const sortOrder = params.get('sortOrder') ?? 'desc'
  const type = params.get('type') ?? 'all'
  const model = params.get('model')?.trim() || undefined
  const hasCompleteDateRange = startDate !== null && endDate !== null
  const dateSpan =
    hasCompleteDateRange && isValidDate(startDate) && isValidDate(endDate)
      ? (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000
      : 0

  if (
    (startDate === null) !== (endDate === null) ||
    (hasCompleteDateRange && (!isValidDate(startDate) || !isValidDate(endDate))) ||
    (hasCompleteDateRange && startDate > endDate) ||
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
  const fileModel = new FileModel(userId)
  const [balance, usage, usedBytes] = await Promise.all([
    modelInstance.getBalance(userId, period),
    modelInstance.getUsage({
      ...(hasCompleteDateRange
        ? {
            endAt: new Date(`${endDate}T23:59:59.999+08:00`),
            startAt: new Date(`${startDate}T00:00:00+08:00`),
          }
        : {}),
      model,
      page,
      pageSize,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
      userId,
    }),
    fileModel.getStorageUsage(),
  ])

  const countdown = formatResetCountdown()

  return NextResponse.json({
    balance: {
      ...balance,
      resetIn: { days: countdown.days, hours: countdown.hours },
    },
    storage: { limitBytes: fileStorageLimitBytes, usedBytes },
    ...usage,
  })
})
