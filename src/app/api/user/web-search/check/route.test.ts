// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), crawlPages: vi.fn(), create: vi.fn() }))
vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (error: string, status = 400) => Response.json({ error }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'owner' }),
}))
vi.mock('@/server/search/userSettings', () => ({
  loadWebSearchSettings: async () => ({ maxResults: 8 }),
  createUserSearchService: mocks.create,
}))

import { POST } from './route'

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/user/web-search/check', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.create.mockReturnValue({ query: mocks.query, crawlPages: mocks.crawlPages })
})

describe('provider connectivity check', () => {
  it('checks exactly the selected capability with the owner config', async () => {
    mocks.query.mockResolvedValue({ results: [{ url: 'https://example.com' }] })
    const response = await POST(request({ capability: 'search', provider: 'exa' }))
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      provider: 'exa',
      durationMs: expect.any(Number),
    })
    expect(mocks.create).toHaveBeenCalledWith({ maxResults: 8, searchProvider: 'exa' }, 'owner', 'search')
    expect(mocks.crawlPages).not.toHaveBeenCalled()
    expect((await POST(request({ capability: 'fetch', provider: 'google' }))).status).toBe(400)
  })

  it('does not call an empty or failed upstream response successful', async () => {
    mocks.query.mockResolvedValue({ results: [], errorDetail: 'secret upstream key' })
    const response = await POST(request({ capability: 'search', provider: 'exa' }))
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(JSON.stringify(body)).not.toContain('secret upstream key')
    mocks.crawlPages.mockResolvedValue({ results: [{ data: { errorType: 'TimeoutError' } }] })
    await expect((await POST(request({ capability: 'fetch', provider: 'naive' }))).json()).resolves.toMatchObject({
      success: false,
    })
  })
})
