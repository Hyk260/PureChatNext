import { describe, expect, it, vi } from 'vitest'

import { apiFetch, jsonInit } from './apiFetch'

describe('apiFetch', () => {
  it('rejects absolute URLs', () => {
    expect(() => {
      apiFetch('http://localhost:3000/api/chat')
    }).toThrow(/relative/)
  })

  it('defaults credentials to include', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/api/agents')

    expect(fetchMock).toHaveBeenCalledWith('/api/agents', {
      credentials: 'include',
    })

    vi.unstubAllGlobals()
  })

  it('jsonInit stringifies body and sets Content-Type', () => {
    const init = jsonInit({ a: 1 }, { method: 'POST' })
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.method).toBe('POST')
  })

  it('jsonInit merges caller headers over default Content-Type', () => {
    const init = jsonInit({ a: 1 }, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer x', 'Content-Type': 'text/plain' },
    })
    expect(init.headers).toEqual({ Authorization: 'Bearer x', 'Content-Type': 'text/plain' })
    expect(init.method).toBe('PATCH')
  })

  it('jsonInit preserves signal and credentials passthrough', () => {
    const controller = new AbortController()
    const init = jsonInit({}, { method: 'POST', signal: controller.signal })
    expect(init.signal).toBe(controller.signal)
  })
})
