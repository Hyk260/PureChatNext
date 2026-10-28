// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { USER_ROLE } from '@pure/const'

const mocks = vi.hoisted(() => ({
  findByUserAndPlatform: vi.fn(),
  findById: vi.fn(),
  getSession: vi.fn(),
  requeueFailed: vi.fn(),
}))

vi.mock('next/headers', () => ({ headers: () => new Headers({ cookie: 'session=test' }) }))
vi.mock('@/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('@/libs/auth/touch-last-active', () => ({ touchUserLastActive: vi.fn() }))
vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findById = mocks.findById
  },
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
  },
  WECHAT_PLATFORM: 'wechat',
}))
vi.mock('@pure/database/models/channelEvent', () => ({
  ChannelEventModel: class {
    requeueFailed = mocks.requeueFailed
  },
}))

import { POST } from './route'

describe('POST /api/channels/wechat/events/retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-a' } })
    mocks.findById.mockResolvedValue({ id: 'user-a', role: USER_ROLE.User })
    mocks.findByUserAndPlatform.mockResolvedValue({ id: 'binding-a' })
    mocks.requeueFailed.mockResolvedValue(2)
  })

  it('rejects ordinary users before requeueing events', async () => {
    const response = await POST(new NextRequest('http://localhost/api/channels/wechat/events/retry', { method: 'POST' }))

    expect(response.status).toBe(403)
    expect(mocks.requeueFailed).not.toHaveBeenCalled()
  })

  it('keeps the administrator retry action scoped to that administrator binding', async () => {
    mocks.findById.mockResolvedValueOnce({ id: 'user-a', role: USER_ROLE.Admin })
    const response = await POST(new NextRequest('http://localhost/api/channels/wechat/events/retry', { method: 'POST' }))

    expect(response.status).toBe(200)
    expect(mocks.findByUserAndPlatform).toHaveBeenCalledWith('user-a', 'wechat')
    expect(mocks.requeueFailed).toHaveBeenCalledExactlyOnceWith('binding-a', 100)
  })
})
