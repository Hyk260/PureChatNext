import { describe, expect, it } from 'vitest'

import {
  TRYCLOUDFLARE_ALLOWED_HOST,
  TRYCLOUDFLARE_TRUSTED_ORIGIN,
  isTryCloudflareAllowed,
  resolveTryCloudflareAllowedHosts,
  resolveTryCloudflareTrustedOrigins,
} from './dev-tunnel'

describe('dev-tunnel', () => {
  it('parses ALLOW_TRYCLOUDFLARE and exposes shared host/origin', () => {
    expect(isTryCloudflareAllowed('1')).toBe(true)
    expect(isTryCloudflareAllowed('true')).toBe(true)
    expect(isTryCloudflareAllowed(undefined)).toBe(false)
    expect(resolveTryCloudflareAllowedHosts('1')).toEqual([TRYCLOUDFLARE_ALLOWED_HOST])
    expect(resolveTryCloudflareTrustedOrigins('1')).toEqual([TRYCLOUDFLARE_TRUSTED_ORIGIN])
    expect(resolveTryCloudflareAllowedHosts()).toBeUndefined()
    expect(resolveTryCloudflareTrustedOrigins()).toEqual([])
  })
})
