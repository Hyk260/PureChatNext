import { describe, expect, it, vi } from 'vitest'

import { apiFetch } from './apiFetch'

describe('apiFetch', () => {
  it('rejects absolute URLs', () => {
    expect(() => {
      void apiFetch('http://localhost:3000/api/chat')
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
})
