// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentItem } from '@pure/database/schemas/agent'

const db = vi.hoisted(() => ({
  create: vi.fn(),
  ensureBuiltin: vi.fn(),
  findVisibleById: vi.fn(),
  listVisible: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    create = db.create
    ensureBuiltin = db.ensureBuiltin
    findVisibleById = db.findVisibleById
    listVisible = db.listVisible
    update = db.update
  },
}))

import { defineAgentProfile, findCommunityDefinition } from './catalog'
import { AgentService } from './service'

const installed: AgentItem = {
  accessedAt: new Date(0),
  avatar: 'old',
  backgroundColor: null,
  createdAt: new Date(0),
  description: 'old description',
  id: 'installed-contract',
  isBuiltin: false,
  marketIdentifier: 'business-contract',
  model: 'my-model',
  openingMessage: null,
  openingQuestions: [],
  params: { temperature: 0.5 },
  pinned: true,
  provider: 'my-provider',
  slug: 'my-contract',
  sort: 9,
  systemRole: 'old prompt',
  title: 'old title',
  updatedAt: new Date(0),
  userId: 'user-1',
}

describe('AgentService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    db.findVisibleById.mockResolvedValue(structuredClone(installed))
    db.create.mockResolvedValue(structuredClone(installed))
    db.listVisible.mockResolvedValue([structuredClone(installed)])
  })

  it('resolves the latest definition without replacing the instance or its saved configuration', async () => {
    const service = new AgentService('user-1')
    const agent = await service.findVisibleById(installed.id)
    const definition = await findCommunityDefinition('business-contract')
    expect(agent).toMatchObject({
      ...definition?.profile,
      id: installed.id,
      userId: installed.userId,
      slug: installed.slug,
      model: installed.model,
      provider: installed.provider,
      params: installed.params,
      pinned: true,
      sort: 9,
      configSource: 'community',
      definitionRevision: definition?.revision,
      savedConfig: { systemRole: 'old prompt', openingMessage: null, title: 'old title' },
    })
    expect(agent?.openingMessage).toContain('合同条款精炼师')
    expect(agent?.openingQuestions?.length).toBeGreaterThan(0)
    expect(db.update).not.toHaveBeenCalled()
    expect((await service.listVisible())[0]).not.toHaveProperty('savedConfig')
  })

  it('reuses an existing installation and obtains its content from the server catalog', async () => {
    const agent = await new AgentService('user-1').install('business-contract')
    expect(agent.id).toBe(installed.id)
    expect(db.create).toHaveBeenCalledWith(
      expect.objectContaining({
        marketIdentifier: 'business-contract',
        title: '合同条款精炼师v1.0',
        openingMessage: expect.stringContaining('合同条款精炼师'),
      })
    )
    await expect(new AgentService('user-1').install('nonexistent')).rejects.toMatchObject({ status: 404 })
  })

  it('leaves custom assistants and unavailable community sources usable', async () => {
    db.findVisibleById.mockResolvedValue({ ...installed, marketIdentifier: null })
    expect(await new AgentService('user-1').findVisibleById(installed.id)).toMatchObject({
      ...installed,
      marketIdentifier: null,
      configSource: 'custom',
      definitionRevision: null,
    })
    db.findVisibleById.mockResolvedValue({ ...installed, marketIdentifier: 'removed' })
    expect(await new AgentService('user-1').findVisibleById(installed.id)).toMatchObject({
      systemRole: 'old prompt',
      configSource: 'snapshot',
      definitionRevision: null,
    })
    db.findVisibleById.mockResolvedValue(undefined)
    expect(await new AgentService('user-1').findVisibleById('not-owned')).toBeUndefined()
  })

  it('protects managed profile fields while allowing personal settings and independent copies', async () => {
    const service = new AgentService('user-1')
    await expect(service.update(installed.id, { systemRole: 'override' })).rejects.toMatchObject({ status: 409 })
    await expect(service.update(installed.id, { openingMessage: null })).rejects.toMatchObject({ status: 409 })
    expect(db.update).not.toHaveBeenCalled()
    db.update.mockResolvedValue({ ...installed, pinned: false })
    await service.update(installed.id, { pinned: false })
    expect(db.update).toHaveBeenCalledWith(installed.id, { pinned: false })
    db.create.mockResolvedValue({ ...installed, id: 'custom-copy', marketIdentifier: null, systemRole: 'my prompt' })
    const copy = await service.create({ title: 'my copy', systemRole: 'my prompt' })
    expect(copy).toMatchObject({ id: 'custom-copy', configSource: 'custom', systemRole: 'my prompt' })
  })

  it('updates the revision when prompt or welcome content changes', async () => {
    const definition = await findCommunityDefinition('business-contract')
    expect(definition).not.toBeNull()
    const profile = definition!.profile
    expect(defineAgentProfile({ ...profile }).revision).toBe(definition!.revision)
    expect(defineAgentProfile({ ...profile, openingMessage: 'new welcome' }).revision).not.toBe(definition!.revision)
    expect(defineAgentProfile({ ...profile, systemRole: 'new prompt' }).revision).not.toBe(definition!.revision)
  })
})
