// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getBalance = vi.fn()
const getUsage = vi.fn()

vi.mock('@/libs/auth/get-session-user', () => ({
  withAuth:
    (handler: (request: NextRequest, context: { params: Promise<Record<string, never>>; userId: string }) => Promise<Response>) =>
    (request: NextRequest) =>
    handler(request, { params: Promise.resolve({}), userId: 'user-1' }),
}))
vi.mock('@pure/database/models/credits', () => ({
  CreditsModel: class {
    getBalance = getBalance
    getUsage = getUsage
  },
}))
vi.mock('@/server/purehub', () => ({ getShanghaiBillingPeriod: () => '2026-07' }))

import { GET } from './route'

describe('GET /api/user/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBalance.mockResolvedValue({ grant: 500_000, period: '2026-07', remaining: 490_000, used: 10_000 })
    getUsage.mockResolvedValue({ daily: [], items: [], models: [], page: 1, pageSize: 20, total: 0, totalCredits: 0 })
  })

  it('uses the current Shanghai billing month by default', async () => {
    const response = await GET(new NextRequest('http://localhost/api/user/usage'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.dateRange).toEqual({ endDate: '2026-07-31', startDate: '2026-07-01' })
    expect(getUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        endAt: new Date('2026-07-31T15:59:59.999Z'),
        page: 1,
        pageSize: 20,
        startAt: new Date('2026-06-30T16:00:00.000Z'),
        userId: 'user-1',
      })
    )
  })

  it.each([
    'startDate=bad',
    'startDate=2026-02-31',
    'startDate=2026-08-01&endDate=2026-07-01',
    'startDate=2024-01-01&endDate=2026-01-01',
    'page=0',
    'pageSize=101',
    'sortBy=model',
    'sortOrder=sideways',
    'type=image',
  ])('rejects invalid query: %s', async (query) => {
    const response = await GET(new NextRequest(`http://localhost/api/user/usage?${query}`))
    expect(response.status).toBe(400)
    expect(getUsage).not.toHaveBeenCalled()
  })

  it('passes filters, paging, and sorting to the model', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/user/usage?startDate=2026-07-02&endDate=2026-07-03&model=sonnet&page=2&pageSize=5&sortBy=credits&sortOrder=asc&type=chat'
      )
    )

    expect(response.status).toBe(200)
    expect(getUsage).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'sonnet', page: 2, pageSize: 5, sortBy: 'credits', sortOrder: 'asc' })
    )
  })
})
