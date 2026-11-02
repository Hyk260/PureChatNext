import { describe, expect, it } from 'vitest'

import { isObjectLike, isRecord, matchesShape, toTrimmedString } from '../object'

describe('object helpers', () => {
  it('checks fields without coercion or changing object-like semantics', () => {
    const isProject = matchesShape({
      id: (value: unknown): value is string => typeof value === 'string',
      createdAt: (value: unknown): value is number => typeof value === 'number',
    })
    for (const value of [null, undefined, 0, 'project', () => ({}), {}, { id: 'a', createdAt: '1' }]) {
      expect(isProject(value)).toBe(false)
    }
    for (const createdAt of [0, -1, NaN, Infinity]) {
      const project: unknown = { id: 'a', createdAt, extra: true }
      expect(isProject(project)).toBe(true)
      if (isProject(project)) expect(project.id.toUpperCase()).toBe('A')
    }
    expect(isProject(Object.assign([], { id: 'a', createdAt: 0 }))).toBe(true)
    expect(isProject(Object.create({ id: 'a', createdAt: 0 }))).toBe(true)
  })

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
