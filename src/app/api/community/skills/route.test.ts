// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCommunitySkillReadme: vi.fn(),
  installCommunitySkill: vi.fn(),
}))

vi.mock('@pure/database/models/userSkill', () => ({
  UserSkillAlreadyInstalledError: class UserSkillAlreadyInstalledError extends Error {
    constructor(public readonly identifier: string) {
      super(`Skill already installed: ${identifier}`)
      this.name = 'UserSkillAlreadyInstalledError'
    }
  },
}))

vi.mock('@/server/services/userSkill', () => ({
  SkillCatalogNotFoundError: class SkillCatalogNotFoundError extends Error {
    constructor(identifier: string) {
      super(`Skill not found in catalog: ${identifier}`)
      this.name = 'SkillCatalogNotFoundError'
    }
  },
  SkillS3NotConfiguredError: class SkillS3NotConfiguredError extends Error {
    constructor() {
      super('S3 is not configured')
      this.name = 'SkillS3NotConfiguredError'
    }
  },
  getCommunitySkillReadme: mocks.getCommunitySkillReadme,
  installCommunitySkill: mocks.installCommunitySkill,
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))

import { UserSkillAlreadyInstalledError } from '@pure/database/models/userSkill'
import { GET as getReadme } from './[identifier]/readme/route'
import { POST as install } from './install/route'
import { SkillCatalogNotFoundError, SkillS3NotConfiguredError } from '@/server/services/userSkill'

describe('GET /api/community/skills/:identifier/readme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns markdown from GitHub', async () => {
    mocks.getCommunitySkillReadme.mockResolvedValue('# Hello')

    const response = await getReadme(new Request('http://localhost/api/community/skills/demo/readme'), {
      params: Promise.resolve({ identifier: 'demo' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ markdown: '# Hello' })
  })

  it('returns 404 when the catalog skill or SKILL.md is missing', async () => {
    mocks.getCommunitySkillReadme.mockRejectedValue(new SkillCatalogNotFoundError('missing'))

    const response = await getReadme(new Request('http://localhost/api/community/skills/missing/readme'), {
      params: Promise.resolve({ identifier: 'missing' }),
    })

    expect(response.status).toBe(404)
  })
})

describe('POST /api/community/skills/install', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.installCommunitySkill.mockResolvedValue({
      fileCount: 2,
      id: 'usk_1',
      identifier: 'demo',
      name: 'Demo',
    })
  })

  const post = (identifier: string) =>
    install(
      new NextRequest('http://localhost/api/community/skills/install', {
        body: JSON.stringify({ identifier }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      })
    )

  it('installs a catalog skill', async () => {
    const response = await post('demo')
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ fileCount: 2, id: 'usk_1', identifier: 'demo', name: 'Demo' })
    expect(mocks.installCommunitySkill).toHaveBeenCalledWith('user-1', 'demo')
  })

  it('returns 404 when the identifier is not in the catalog', async () => {
    mocks.installCommunitySkill.mockRejectedValue(new SkillCatalogNotFoundError('nope'))

    const response = await post('nope')
    expect(response.status).toBe(404)
  })

  it('returns 409 when the skill is already installed', async () => {
    mocks.installCommunitySkill.mockRejectedValue(new UserSkillAlreadyInstalledError('demo'))

    const response = await post('demo')
    expect(response.status).toBe(409)
  })

  it('returns 503 when S3 is not configured', async () => {
    mocks.installCommunitySkill.mockRejectedValue(new SkillS3NotConfiguredError())

    const response = await post('demo')
    expect(response.status).toBe(503)
  })
})
