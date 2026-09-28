import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import { LAST_ACTIVE_TOUCH_INTERVAL_MS, UserModel } from '../user'
import type { ChatDatabase } from '../../type'

describe('UserModel.touchLastActiveAt', () => {
  const returning = vi.fn()
  const where = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where }))
  const update = vi.fn(() => ({ set }))
  const db = { update } as unknown as ChatDatabase

  beforeEach(() => {
    vi.clearAllMocks()
    where.mockReturnValue({ returning })
    set.mockReturnValue({ where })
    update.mockReturnValue({ set })
  })

  it('updates when last_active_at is older than the throttle window', async () => {
    returning.mockResolvedValue([{ id: 'u1' }])
    const now = new Date('2026-09-28T12:00:00.000Z')

    await expect(new UserModel(db).touchLastActiveAt('u1', now)).resolves.toBe(true)

    expect(update).toHaveBeenCalledOnce()
    expect(set).toHaveBeenCalledWith({ lastActiveAt: now })
    expect(where).toHaveBeenCalledOnce()
  })

  it('returns false when the conditional update matches no rows', async () => {
    returning.mockResolvedValue([])
    const now = new Date('2026-09-28T12:00:00.000Z')

    await expect(new UserModel(db).touchLastActiveAt('u1', now)).resolves.toBe(false)
  })

  it('uses a threshold of LAST_ACTIVE_TOUCH_INTERVAL_MS before now', () => {
    expect(LAST_ACTIVE_TOUCH_INTERVAL_MS).toBe(5 * 60_000)
  })
})
