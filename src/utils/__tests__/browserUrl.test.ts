import { describe, expect, it } from 'vitest'

import { isBrowserUrl, normalizeBrowserUrl } from '../browserUrl'

describe('browser URLs', () => {
  it.each([
    ['', 'about:blank'],
    ['example.com/a', 'https://example.com/a'],
    ['example.com:8080/a', 'https://example.com:8080/a'],
    ['localhost:3000/a', 'http://localhost:3000/a'],
    ['127.0.0.1:5174', 'http://127.0.0.1:5174/'],
    ['[::1]:3000', 'http://[::1]:3000/'],
    ['中文 搜索', 'https://www.bing.com/search?q=%E4%B8%AD%E6%96%87%20%E6%90%9C%E7%B4%A2'],
  ])('normalizes %s', (input, expected) => expect(normalizeBrowserUrl(input)).toBe(expected))

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///etc/passwd',
    'purechat://renderer',
    'https://user:password@example.com',
  ])('rejects %s', (url) => {
    expect(isBrowserUrl(url)).toBe(false)
    expect(() => normalizeBrowserUrl(url)).toThrow()
  })
})
