import { describe, expect, it } from 'vitest'

import { LOGIN_USERNAME_REGEX } from './login-identifier'
import { allocateUniqueUsername, sanitizeUsername } from './unique-username'

const taken = (...names: string[]) => {
  const set = new Set(names)
  return async (username: string) => set.has(username)
}

describe('sanitizeUsername', () => {
  it('keeps a valid email local part', () => {
    expect(sanitizeUsername('test')).toBe('test')
  })

  it('replaces dots and plus with underscores', () => {
    expect(sanitizeUsername('john.doe')).toBe('john_doe')
    expect(sanitizeUsername('test+tag')).toBe('test_tag')
  })

  it('returns null for empty or non-latin names', () => {
    expect(sanitizeUsername('')).toBeNull()
    expect(sanitizeUsername('张三')).toBeNull()
    expect(sanitizeUsername('   ')).toBeNull()
  })
})

describe('allocateUniqueUsername', () => {
  it('returns the preferred name when it is free', async () => {
    await expect(allocateUniqueUsername('test', taken())).resolves.toBe('test')
  })

  it('appends a suffix when the preferred name is taken', async () => {
    await expect(allocateUniqueUsername('test', taken('test'), () => 'a1b2')).resolves.toBe('test_a1b2')
  })

  it('does not squat the generic user name for unsanitizable input', async () => {
    await expect(allocateUniqueUsername('张三', taken(), () => 'x7k2')).resolves.toBe('user_x7k2')
  })

  it('retries when the suffixed name is also taken', async () => {
    const suffixes = ['aaaa', 'bbbb']
    await expect(
      allocateUniqueUsername('test', taken('test', 'test_aaaa'), () => suffixes.shift() ?? 'zzzz')
    ).resolves.toBe('test_bbbb')
  })

  it('always returns a login-safe username', async () => {
    const username = await allocateUniqueUsername('john.doe+tag', taken())
    expect(username).toMatch(LOGIN_USERNAME_REGEX)
  })
})
