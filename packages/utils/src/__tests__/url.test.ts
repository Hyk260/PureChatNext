import { describe, expect, it } from 'vitest'

import { isProviderHttpUrl } from '../url'

describe('isProviderHttpUrl', () => {
  it.each(['https://api.example/v1', 'http://localhost:3000/path', 'https://[::1]/'])('accepts %s', (value) => {
    expect(isProviderHttpUrl(value)).toBe(true)
  })

  it.each([
    '',
    '/api',
    'invalid',
    'ftp://example.com',
    'https://user:pass@example.com',
    'https://example.com?q=1',
    'https://example.com#part',
  ])('rejects %s', (value) => {
    expect(isProviderHttpUrl(value)).toBe(false)
  })
})
