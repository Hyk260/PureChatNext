import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearTokens, saveTokens } from './api-client'

describe('api-client token storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not throw when browser storage is unavailable', () => {
    const unavailableStorage = {
      getItem: () => {
        throw new Error('storage unavailable')
      },
      removeItem: () => {
        throw new Error('storage unavailable')
      },
      setItem: () => {
        throw new Error('quota exceeded')
      },
    } as unknown as Storage
    vi.stubGlobal('window', { localStorage: unavailableStorage })

    expect(() => saveTokens('access', 'refresh')).not.toThrow()
    expect(() => clearTokens()).not.toThrow()
  })
})
