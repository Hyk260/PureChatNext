import { describe, expect, it } from 'vitest'

import { normalizeLoginIdentifier } from './login-identifier'

describe('normalizeLoginIdentifier', () => {
  it('accepts emails and lowercases them', () => {
    expect(normalizeLoginIdentifier('  Foo.Bar+tag@Example.COM ')).toEqual({
      kind: 'email',
      value: 'foo.bar+tag@example.com',
    })
  })

  it('accepts numeric usernames used as login ids', () => {
    expect(normalizeLoginIdentifier('2607881950')).toEqual({
      kind: 'username',
      value: '2607881950',
    })
  })

  it('keeps username casing', () => {
    expect(normalizeLoginIdentifier('PureChat_User')).toEqual({
      kind: 'username',
      value: 'PureChat_User',
    })
  })

  it('rejects invalid emails and usernames', () => {
    expect(normalizeLoginIdentifier('')).toBeNull()
    expect(normalizeLoginIdentifier('not-an-email')).toBeNull()
    expect(normalizeLoginIdentifier('a@b')).toBeNull()
    expect(normalizeLoginIdentifier('user name')).toBeNull()
    expect(normalizeLoginIdentifier('a'.repeat(65))).toBeNull()
  })
})
