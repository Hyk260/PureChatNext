import { afterEach, describe, expect, it, vi } from 'vitest'

import * as desktop from '@/types/desktop'
import type { DesktopApi } from '@/types/desktop'

import { resolveNewChatProject } from '../chatProject'

const defaultProject = { createdAt: 1, id: 'default', name: 'Default', rootPath: '/tmp/default' }

afterEach(() => vi.restoreAllMocks())

function setupApi() {
  const api = {
    getDefaultProject: vi.fn().mockResolvedValue(defaultProject),
    listProjects: vi.fn().mockResolvedValue([defaultProject]),
  }
  vi.spyOn(desktop, 'getDesktopApi').mockReturnValue(api as unknown as DesktopApi)
  return api
}

describe('resolveNewChatProject', () => {
  it('uses the machine default only when no project was selected', async () => {
    const api = setupApi()
    expect(await resolveNewChatProject(null)).toEqual(defaultProject)
    const selected = { name: 'Chosen', rootPath: '/tmp/chosen' }
    expect(await resolveNewChatProject(selected)).toEqual(selected)
    expect(api.getDefaultProject).toHaveBeenCalledTimes(1)
  })

  it('resolves a sidebar project name to its local directory', async () => {
    const api = setupApi()
    expect(await resolveNewChatProject({ name: 'Default' })).toEqual(defaultProject)
    expect(api.getDefaultProject).not.toHaveBeenCalled()
    expect(await resolveNewChatProject({ name: 'Missing' })).toEqual({ name: 'Missing' })
  })

  it('supports no default and browser environments', async () => {
    const api = setupApi()
    api.getDefaultProject.mockResolvedValue(null)
    expect(await resolveNewChatProject(null)).toBeNull()
    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue(undefined)
    expect(await resolveNewChatProject(null)).toBeNull()
  })
})
