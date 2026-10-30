// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  setEnabled: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))
vi.mock('@pure/database/models/userProviderSettings', () => ({
  UserProviderSettingsModel: class {
    list = mocks.list
    setEnabled = mocks.setEnabled
  },
}))

import { GET, PUT } from './route'

const request = (method: string, body?: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/providers/enabled', {
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
    method,
  })

describe('/api/providers/enabled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue({ deepseek: true })
    mocks.setEnabled.mockResolvedValue({ deepseek: true, openai: false })
  })

  it('returns only the current account’s provider state', async () => {
    const response = await GET(request('GET'))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ items: { deepseek: true } })
    expect(mocks.list).toHaveBeenCalledWith('user-1')
  })

  it('saves a built-in provider state for the current account', async () => {
    const response = await PUT(request('PUT', { enabled: false, provider: 'openai' }))

    expect(response.status).toBe(200)
    expect(mocks.setEnabled).toHaveBeenCalledWith('user-1', 'openai', false)
    await expect(response.json()).resolves.toEqual({ items: { deepseek: true, openai: false } })
  })

  it('rejects custom providers because their enabled state is stored with their definition', async () => {
    const response = await PUT(request('PUT', { enabled: true, provider: 'my-provider' }))

    expect(response.status).toBe(400)
    expect(mocks.setEnabled).not.toHaveBeenCalled()
  })

  it('keeps the server-managed PureChat provider enabled', async () => {
    const response = await PUT(request('PUT', { enabled: false, provider: 'purechat' }))

    expect(response.status).toBe(400)
    expect(mocks.setEnabled).not.toHaveBeenCalled()
  })
})
