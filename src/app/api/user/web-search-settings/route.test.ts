// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), delete: vi.fn(), authenticated: true }))
vi.mock('@pure/database/models/webSearchSettings', () => ({
  WebSearchSettingsModel: class {
    get = mocks.get
    patch = mocks.patch
    delete = mocks.delete
  },
}))
vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (error: string, status = 400) => Response.json({ error }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      mocks.authenticated
        ? handler(request, { userId: 'owner' })
        : Response.json({ error: 'Unauthorized' }, { status: 401 }),
}))
vi.mock('@/server/search/userSettings', () => ({
  serverWebSearchConfig: () => ({
    searchProviders: ['exa'],
    fetchProviders: ['naive'],
    providers: { exa: { hasApiKey: true } },
  }),
}))

import { DELETE, GET, PATCH } from './route'

const request = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/user/web-search-settings', {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: { 'Content-Type': 'application/json' },
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authenticated = true
  mocks.get.mockResolvedValue({})
  mocks.patch.mockResolvedValue({ maxResults: 7 })
})

describe('account network search API', () => {
  it('requires authentication and uses the server account identity', async () => {
    mocks.authenticated = false
    expect((await GET(request('GET'))).status).toBe(401)
    expect(mocks.get).not.toHaveBeenCalled()
    mocks.authenticated = true
    const response = await GET(request('GET'))
    expect(mocks.get).toHaveBeenCalledWith('owner')
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toMatchObject({
      settings: {},
      server: { providers: { exa: { hasApiKey: true } } },
    })
    expect((await PATCH(request('PATCH', { userId: 'victim', maxResults: 7 }))).status).toBe(400)
  })

  it('validates patches and keeps vault errors out of responses', async () => {
    expect((await PATCH(request('PATCH', { blacklist: ['/[/'] }))).status).toBe(400)
    expect(mocks.patch).not.toHaveBeenCalled()
    expect((await PATCH(request('PATCH', { maxResults: 7, searchProvider: null }))).status).toBe(200)
    expect(mocks.patch).toHaveBeenCalledWith('owner', { maxResults: 7, searchProvider: null })
    mocks.patch.mockRejectedValueOnce(new Error('secret database-password'))
    const response = await PATCH(request('PATCH', { maxResults: 7 }))
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('database-password')
  })

  it('resets only the authenticated owner settings', async () => {
    expect((await DELETE(request('DELETE'))).status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith('owner')
  })
})
