import { afterEach, describe, expect, it, vi } from 'vitest'

describe('GET /api/providers/config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns boolean flags without leaking secrets', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-secret')
    vi.stubEnv('DEEPSEEK_API_KEY', '')

    const { GET } = await import('./route')
    const response = await GET()
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json).toEqual({
      envKeys: {
        deepseek: false,
        openai: true,
      },
    })
    expect(JSON.stringify(json)).not.toContain('sk-secret')
  })
})
