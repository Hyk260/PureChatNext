import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QQApiClient } from '../api'

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })

describe('QQApiClient retry behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('retries rate limits using Retry-After', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response('rate limited', { headers: { 'retry-after': '0' }, status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ id: 'message-1', timestamp: '2026-09-03T00:00:00.000Z' }))

    const response = await new QQApiClient('app-id', 'secret').sendC2CMessage('user-id', 'hello')

    expect(response.id).toBe('message-1')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('returns the final server error after retry attempts', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ access_token: 'token', expires_in: 3600 }))
      .mockImplementation(async () => new Response('unavailable', { status: 503 }))

    await expect(new QQApiClient('app-id', 'secret').sendC2CMessage('user-id', 'hello')).rejects.toThrow(
      'QQ API POST /v2/users/user-id/messages failed: 503'
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
