// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  getFileByteArray: vi.fn(),
  getFileContent: vi.fn(),
  getUserSkillFile: vi.fn(),
  isS3Configured: vi.fn(() => true),
  list: vi.fn(),
  listFiles: vi.fn(),
  uninstallCommunitySkill: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (
      handler: (
        request: NextRequest,
        context: { params: Promise<{ id: string }>; userId: string }
      ) => Promise<Response>
    ) =>
    (request: NextRequest, context?: { params: Promise<{ id: string }> }) =>
      handler(request, { params: context?.params ?? Promise.resolve({ id: '' }), userId: 'user-1' }),
}))
vi.mock('@pure/database/models/userSkill', () => ({
  UserSkillModel: class {
    findById = mocks.findById
    list = mocks.list
    listFiles = mocks.listFiles
  },
}))
vi.mock('@/server/services/userSkill', () => ({
  getUserSkillFile: mocks.getUserSkillFile,
  uninstallCommunitySkill: mocks.uninstallCommunitySkill,
}))
vi.mock('@/server/modules/S3/config', () => ({
  isS3Configured: () => mocks.isS3Configured(),
}))
vi.mock('@/server/modules/S3', () => ({
  FileS3: class {
    getFileByteArray = mocks.getFileByteArray
    getFileContent = mocks.getFileContent
  },
}))

import { GET as listSkills } from './route'
import { DELETE as deleteSkill, GET as getSkill } from './[id]/route'
import { GET as getSkillFile } from './[id]/files/route'

const skill = {
  createdAt: new Date('2026-01-01'),
  description: 'd',
  fileCount: 1,
  homepage: 'https://github.com/o/r',
  icon: null,
  id: 'usk_1',
  identifier: 'demo',
  name: 'Demo',
  totalSize: 12,
  updatedAt: new Date('2026-08-26'),
  version: '1.0.0',
}

describe('GET /api/user/skills', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([skill])
  })

  it('lists installed skills without file bodies', async () => {
    const response = await listSkills(new NextRequest('http://localhost/api/user/skills'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual([
      expect.objectContaining({
        createdAt: skill.createdAt.toISOString(),
        fileCount: 1,
        id: 'usk_1',
        identifier: 'demo',
        name: 'Demo',
        updatedAt: skill.updatedAt.toISOString(),
      }),
    ])
    expect(payload[0].s3Key).toBeUndefined()
  })
})

describe('GET /api/user/skills/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findById.mockResolvedValue(skill)
    mocks.listFiles.mockResolvedValue([
      { fileType: 'text/markdown', path: 'SKILL.md', s3Key: 'skills/user-1/usk_1/SKILL.md', size: 12 },
    ])
  })

  it('returns details and the file tree source list', async () => {
    const response = await getSkill(new NextRequest('http://localhost/api/user/skills/usk_1'), {
      params: Promise.resolve({ id: 'usk_1' }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.files).toEqual([{ fileType: 'text/markdown', path: 'SKILL.md', size: 12 }])
    expect(payload.files[0].s3Key).toBeUndefined()
  })
})

describe('DELETE /api/user/skills/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.uninstallCommunitySkill.mockResolvedValue(skill)
  })

  it('returns 204 after uninstall', async () => {
    const response = await deleteSkill(new NextRequest('http://localhost/api/user/skills/usk_1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'usk_1' }),
    })

    expect(response.status).toBe(204)
    expect(mocks.uninstallCommunitySkill).toHaveBeenCalledWith('user-1', 'usk_1')
  })

  it('returns 404 when the skill is missing', async () => {
    mocks.uninstallCommunitySkill.mockResolvedValue(undefined)

    const response = await deleteSkill(new NextRequest('http://localhost/api/user/skills/usk_1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'usk_1' }),
    })

    expect(response.status).toBe(404)
  })
})

describe('GET /api/user/skills/:id/files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isS3Configured.mockReturnValue(true)
    mocks.getUserSkillFile.mockResolvedValue({
      fileType: 'text/markdown',
      path: 'SKILL.md',
      s3Key: 'skills/user-1/usk_1/SKILL.md',
      size: 12,
    })
    mocks.getFileContent.mockResolvedValue('# Hello')
  })

  it('returns markdown from S3', async () => {
    const response = await getSkillFile(new NextRequest('http://localhost/api/user/skills/usk_1/files?path=SKILL.md'), {
      params: Promise.resolve({ id: 'usk_1' }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/markdown')
    await expect(response.text()).resolves.toBe('# Hello')
  })

  it('rejects path traversal', async () => {
    const response = await getSkillFile(
      new NextRequest('http://localhost/api/user/skills/usk_1/files?path=../secret'),
      { params: Promise.resolve({ id: 'usk_1' }) }
    )

    expect(response.status).toBe(400)
    expect(mocks.getUserSkillFile).not.toHaveBeenCalled()
  })

  it('returns 503 when S3 is not configured', async () => {
    mocks.isS3Configured.mockReturnValue(false)

    const response = await getSkillFile(new NextRequest('http://localhost/api/user/skills/usk_1/files?path=SKILL.md'), {
      params: Promise.resolve({ id: 'usk_1' }),
    })

    expect(response.status).toBe(503)
  })
})
