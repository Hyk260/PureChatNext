// @vitest-environment node
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createAppProtocolHandler } from './appProtocol'

describe('packaged app protocol', () => {
  let rendererDir: string
  const upstream = { fetch: async (_input: RequestInfo | URL, _init?: RequestInit) => new Response('upstream') }
  const config = { getRemoteServerUrl: async (): Promise<string | null> => 'https://chat.example.com' }
  const request = (pathname: string, init?: RequestInit) => new Request(`purechat://renderer${pathname}`, init)
  const handle = (req: Request) => createAppProtocolHandler({
    rendererDir, fetch: upstream.fetch, getRemoteServerUrl: config.getRemoteServerUrl,
  })(req)

  beforeEach(async () => {
    rendererDir = await mkdtemp(path.join(os.tmpdir(), 'purechat-protocol-'))
    await mkdir(path.join(rendererDir, 'assets'))
    await writeFile(path.join(rendererDir, 'index.html'), '<html>SPA</html>')
    await writeFile(path.join(rendererDir, 'assets/app.css'), '.flex{display:flex}')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(rendererDir, { recursive: true, force: true })
  })

  it.each(['purechat://renderer-evil/api/auth', 'purechat://renderer:123/api/chat', 'purechat://other/index.html'])('rejects %s before dispatch', async (url) => {
    const fetch = vi.spyOn(upstream, 'fetch')
    const readConfig = vi.spyOn(config, 'getRemoteServerUrl')
    expect((await handle(new Request(url))).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
    expect(readConfig).not.toHaveBeenCalled()
  })

  it('serves SPA routes, CSS and HEAD with correct content types', async () => {
    expect(await (await handle(request('/'))).text()).toBe('<html>SPA</html>')
    expect(await (await handle(request('/auth/signin'))).text()).toBe('<html>SPA</html>')
    const css = await handle(request('/assets/app.css'))
    expect(css.headers.get('content-type')).toBe('text/css; charset=utf-8')
    expect(css.headers.get('x-content-type-options')).toBe('nosniff')
    expect(await css.text()).toContain('display:flex')
    expect(await (await handle(request('/assets/app.css', { method: 'HEAD' }))).text()).toBe('')
  })

  it.each(['/assets/missing.css', '/assets/missing', '/missing.js'])('returns 404 instead of HTML for %s', async (pathname) => {
    expect((await handle(request(pathname))).status).toBe(404)
  })

  it.each(['/%2e%2e%2foutside.txt', '/assets%5c..%5coutside.txt', '/%00'])('rejects unsafe file paths: %s', async (pathname) => {
    expect((await handle(request(pathname))).status).toBe(403)
  })

  it('rejects malformed escapes and static writes', async () => {
    expect((await handle(request('/%ZZ'))).status).toBe(400)
    expect((await handle(request('/index.html', { method: 'POST' }))).status).toBe(405)
  })

  it('preserves API path, body, auth headers, session credentials and cancellation signal', async () => {
    const fetch = vi.spyOn(upstream, 'fetch')
    const req = request('/api/chat?topic=1', {
      method: 'POST', body: '{"message":"hello"}',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-token', origin: 'purechat://renderer' },
    })
    expect(await (await handle(req)).text()).toBe('upstream')
    const [target, init] = fetch.mock.calls[0]
    expect(target).toBe('https://chat.example.com/api/chat?topic=1')
    expect(init).toMatchObject({ method: 'POST', credentials: 'include', signal: req.signal })
    expect(new TextDecoder().decode(init?.body as ArrayBuffer)).toBe('{"message":"hello"}')
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer test-token')
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.has('origin')).toBe(false)
  })

  it('returns a controlled error when the server is missing or unavailable', async () => {
    const readConfig = vi.spyOn(config, 'getRemoteServerUrl').mockResolvedValueOnce(null)
    expect((await handle(request('/api/chat'))).status).toBe(503)
    expect(readConfig).toHaveBeenCalledOnce()
    vi.spyOn(upstream, 'fetch').mockRejectedValue(new Error('sensitive network detail'))
    const response = await handle(request('/api/chat'))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('sensitive')
  })
})
