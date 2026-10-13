// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ headers: new Headers(), read: vi.fn(), session: vi.fn(), token: vi.fn(), user: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => mocks.headers }))
vi.mock('@/auth', () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock('@/libs/auth/jwt', () => ({ verifyAccessToken: mocks.token }))
vi.mock('@/libs/auth/touch-last-active', () => ({ touchUserLastActive: vi.fn() }))
vi.mock('@pure/database/models/user', () => ({ UserModel: class { findById = mocks.user; findByUserId = mocks.user } }))
vi.mock('@pure/database/models/channelGatewayLog', () => ({ ChannelGatewayLogModel: class { read = mocks.read } }))
vi.mock('@/server/channel-gateway', () => { throw new Error('Log reads must never initialize a Gateway') })

import { GET } from './route'

const request = new NextRequest('http://localhost/api/channels/qq/logs?userId=another-user')
const context = (platform = 'qq') => ({ params: Promise.resolve({ platform }) })

describe('GET channel logs authentication and isolation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.headers = new Headers()
    mocks.user.mockResolvedValue({ id: 'current-user' })
    mocks.read.mockResolvedValue({ text: 'safe diagnostic', truncated: false })
  })

  it('uses cookie session ownership and ignores a client-supplied user id', async () => {
    mocks.headers.set('cookie', 'session=fixed-test-session')
    mocks.session.mockResolvedValue({ user: { id: 'current-user' } })
    const response = await GET(request, context())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ text: 'safe diagnostic', truncated: false })
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith('current-user', 'qq')
  })

  it('uses verified Bearer ownership for Electron and keeps the platform scope', async () => {
    mocks.headers.set('authorization', 'Bearer test-token')
    mocks.token.mockResolvedValue({ userId: 'external-user-id' })
    const response = await GET(request, context('wechat'))
    expect(response.status).toBe(200)
    expect(mocks.token).toHaveBeenCalledWith('test-token')
    expect(mocks.user).toHaveBeenCalledWith('external-user-id')
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith('current-user', 'wechat')
    expect(mocks.session).not.toHaveBeenCalled()
  })

  it('rejects anonymous users and invalid Bearer tokens without falling back to cookies', async () => {
    mocks.session.mockResolvedValue(null)
    const anonymous = await GET(request, context())
    expect(anonymous.status).toBe(401)
    expect(anonymous.headers.get('cache-control')).toBe('private, no-store')
    mocks.headers.set('authorization', 'Bearer expired')
    mocks.token.mockResolvedValue(null)
    mocks.session.mockResolvedValue({ user: { id: 'current-user' } })
    expect((await GET(request, context())).status).toBe(401)
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('rejects unsupported platforms and returns a safe retryable failure when storage is unavailable', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'current-user' } })
    expect((await GET(request, context('unknown'))).status).toBe(404)
    expect(mocks.read).not.toHaveBeenCalled()
    mocks.read.mockRejectedValue(new Error('database password=secret'))
    const response = await GET(request, context())
    expect(response.status).toBe(503)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).not.toContain('secret')
  })
})
