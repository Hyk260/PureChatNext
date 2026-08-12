import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  appEnv: {
    APP_URL: 'http://localhost:5174' as string | undefined,
    ALLOWED_ORIGINS: undefined as string | undefined,
    ALLOW_TRYCLOUDFLARE: false,
  },
}))

vi.mock('@/envs/app', () => ({ appEnv: mocks.appEnv }))

describe('getAllowedOrigins / isAllowedOrigin', () => {
  beforeEach(() => {
    mocks.appEnv.APP_URL = 'http://localhost:5174'
    mocks.appEnv.ALLOWED_ORIGINS = undefined
    mocks.appEnv.ALLOW_TRYCLOUDFLARE = false
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('trusts random TryCloudflare origins when ALLOW_TRYCLOUDFLARE=1', async () => {
    mocks.appEnv.ALLOW_TRYCLOUDFLARE = true
    const { getAllowedOrigins, isAllowedOrigin } = await import('./allowed-origins')

    expect(getAllowedOrigins()).toContain('https://*.trycloudflare.com')
    expect(isAllowedOrigin('https://nottingham-beans-seeing-accessed.trycloudflare.com')).toBe(true)
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false)
  })

  it('does not trust TryCloudflare when disabled', async () => {
    const { isAllowedOrigin } = await import('./allowed-origins')
    expect(isAllowedOrigin('https://nottingham-beans-seeing-accessed.trycloudflare.com')).toBe(false)
  })
})
