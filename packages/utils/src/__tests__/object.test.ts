import { describe, expect, it } from 'vitest'

import { isRecord, toTrimmedString } from '../object'

describe('object helpers', () => {
  it.each([
    [{ key: 'value' }, true],
    [[], false],
    [null, false],
    ['value', false],
    [42, false],
  ])('identifies records: %j -> %s', (value, expected) => {
    expect(isRecord(value)).toBe(expected)
  })

  it.each([
    [' value ', 'value'],
    ['', undefined],
    ['   ', undefined],
    [42, undefined],
    [null, undefined],
  ])('normalizes strings: %j -> %j', (value, expected) => {
    expect(toTrimmedString(value)).toBe(expected)
  })
})
