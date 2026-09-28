// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  touchLastActiveAt: vi.fn(),
  waitUntil: vi.fn((promise: Promise<unknown>) => {
    void promise
  }),
}))

vi.mock('@vercel/functions', () => ({
  waitUntil: mocks.waitUntil,
}))

vi.mock('@pure/database/models/user', () => ({
  LAST_ACTIVE_TOUCH_INTERVAL_MS: 5 * 60_000,
  UserModel: class {
    touchLastActiveAt = mocks.touchLastActiveAt
  },
}))

import { LAST_ACTIVE_TOUCH_INTERVAL_MS, resetTouchLastActiveForTests, touchUserLastActive } from './touch-last-active'

describe('touchUserLastActive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTouchLastActiveForTests()
    mocks.touchLastActiveAt.mockResolvedValue(true)
  })

  it('schedules one DB touch per user within the throttle window', () => {
    touchUserLastActive('u1')
    touchUserLastActive('u1')

    expect(mocks.waitUntil).toHaveBeenCalledOnce()
    expect(mocks.touchLastActiveAt).toHaveBeenCalledOnce()
    expect(mocks.touchLastActiveAt).toHaveBeenCalledWith('u1')
  })

  it('allows another touch after the throttle window', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    touchUserLastActive('u1')

    vi.spyOn(Date, 'now').mockReturnValue(now + LAST_ACTIVE_TOUCH_INTERVAL_MS)
    touchUserLastActive('u1')

    expect(mocks.waitUntil).toHaveBeenCalledTimes(2)
    expect(mocks.touchLastActiveAt).toHaveBeenCalledTimes(2)
  })

  it('ignores empty userId', () => {
    touchUserLastActive('')
    expect(mocks.waitUntil).not.toHaveBeenCalled()
  })
})
