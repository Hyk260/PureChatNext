import { describe, expect, it } from 'vitest'

import { optionalUrlEnv } from './helpers'

describe('optionalUrlEnv', () => {
  const schema = optionalUrlEnv()

  it('treats missing and empty values as undefined', () => {
    expect(schema.parse(undefined)).toBeUndefined()
    expect(schema.parse(null)).toBeUndefined()
    expect(schema.parse('')).toBeUndefined()
  })

  it('accepts local, Docker, and public http(s) URLs', () => {
    expect(schema.parse('http://localhost:8180')).toBe('http://localhost:8180')
    expect(schema.parse('http://searxng:8080')).toBe('http://searxng:8080')
    expect(schema.parse('https://searxng-instance.com')).toBe('https://searxng-instance.com')
  })

  it('rejects values that are not http(s) URLs', () => {
    expect(() => schema.parse('localhost:8180')).toThrow()
    expect(() => schema.parse('ftp://searxng:8080')).toThrow()
    expect(() => schema.parse('not-a-url')).toThrow()
  })
})
