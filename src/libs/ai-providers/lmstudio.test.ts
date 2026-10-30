import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkLmStudioConnection, fetchLmStudioModels } from './lmstudio'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LM Studio browser client', () => {
  it('lists models directly and tolerates a missing native metadata endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'model-a' }] })))
      .mockRejectedValueOnce(new TypeError('CORS request failed'))
    vi.stubGlobal('fetch', fetchMock)

    const models = await fetchLmStudioModels({ baseURL: 'https://proxy.example.com/openai/v1' })

    expect(models).toEqual([
      { displayName: 'model-a', id: 'model-a', inputModalities: ['text'], outputModalities: ['text'] },
    ])
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://proxy.example.com/openai/v1/models')
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBeNull()
  })

  it('adds a configured API key to the direct connectivity request', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await checkLmStudioConnection(
      { apiKey: 'lm-key', baseURL: 'https://proxy.example.com/v1' },
      'model-a'
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://proxy.example.com/v1/chat/completions')
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer lm-key')
  })

  it('preserves upstream connectivity errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('invalid key', { status: 401 })))

    await expect(
      checkLmStudioConnection({ baseURL: 'http://localhost:1234/v1' }, 'model-a')
    ).rejects.toThrow('LM Studio 连接检测失败（401）：invalid key')
  })

  it('shows the LM Studio CORS setting when the browser blocks a request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')))

    const error = await checkLmStudioConnection({ baseURL: 'http://localhost:1234/v1' }, 'model-a').catch(
      (value: unknown) => value
    )

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('开启 Enable CORS，或使用 lms server start --cors')
    expect((error as Error).message).toContain('Failed to fetch')
  })

  it('surfaces CORS failures from the browser model-list request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')))

    await expect(fetchLmStudioModels({ baseURL: 'http://localhost:1234/v1' })).rejects.toThrow(
      '浏览器无法访问 LM Studio：Failed to fetch'
    )
  })
})
