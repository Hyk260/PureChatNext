// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getFileConfig } from './file'

describe('file storage limit environment', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('defaults to 15 MB', () => {
    vi.stubEnv('FILE_STORAGE_LIMIT_MB', '')
    expect(getFileConfig().FILE_STORAGE_LIMIT_MB).toBe(15)
  })

  it('accepts a positive integer override', () => {
    vi.stubEnv('FILE_STORAGE_LIMIT_MB', '64')
    expect(getFileConfig().FILE_STORAGE_LIMIT_MB).toBe(64)
  })

  it.each(['0', '-1', '1.5', 'invalid'])('rejects invalid value %s', (value) => {
    vi.stubEnv('FILE_STORAGE_LIMIT_MB', value)
    expect(() => getFileConfig()).toThrow()
  })
})
