// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getBalance = vi.fn()
const getStorageUsage = vi.fn()
const getUsage = vi.fn()

vi.mock('@/libs/auth/get-session-user', () => ({
  withAuth:
    (
      handler: (
        request: NextRequest,
        context: { params: Promise<Record<string, never>>; userId: string }
      ) => Promise<Response>
    ) =>
    (request: NextRequest) =>
      handler(request, { params: Promise.resolve({}), userId: 'user-1' }),
}))
vi.mock('@pure/database/models/credits', () => ({
  CreditsModel: class {
    getBalance = getBalance
    getUsage = getUsage
  },
}))
vi.mock('@pure/database/models/file', () => ({
  FileModel: class {
    getStorageUsage = getStorageUsage
  },
}))
vi.mock('@/envs/file', () => ({ fileStorageLimitBytes: 15 * 1024 * 1024 }))
vi.mock('@/server/purechat', () => ({ getShanghaiBillingPeriod: () => '2026-07' }))

import { GET } from './route'

describe('GET /api/user/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBalance.mockResolvedValue({ grant: 500_000, period: '2026-07', remaining: 490_000, used: 10_000 })
    getStorageUsage.mockResolvedValue(1024)
    getUsage.mockResolvedValue({ items: [], models: [], page: 1, pageSize: 10, total: 0, totalCredits: 0 })
  })

  it('queries all history and returns storage usage by default', async () => {
    const response = await GET(new NextRequest('http://localhost/api/user/usage'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.storage).toEqual({ limitBytes: 15 * 1024 * 1024, usedBytes: 1024 })
    expect(getUsage).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 10, userId: 'user-1' }))
    expect(getUsage.mock.calls[0]![0]).not.toHaveProperty('startAt')
    expect(getUsage.mock.calls[0]![0]).not.toHaveProperty('endAt')
  })

  it.each([
    'startDate=bad&endDate=2026-07-01',
    'endDate=2026-07-01',
    'startDate=2026-02-31&endDate=2026-03-01',
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
      expect.objectContaining({
        endAt: new Date('2026-07-03T15:59:59.999Z'),
        model: 'sonnet',
        page: 2,
        pageSize: 5,
        sortBy: 'credits',
        sortOrder: 'asc',
        startAt: new Date('2026-07-01T16:00:00.000Z'),
      })
    )
  })
})
