import { describe, expect, it } from 'vitest'

import { getCommunityPageData } from '../pagination'

describe('getCommunityPageData', () => {
  const data = ['a', 'b', 'c', 'd', 'e']

  it('returns the first page and total page count', () => {
    expect(getCommunityPageData(data, 1, 2)).toEqual({
      currentPage: 1,
      pageData: ['a', 'b'],
      totalPages: 3,
    })
  })

  it('clamps negative and out-of-range pages', () => {
    expect(getCommunityPageData(data, -1, 2).currentPage).toBe(1)
    expect(getCommunityPageData(data, 99, 2)).toMatchObject({
      currentPage: 3,
      pageData: ['e'],
    })
  })

  it('handles empty collections and invalid page values', () => {
    expect(getCommunityPageData([], Number.NaN, 2)).toEqual({
      currentPage: 1,
      pageData: [],
      totalPages: 1,
    })
    expect(getCommunityPageData(data, 2.9, 2).currentPage).toBe(2)
  })
})
