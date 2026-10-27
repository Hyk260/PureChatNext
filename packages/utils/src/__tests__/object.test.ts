import { describe, expect, it } from 'vitest'

import { isObjectLike, isRecord, toTrimmedString } from '../object'

describe('object helpers', () => {
  it('keeps array-compatible guards distinct from records', () => {
    expect(isObjectLike([])).toBe(true)
    expect(isRecord([])).toBe(false)
    expect(isObjectLike(new Date())).toBe(true)
    expect(isObjectLike(null)).toBe(false)
    expect(isObjectLike(() => ({}))).toBe(false)
  })

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
