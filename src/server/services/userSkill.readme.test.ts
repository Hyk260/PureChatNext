import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  downloadRawFile: vi.fn(),
  findCommunitySkill: vi.fn(),
  getCommunitySkillReadmeSnapshot: vi.fn(),
  getCommunitySkillSourceUrl: vi.fn(),
  parseRepoUrl: vi.fn(),
}))

vi.mock('@/const/community/skills.readme', () => ({
  getCommunitySkillReadmeSnapshot: mocks.getCommunitySkillReadmeSnapshot,
}))

vi.mock('@/const/community/skills', () => ({
  findCommunitySkill: mocks.findCommunitySkill,
  getCommunitySkillSourceUrl: mocks.getCommunitySkillSourceUrl,
}))

vi.mock('@/server/modules/GitHub', () => ({
  GitHubDownloadError: class GitHubDownloadError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'GitHubDownloadError'
    }
  },
  GitHubNotFoundError: class GitHubNotFoundError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'GitHubNotFoundError'
    }
  },
  GitHubParseError: class GitHubParseError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'GitHubParseError'
    }
  },
  GitHubRateLimitError: class GitHubRateLimitError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'GitHubRateLimitError'
    }
  },
  github: {
    downloadRawFile: mocks.downloadRawFile,
    parseRepoUrl: mocks.parseRepoUrl,
  },
}))

vi.mock('@pure/database/models/userSkill', () => ({
  UserSkillAlreadyInstalledError: class UserSkillAlreadyInstalledError extends Error {},
  UserSkillModel: class UserSkillModel {},
}))

vi.mock('@/server/modules/S3', () => ({ FileS3: class FileS3 {} }))
vi.mock('@/server/modules/S3/config', () => ({ isS3Configured: () => false }))

import { SkillCatalogNotFoundError, getCommunitySkillReadme } from './userSkill'

const skill = { identifier: 'demo', name: 'Demo' }

describe('getCommunitySkillReadme', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findCommunitySkill.mockReturnValue(skill)
  })

  it('returns the sync snapshot without hitting GitHub', async () => {
    mocks.getCommunitySkillReadmeSnapshot.mockReturnValue('# Snapshot')

    await expect(getCommunitySkillReadme('demo')).resolves.toBe('# Snapshot')
    expect(mocks.downloadRawFile).not.toHaveBeenCalled()
  })

  it('falls back to GitHub when the snapshot misses', async () => {
    mocks.getCommunitySkillReadmeSnapshot.mockReturnValue(undefined)
    mocks.getCommunitySkillSourceUrl.mockReturnValue('https://github.com/o/r/tree/main/skills/demo')
    mocks.parseRepoUrl.mockReturnValue({ branch: 'main', owner: 'o', path: 'skills/demo', repo: 'r' })
    mocks.downloadRawFile.mockResolvedValue('# Live')

    await expect(getCommunitySkillReadme('demo')).resolves.toBe('# Live')
    expect(mocks.downloadRawFile).toHaveBeenCalledWith({
      branch: 'main',
      filePath: 'skills/demo/SKILL.md',
      owner: 'o',
      path: 'skills/demo',
      repo: 'r',
    })
  })

  it('returns 404 when the identifier is not in the catalog', async () => {
    mocks.findCommunitySkill.mockReturnValue(undefined)

    await expect(getCommunitySkillReadme('missing')).rejects.toBeInstanceOf(SkillCatalogNotFoundError)
    expect(mocks.downloadRawFile).not.toHaveBeenCalled()
  })
})
