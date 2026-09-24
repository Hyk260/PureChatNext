import { beforeEach, describe, expect, it, vi } from 'vitest'

import { QQApiClient, chunkQQText, QQ_MAX_TEXT_LENGTH } from '../api'

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...headers },
    status,
  })

describe('chunkQQText', () => {
  it('returns a single chunk for short text', () => {
    expect(chunkQQText('hello')).toEqual(['hello'])
  })

  it('splits long text by the platform limit', () => {
    const text = 'a'.repeat(QQ_MAX_TEXT_LENGTH * 2 + 10)
    expect(chunkQQText(text)).toEqual([
      'a'.repeat(QQ_MAX_TEXT_LENGTH),
      'a'.repeat(QQ_MAX_TEXT_LENGTH),
      'a'.repeat(10),
    ])
  })

  it('clamps non-positive limits to avoid infinite loops', () => {
    expect(chunkQQText('abcd', 0)).toEqual(['a', 'b', 'c', 'd'])
    expect(chunkQQText('abcd', -2)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not split UTF-16 surrogate pairs at chunk boundaries', () => {
    const emoji = '😀' // 2 UTF-16 code units
    const text = `${'a'.repeat(3)}${emoji}${'b'.repeat(3)}`
    const chunks = chunkQQText(text, 4)
    expect(chunks.join('')).toBe(text)
    for (const chunk of chunks) {
      expect(chunk).not.toMatch(/[\uD800-\uDBFF]$/)
      expect(chunk).not.toMatch(/^[\uDC00-\uDFFF]/)
    }
  })

  it('prefers breaking at Chinese sentence punctuation', () => {
    const text = `${'甲'.repeat(8)}。${'乙'.repeat(8)}`
    const chunks = chunkQQText(text, 10)
    expect(chunks.join('')).toBe(text)
    expect(chunks[0]?.endsWith('。')).toBe(true)
    expect(chunks[1]?.startsWith('乙')).toBe(true)
  })

  it('avoids cutting inside a phrase when a prior sentence break fits', () => {
    // 硬切会在「言|语与」断开；有句号时应在「。」后断开，下一段以「言语与」开头
    const text = `${'前'.repeat(7)}。言语与${'后'.repeat(8)}`
    const chunks = chunkQQText(text, 10)
    expect(chunks.join('')).toBe(text)
    expect(chunks[0]?.endsWith('。')).toBe(true)
    expect(chunks[1]?.startsWith('言语与')).toBe(true)
  })
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
