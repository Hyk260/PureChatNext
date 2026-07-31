// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getBalance = vi.fn()

vi.mock('@/libs/auth/get-session-user', () => ({
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))

vi.mock('@pure/database/models/credits', () => ({
  CreditsModel: class {
    getBalance = getBalance
  },
}))

vi.mock('@/server/purehub', () => ({
  formatResetCountdown: () => ({ days: 3, hours: 2, resetAt: '2026-08-01T00:00:00+08:00' }),
  getShanghaiBillingPeriod: () => '2026-07',
  PUREHUB_DEFAULT_MODEL: 'gpt-5.4-mini',
  PUREHUB_ENABLED_MODELS: [
    { displayName: 'GPT 5.4 Mini', id: 'gpt-5.4-mini', recommended: true },
    { displayName: 'GPT 5.2', id: 'gpt-5.2' },
  ],
}))

import { GET } from './route'

describe('GET /api/user/credits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBalance.mockResolvedValue({ grant: 500_000, period: '2026-07', remaining: 490_000, used: 10_000 })
  })

  it('returns only the enabled PureHub model catalog', async () => {
    const response = await GET(new NextRequest('http://localhost/api/user/credits'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.defaultModel).toBe('gpt-5.4-mini')
    expect(payload.models).toEqual([
      { displayId: 'gpt-5.4-mini', displayName: 'GPT 5.4 Mini', recommended: true },
      { displayId: 'gpt-5.2', displayName: 'GPT 5.2', recommended: false },
    ])
    expect(getBalance).toHaveBeenCalledWith('user-1', '2026-07')
  })
})
