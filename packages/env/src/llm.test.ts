import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getLLMConfig } from './llm'

beforeEach(() => {
  vi.stubEnv('PURECHAT_ENABLED', undefined)
  vi.stubEnv('AI_GATEWAY_API_KEY', undefined)
  vi.stubEnv('AI_GATEWAY_BASE_URL', undefined)
})

afterEach(() => vi.unstubAllEnvs())

describe('AI Gateway configuration', () => {
  it('keeps PureChat disabled by default even when a Gateway key is configured', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', 'gateway-key')
    const config = getLLMConfig()
    expect(config.PURECHAT_ENABLED).toBe(false)
    expect(config.AI_GATEWAY_API_KEY).toBe('gateway-key')
    expect(config.AI_GATEWAY_BASE_URL).toBe('https://ai-gateway.vercel.sh/v1')
  })

  it.each(['1', 'true', 'TRUE'])('only enables PureChat with explicit %s', (value) => {
    vi.stubEnv('PURECHAT_ENABLED', value)
    expect(getLLMConfig().PURECHAT_ENABLED).toBe(true)
  })

  it.each(['', '0', 'false', 'invalid'])('keeps PureChat disabled for %s', (value) => {
    vi.stubEnv('PURECHAT_ENABLED', value)
    expect(getLLMConfig().PURECHAT_ENABLED).toBe(false)
  })

  it('does not accept the removed API key alias', () => {
    vi.stubEnv('PURECHAT_API_KEY', 'legacy-key')
    vi.stubEnv('PURECHAT_ENABLED', '1')
    const config = getLLMConfig()
    expect(config.AI_GATEWAY_API_KEY).toBeUndefined()
    expect('PURECHAT_API_KEY' in config).toBe(false)
  })

  it('normalizes the API key and base URL at the configuration boundary', () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '  gateway-key  ')
    vi.stubEnv('AI_GATEWAY_BASE_URL', '  https://gateway.example/v1  ')
    expect(getLLMConfig().AI_GATEWAY_API_KEY).toBe('gateway-key')
    expect(getLLMConfig().AI_GATEWAY_BASE_URL).toBe('https://gateway.example/v1')
    vi.stubEnv('AI_GATEWAY_API_KEY', '   ')
    vi.stubEnv('AI_GATEWAY_BASE_URL', '   ')
    expect(getLLMConfig().AI_GATEWAY_API_KEY).toBeUndefined()
    expect(getLLMConfig().AI_GATEWAY_BASE_URL).toBe('https://ai-gateway.vercel.sh/v1')
  })
})
