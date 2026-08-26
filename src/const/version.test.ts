import { describe, expect, it } from 'vitest'

import { CURRENT_VERSION, extractSpaBuildTime } from './version'

describe('extractSpaBuildTime', () => {
  it('returns the meta content when present', () => {
    expect(extractSpaBuildTime('<meta name="buildTime" content="2026-01-01T00:00:00.000Z" />')).toBe(
      '2026-01-01T00:00:00.000Z'
    )
  })

  it('returns null when the meta tag is missing', () => {
    expect(extractSpaBuildTime('<html><head></head></html>')).toBeNull()
  })

  it('returns null when content is empty', () => {
    expect(extractSpaBuildTime('<meta name="buildTime" content="" />')).toBeNull()
  })
})

describe('CURRENT_VERSION', () => {
  it('is a non-empty semver-like string', () => {
    expect(CURRENT_VERSION).toMatch(/\d+\.\d+\.\d+/)
  })
})
