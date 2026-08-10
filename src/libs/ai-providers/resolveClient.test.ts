import { describe, expect, it } from 'vitest'

import { resolveOptionalBaseURL, validateBaseURL } from './resolveClient'

describe('validateBaseURL', () => {
  it('accepts valid public HTTPS URLs', () => {
    expect(validateBaseURL('https://api.openai.com/v1')).toBe('https://api.openai.com/v1')
    expect(validateBaseURL('https://api.deepseek.com')).toBe('https://api.deepseek.com')
  })

  it('accepts valid public HTTP URLs', () => {
    expect(validateBaseURL('http://example.com/v1')).toBe('http://example.com/v1')
  })

  it('rejects localhost', () => {
    expect(() => validateBaseURL('http://localhost:3000')).toThrow('not allowed')
    expect(() => validateBaseURL('http://localhost')).toThrow('not allowed')
  })

  it('rejects 127.0.0.1', () => {
    expect(() => validateBaseURL('http://127.0.0.1:3000')).toThrow('not allowed')
  })

  it('rejects 10.x private IPs', () => {
    expect(() => validateBaseURL('http://10.0.0.1')).toThrow('not allowed')
  })

  it('rejects 172.16-31 private IPs', () => {
    expect(() => validateBaseURL('http://172.16.0.1')).toThrow('not allowed')
    expect(() => validateBaseURL('http://172.31.0.1')).toThrow('not allowed')
  })

  it('allows 172.32.x (not private)', () => {
    expect(validateBaseURL('http://172.32.0.1')).toBe('http://172.32.0.1')
  })

  it('rejects 192.168.x private IPs', () => {
    expect(() => validateBaseURL('http://192.168.1.1')).toThrow('not allowed')
  })

  it('rejects link-local 169.254.x', () => {
    expect(() => validateBaseURL('http://169.254.169.254')).toThrow('not allowed')
  })

  it('rejects IPv6 loopback', () => {
    expect(() => validateBaseURL('http://[::1]')).toThrow('not allowed')
  })

  it('rejects non-http(s) protocols', () => {
    expect(() => validateBaseURL('file:///etc/passwd')).toThrow('http or https')
    expect(() => validateBaseURL('ftp://example.com')).toThrow('http or https')
  })

  it('rejects malformed URLs', () => {
    expect(() => validateBaseURL('not-a-url')).toThrow('Invalid baseURL')
  })
})

describe('resolveOptionalBaseURL', () => {
  it('returns undefined for undefined input', () => {
    expect(resolveOptionalBaseURL(undefined)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(resolveOptionalBaseURL('')).toBeUndefined()
  })

  it('returns undefined for whitespace-only string', () => {
    expect(resolveOptionalBaseURL('   ')).toBeUndefined()
  })

  it('returns validated URL for valid public URL', () => {
    expect(resolveOptionalBaseURL('https://api.openai.com/v1')).toBe('https://api.openai.com/v1')
  })

  it('trims whitespace before validating', () => {
    expect(resolveOptionalBaseURL('  https://api.openai.com/v1  ')).toBe('https://api.openai.com/v1')
  })

  it('rejects private URL', () => {
    expect(() => resolveOptionalBaseURL('http://localhost:3000')).toThrow('not allowed')
  })
})
