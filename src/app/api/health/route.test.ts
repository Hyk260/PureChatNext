import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkHealthDependencies = vi.fn()
const getChannelGatewaySummary = vi.fn()

vi.mock('@/server/health/dependencies', () => ({ checkHealthDependencies }))
vi.mock('@/server/channel-gateway', () => ({ getChannelGatewaySummary }))

describe('GET /api/health', () => {
  beforeEach(() => {
    checkHealthDependencies.mockReset()
    getChannelGatewaySummary.mockReset()
    checkHealthDependencies.mockResolvedValue({
      database: 'ok',
      redis: 'skipped',
      search: 'skipped',
      storage: 'skipped',
    })
    getChannelGatewaySummary.mockReturnValue({
      enabled: false,
      platforms: {},
      running: false,
      status: 'disabled',
    })
  })

  it('returns ready when PostgreSQL responds', async () => {
    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/health'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      checks: {
        database: 'ok',
        redis: 'skipped',
        search: 'skipped',
        storage: 'skipped',
      },
      gateway: {
        enabled: false,
        platforms: {},
        running: false,
        status: 'disabled',
      },
      status: 'ok',
    })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('returns a generic 503 without leaking the database error', async () => {
    checkHealthDependencies.mockRejectedValueOnce(new Error('postgresql://user:secret@database'))
    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/health'))

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: 'unhealthy' })
  })

  it('sanitizes gateway errors while preserving status and platform counts', async () => {
    getChannelGatewaySummary.mockReturnValueOnce({
      enabled: true,
      error: 'postgresql://user:secret@database:5432/purechat',
      platforms: { qq: { active: 1, degraded: 1, desired: 2, online: 0, starting: 1 } },
      running: true,
      status: 'degraded',
    })

    const { GET } = await import('./route')
    const response = await GET(new Request('http://localhost/api/health'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.gateway).toEqual({
      enabled: true,
      error: 'Channel gateway unavailable',
      platforms: { qq: { active: 1, degraded: 1, desired: 2, online: 0, starting: 1 } },
      running: true,
      status: 'degraded',
    })
    expect(JSON.stringify(body)).not.toContain('postgresql://')
    expect(body.status).toBe('degraded')
  })
})
