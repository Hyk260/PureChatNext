import { describe, expect, it } from 'vitest'

import { safeFileName } from './safeFileName'

describe('safeFileName', () => {
  it('removes path segments and control characters', () => {
    expect(safeFileName('../\\secret\u0000.txt')).toBe('secret.txt')
  })

  it('uses a fallback for empty names', () => {
    expect(safeFileName('  ', 'attachment')).toBe('attachment')
  })
})
