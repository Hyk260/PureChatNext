import { describe, expect, it } from 'vitest'

import { SEARCH_TIME_RANGE_DAYS, getSearchTimeRangeDays } from './timeRange'

describe('search time range', () => {
  it('exposes the shared day mapping', () => {
    expect(SEARCH_TIME_RANGE_DAYS).toEqual({ day: 1, month: 30, week: 7, year: 365 })
  })

  it.each([
    ['day', 1],
    ['week', 7],
    ['month', 30],
    ['year', 365],
  ])('maps %s to %s days', (value, expected) => {
    expect(getSearchTimeRangeDays(value)).toBe(expected)
  })

  it.each([undefined, '', 'anytime', 'unknown'])('returns undefined for %j', (value) => {
    expect(getSearchTimeRangeDays(value)).toBeUndefined()
  })
})
