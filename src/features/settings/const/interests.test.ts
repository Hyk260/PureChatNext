import { describe, expect, it } from 'vitest'

import {
  normalizeInterestsForStorage,
  resolveInterestAreaKey,
} from './interests'

describe('normalizeInterestsForStorage', () => {
  it('keeps known interest keys and dedupes them', () => {
    expect(normalizeInterestsForStorage(['coding', 'coding', 'writing'])).toEqual([
      'coding',
      'writing',
    ])
  })

  it('keeps custom free-form interests', () => {
    expect(normalizeInterestsForStorage(['coding', '我的爱好'])).toEqual(['coding', '我的爱好'])
  })

  it('trims empty values', () => {
    expect(normalizeInterestsForStorage(['  ', 'design', ''])).toEqual(['design'])
  })
})

describe('resolveInterestAreaKey', () => {
  it('resolves known keys', () => {
    expect(resolveInterestAreaKey('coding')).toBe('coding')
  })

  it('returns undefined for custom text', () => {
    expect(resolveInterestAreaKey('自定义')).toBeUndefined()
  })
})
