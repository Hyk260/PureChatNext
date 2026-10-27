import { describe, expect, it } from 'vitest'

import { getErrorMessage } from '../error'

describe('getErrorMessage', () => {
  it('preserves Error messages, including empty messages', () => {
    expect(getErrorMessage(new Error('detail'), 'fallback')).toBe('detail')
    expect(getErrorMessage(new Error(''), 'fallback')).toBe('')
  })

  it.each([null, undefined, 'detail', 0, { message: 'detail' }])('uses the caller fallback for %j', (value) => {
    expect(getErrorMessage(value, 'fallback')).toBe('fallback')
  })
})
