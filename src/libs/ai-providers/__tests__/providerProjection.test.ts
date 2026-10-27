import { describe, expect, it } from 'vitest'

import { toPublicProvider } from '../providerProjection'

describe('public provider projection', () => {
  it('keeps the public ID and nullable fields while excluding owner and secret data', () => {
    const provider = {
      apiKey: 'private-key',
      baseURL: 'https://api.example/v1',
      description: '',
      enabled: false,
      logo: null,
      name: 'Custom',
      providerId: 'custom',
      userId: 'private-owner',
    }
    const result = toPublicProvider(provider)
    expect(result.id).toBe('custom')
    expect(result.logo).toBeNull()
    expect(result.enabled).toBe(false)
    expect(result).not.toHaveProperty('apiKey')
    expect(result).not.toHaveProperty('userId')
    expect(result).not.toHaveProperty('providerId')
  })
})
