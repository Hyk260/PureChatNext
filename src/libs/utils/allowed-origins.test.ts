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

  it('trusts Electron renderer origins', async () => {
    const { isAllowedOrigin } = await import('./allowed-origins')

    expect(isAllowedOrigin('http://localhost:5176')).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:5176')).toBe(true)
    expect(isAllowedOrigin('purechat://renderer')).toBe(true)
  })

  it('treats APP_URL as an allowed origin when ALLOWED_ORIGINS is omitted', async () => {
    mocks.appEnv.APP_URL = 'http://localhost:3210'
    const { getAllowedOrigins, isAllowedOrigin } = await import('./allowed-origins')

    expect(getAllowedOrigins()).toContain('http://localhost:3210')
    expect(isAllowedOrigin('http://localhost:3210')).toBe(true)
  })

  it('merges extra ALLOWED_ORIGINS without replacing APP_URL', async () => {
    mocks.appEnv.APP_URL = 'https://chat.example.com'
    mocks.appEnv.ALLOWED_ORIGINS = 'https://www.example.com'
    const { getAllowedOrigins, isAllowedOrigin } = await import('./allowed-origins')

    expect(isAllowedOrigin('https://chat.example.com')).toBe(true)
    expect(isAllowedOrigin('https://www.example.com')).toBe(true)
    expect(getAllowedOrigins()).toEqual(
      expect.arrayContaining(['https://chat.example.com', 'https://www.example.com'])
    )
  })
})
