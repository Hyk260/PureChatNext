// @vitest-environment node
import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { USER_ROLE } from '@pure/const'

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  getSession: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock('@/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findById = mocks.findById
  },
}))

import { withAdmin } from './get-session-user'
import type { AuthRouteContext } from './get-session-user'

const handler = vi.fn(async (_request: NextRequest, _context: AuthRouteContext) => NextResponse.json({ ok: true }))

describe('withAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when there is no session', async () => {
    mocks.getSession.mockResolvedValue(null)

    const response = await withAdmin(handler)(new NextRequest('http://localhost/api/admin/web-search'))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Unauthorized' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 403 when the signed-in user is not an admin', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } })
    mocks.findById.mockResolvedValue({ id: 'u1', role: USER_ROLE.User })

    const response = await withAdmin(handler)(new NextRequest('http://localhost/api/admin/web-search'))
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({ error: 'Forbidden' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('injects userId for an admin', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'u1' } })
    mocks.findById.mockResolvedValue({ id: 'u1', role: USER_ROLE.Admin })

    const response = await withAdmin(handler)(new NextRequest('http://localhost/api/admin/web-search'))

    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0]?.[1]).toMatchObject({ userId: 'u1' })
  })
})
