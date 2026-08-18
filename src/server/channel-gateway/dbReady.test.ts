import { beforeEach, describe, expect, it, vi } from 'vitest'

const execute = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@pure/database/core/db-adaptor', () => ({
  serverDB: { execute },
}))

describe('pingDatabase', () => {
  beforeEach(() => execute.mockReset())

  it('returns true when PostgreSQL responds', async () => {
    execute.mockResolvedValueOnce([])
    const { pingDatabase } = await import('./dbReady')
    await expect(pingDatabase()).resolves.toBe(true)
  })

  it('returns false without throwing when PostgreSQL is down', async () => {
    execute.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'))
    const { pingDatabase } = await import('./dbReady')
    await expect(pingDatabase()).resolves.toBe(false)
  })
})
