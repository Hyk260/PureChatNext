import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app/spa/spaHtmlTemplate.generated', () => ({
  default: '<html><head><meta name="buildTime" content="2026-01-01T00:00:00.000Z" /></head></html>',
}))

describe('GET /api/version', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns package version, SPA buildTime, and no-store', async () => {
    const { CURRENT_VERSION } = await import('@/const/version')
    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      buildTime: '2026-01-01T00:00:00.000Z',
      version: CURRENT_VERSION,
    })
  })
})
