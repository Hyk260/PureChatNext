import { describe, expect, it } from 'vitest'

import {
  getLmStudioModelsEndpoint,
  getLmStudioNativeModelsEndpoint,
  normalizeLmStudioBaseURL,
} from './lmstudio'

describe('LM Studio endpoint helpers', () => {
  it('normalizes HTTP(S) endpoints to a single v1 suffix', () => {
    expect(normalizeLmStudioBaseURL('http://localhost:1234')).toBe('http://localhost:1234/v1')
    expect(normalizeLmStudioBaseURL('http://127.0.0.1:1234/v1/v1/')).toBe('http://127.0.0.1:1234/v1')
    expect(getLmStudioModelsEndpoint('http://localhost:1234')).toBe('http://localhost:1234/v1/models')
    expect(getLmStudioNativeModelsEndpoint('http://localhost:1234/v1')).toBe('http://localhost:1234/api/v1/models')
    expect(normalizeLmStudioBaseURL('https://api.example.com/proxy/v1')).toBe('https://api.example.com/proxy/v1')
    expect(normalizeLmStudioBaseURL('http://192.168.1.10:1234')).toBe('http://192.168.1.10:1234/v1')
  })

  it('requires an explicit HTTP(S) protocol and rejects credentials and URL parameters', () => {
    for (const address of [
      'localhost:1234',
      'file:///tmp/lmstudio',
      'http://user:pass@localhost:1234',
      'http://localhost:1234?token=secret',
      'http://localhost:1234/#fragment',
    ]) {
      expect(() => normalizeLmStudioBaseURL(address)).toThrow()
    }
  })
})
