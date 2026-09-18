// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { UserSkillAlreadyInstalledError, UserSkillModel } from '../userSkill'
import type { ChatDatabase } from '../../type'

const skillInput = {
  description: 'demo',
  files: [
    {
      fileType: 'text/markdown',
      path: 'SKILL.md',
      s3Key: 'skills/user-1/usk_1/SKILL.md',
      sha256: 'abc',
      size: 12,
    },
  ],
  githubBranch: 'main',
  githubOwner: 'o',
  githubPath: 'skills/demo',
  githubRepo: 'r',
  homepage: 'https://github.com/o/r/tree/main/skills/demo',
  icon: null,
  id: 'usk_1',
  identifier: 'demo',
  name: 'Demo',
  version: '1.0.0',
}

const createInsertDb = (options?: { unique?: boolean }) => {
  const inserted: unknown[] = []
  const tx = {
    insert: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.values = vi.fn((value: unknown) => {
        inserted.push(value)
        return chain
      })
      chain.returning = vi.fn(async () => {
        if (options?.unique) {
          throw { code: '23505' }
        }
        return [{ id: 'usk_1', identifier: 'demo', name: 'Demo' }]
      })
      return chain
    }),
  }
  const db = {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  } as unknown as ChatDatabase
  return { db, inserted, tx }
}

describe('UserSkillModel.create', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts the skill then its files in one transaction', async () => {
    const { db, inserted, tx } = createInsertDb()
    const created = await new UserSkillModel('user-1', db).create(skillInput)

    expect(created).toMatchObject({ id: 'usk_1', identifier: 'demo' })
    expect(tx.insert).toHaveBeenCalledTimes(2)
    expect(inserted[0]).toEqual(
      expect.objectContaining({
        fileCount: 1,
        id: 'usk_1',
        identifier: 'demo',
        totalSize: 12,
        userId: 'user-1',
      })
    )
    expect(inserted[1]).toEqual([
      expect.objectContaining({
        path: 'SKILL.md',
        s3Key: 'skills/user-1/usk_1/SKILL.md',
        skillId: 'usk_1',
      }),
    ])
  })

  it('maps unique identifier conflicts to already-installed', async () => {
    const { db } = createInsertDb({ unique: true })

    await expect(new UserSkillModel('user-1', db).create(skillInput)).rejects.toBeInstanceOf(
      UserSkillAlreadyInstalledError
    )
  })
})
