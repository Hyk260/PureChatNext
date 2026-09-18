// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from './route'

const pngBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
const source = 'https://github.com/openclaw.png'
const avatarCdn = 'https://avatars.githubusercontent.com/openclaw'
const wsrv = 'https://wsrv.nl/?url=github.com%2Fopenclaw.png'
const requestUrl = `http://localhost/api/proxy/github-asset?url=${encodeURIComponent(source)}`

const jsonError = async (response: Response) => (await response.json()) as { error: string }

const responseWithUrl = (body: BodyInit, init: ResponseInit, url: string) => {
  const response = new Response(body, init)
  Object.defineProperty(response, 'url', { value: url })
  return response
}

describe('GET /api/proxy/github-asset', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns 400 when url is missing or not a GitHub image', async () => {
    const missing = await GET(new Request('http://localhost/api/proxy/github-asset'))
    expect(missing.status).toBe(400)
    expect(await jsonError(missing)).toEqual({ error: 'Missing url' })

    const invalid = await GET(
      new Request(
        `http://localhost/api/proxy/github-asset?url=${encodeURIComponent('https://github.com/openclaw/skills')}`
      )
    )
    expect(invalid.status).toBe(400)
    expect(await jsonError(invalid)).toEqual({ error: 'Invalid GitHub asset url' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('proxies a GitHub avatar and caches the image', async () => {
    const fetchMock = vi.mocked(fetch).mockImplementation(async () =>
      responseWithUrl(
        pngBytes,
        { headers: { 'Content-Type': 'image/png' }, status: 200 },
        'https://avatars.githubusercontent.com/u/1?v=4'
      )
    )

    const response = await GET(new Request(requestUrl))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/png')
    expect(response.headers.get('Cache-Control')).toContain('max-age=86400')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes)
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(expect.arrayContaining([avatarCdn, wsrv, source]))
  })

  it('rejects a redirect off GitHub and non-image payloads', async () => {
    vi.mocked(fetch).mockImplementation(async () =>
      responseWithUrl('x', { headers: { 'Content-Type': 'image/png' }, status: 200 }, 'https://evil.example/x.png')
    )

    const redirected = await GET(new Request(requestUrl))
    expect(redirected.status).toBe(502)
    expect(await jsonError(redirected)).toEqual({ error: 'Invalid redirect' })

    vi.mocked(fetch).mockImplementation(async () =>
      responseWithUrl(
        '<html></html>',
        { headers: { 'Content-Type': 'text/html' }, status: 200 },
        'https://github.com/openclaw.png'
      )
    )

    const html = await GET(new Request(requestUrl))
    expect(html.status).toBe(502)
    expect(await jsonError(html)).toEqual({ error: 'Not an image' })
  })
})
