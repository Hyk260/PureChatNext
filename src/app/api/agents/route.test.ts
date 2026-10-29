// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const model = vi.hoisted(() => ({ create: vi.fn(), find: vi.fn(), list: vi.fn(), update: vi.fn() }))

vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    create = model.create
    findVisibleById = model.find
    listVisible = model.list
    update = model.update
  },
  AgentDeleteError: class extends Error {},
  AgentUpdateError: class extends Error {},
}))
vi.mock('@/libs/auth/get-session-user', () => ({
  withAuth:
    (handler: (request: NextRequest, context: { userId: string; params: Promise<{ id: string }> }) => unknown) =>
    (request: NextRequest) =>
      handler(request, { userId: 'owner', params: Promise.resolve({ id: 'installed-id' }) }),
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
}))

import { GET, POST } from './route'
import { GET as getDetail, PATCH } from './[id]/route'

const saved = {
  id: 'installed-id',
  userId: 'owner',
  marketIdentifier: 'business-contract',
  title: 'old title',
  avatar: 'old',
  backgroundColor: null,
  description: 'old description',
  openingMessage: null,
  openingQuestions: [],
  systemRole: 'old prompt',
  pinned: true,
}

const request = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/agents', {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
  })

describe('resolved assistant APIs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    model.create.mockResolvedValue(saved)
    model.find.mockResolvedValue(saved)
    model.list.mockResolvedValue([saved])
    model.update.mockImplementation(async (_id, patch) => ({ ...saved, ...patch }))
  })

  it('installs by identifier and ignores caller-supplied copies of community content', async () => {
    for (const body of [
      { marketIdentifier: 'business-contract' },
      { marketIdentifier: 'business-contract', title: 'stale client title', systemRole: 'stale client prompt' },
    ]) {
      const response = await POST(request('POST', body))
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        id: 'installed-id',
        title: '合同条款精炼师v1.0',
        openingMessage: expect.stringContaining('合同条款精炼师'),
        configSource: 'community',
      })
    }
    expect(model.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: '合同条款精炼师v1.0',
        systemRole: expect.not.stringContaining('stale client prompt'),
      })
    )
    expect((await POST(request('POST', { marketIdentifier: 'removed' }))).status).toBe(404)
    expect((await POST(request('POST', {}))).status).toBe(400)
  })

  it('returns current configuration with private cache policy and exposes saved content only on detail reads', async () => {
    const list = await GET(request('GET'))
    expect(list.headers.get('Cache-Control')).toBe('private, no-store')
    const items = await list.json()
    expect(items[0].openingQuestions.length).toBeGreaterThan(0)
    expect(items[0]).not.toHaveProperty('savedConfig')
    const detail = await getDetail(request('GET'), { params: Promise.resolve({ id: 'installed-id' }) })
    expect(detail.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await detail.json()).toMatchObject({ savedConfig: { systemRole: 'old prompt', title: 'old title' } })
    expect(model.update).not.toHaveBeenCalled()
  })

  it('prevents editing linked content while preserving personal settings', async () => {
    const context = { params: Promise.resolve({ id: 'installed-id' }) }
    expect((await PATCH(request('PATCH', { systemRole: 'override' }), context)).status).toBe(409)
    expect(model.update).not.toHaveBeenCalled()
    const response = await PATCH(request('PATCH', { pinned: false }), context)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: 'installed-id', pinned: false, configSource: 'community' })
  })
})
