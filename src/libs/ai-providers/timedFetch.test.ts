// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ ssrfSafeFetch: vi.fn() }))

vi.mock('@pure/ssrf-safe-fetch', () => ({ ssrfSafeFetch: mocks.ssrfSafeFetch }))

import { createTimedFetch } from './timedFetch'

describe('provider fetch transport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ssrfSafeFetch.mockResolvedValue(new Response('ok'))
  })

  it('delegates private network targets to the connection-filtered transport and disables redirects', async () => {
    await createTimedFetch()('http://127.0.0.1:8080/admin', { method: 'GET' })

    expect(mocks.ssrfSafeFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/admin',
      expect.objectContaining({ method: 'GET', redirect: 'error' }),
      { streamResponse: true }
    )
  })

  it.each(['file:///etc/passwd', 'https://user:pass@example.com/v1', 'https://example.com/#token'])(
    'rejects malformed provider target %s before network access',
    async (url) => {
      await expect(createTimedFetch()(url)).rejects.toThrow('Invalid provider URL')
      expect(mocks.ssrfSafeFetch).not.toHaveBeenCalled()
    }
  )
})
