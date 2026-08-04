import { beforeEach, describe, expect, it, vi } from 'vitest'

const execute = vi.fn()

vi.mock('@pure/database/core/db-adaptor', () => ({
  serverDB: { execute },
}))

describe('GET /api/health', () => {
  beforeEach(() => execute.mockReset())

  it('returns ready when PostgreSQL responds', async () => {
    execute.mockResolvedValueOnce([])
    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('returns a generic 503 without leaking the database error', async () => {
    execute.mockRejectedValueOnce(new Error('postgresql://user:secret@database'))
    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'unhealthy' })
  })
})
