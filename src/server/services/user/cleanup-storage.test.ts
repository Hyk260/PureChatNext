// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteOrphanGlobalFiles: vi.fn(),
  deleteS3ObjectsByUrls: vi.fn(),
  deleteS3Prefix: vi.fn(),
  deleteUnverifiedOlderThan: vi.fn(),
  deleteUserByIdForAdmin: vi.fn(),
  findById: vi.fn(),
  hasUrlReference: vi.fn(),
  isS3Configured: vi.fn(),
  listOwnedStorageRefs: vi.fn(),
  listUnverifiedOlderThan: vi.fn(),
}))

vi.mock('@pure/database/models/file', () => ({
  FileModel: class {
    deleteOrphanGlobalFiles = mocks.deleteOrphanGlobalFiles
    hasUrlReference = mocks.hasUrlReference
    listOwnedStorageRefs = mocks.listOwnedStorageRefs
  },
}))

vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    deleteUnverifiedOlderThan = mocks.deleteUnverifiedOlderThan
    deleteUserByIdForAdmin = mocks.deleteUserByIdForAdmin
    findById = mocks.findById
    listUnverifiedOlderThan = mocks.listUnverifiedOlderThan
  },
}))

vi.mock('@/server/modules/S3/cleanup', () => ({
  deleteS3ObjectsByUrls: mocks.deleteS3ObjectsByUrls,
  deleteS3Prefix: mocks.deleteS3Prefix,
}))

vi.mock('@/server/modules/S3/config', () => ({
  isS3Configured: mocks.isS3Configured,
}))

vi.mock('@/app/api/webapi/user/avatar/storage', () => ({
  avatarKeyPrefix: (userId: string) => `user/avatar/${userId}/`,
}))

vi.mock('@/server/modules/GitHub/skillFiles', () => ({
  userSkillsPrefix: (userId: string) => `skills/${userId}/`,
}))

import {
  cleanupUserS3Assets,
  deleteAdminUserWithStorage,
  UserStorageCleanupError,
} from './cleanup-storage'

describe('cleanupUserS3Assets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleteOrphanGlobalFiles.mockResolvedValue(undefined)
    mocks.deleteS3ObjectsByUrls.mockResolvedValue(undefined)
    mocks.deleteS3Prefix.mockResolvedValue(undefined)
    mocks.hasUrlReference.mockResolvedValue(false)
    mocks.isS3Configured.mockReturnValue(true)
  })

  it('deletes unreferenced file objects and user prefixes', async () => {
    mocks.hasUrlReference.mockImplementation(async (url: string) => url === 'https://shared')

    await cleanupUserS3Assets({ authUserId: 'auth-1', businessUserId: 'biz-1' }, [
      { fileHash: 'h1', url: 'https://shared' },
      { fileHash: 'h2', url: 'https://owned' },
    ])

    expect(mocks.deleteOrphanGlobalFiles).toHaveBeenCalledWith(['h1', 'h2'])
    expect(mocks.deleteS3ObjectsByUrls).toHaveBeenCalledWith(['https://owned'])
    expect(mocks.deleteS3Prefix).toHaveBeenCalledWith('user/avatar/biz-1/')
    expect(mocks.deleteS3Prefix).toHaveBeenCalledWith('skills/auth-1/')
  })

  it('skips S3 when not configured', async () => {
    mocks.isS3Configured.mockReturnValue(false)

    await cleanupUserS3Assets({ authUserId: 'auth-1', businessUserId: 'biz-1' }, [
      { fileHash: 'h1', url: 'https://owned' },
    ])

    expect(mocks.deleteOrphanGlobalFiles).toHaveBeenCalledWith(['h1'])
    expect(mocks.deleteS3ObjectsByUrls).not.toHaveBeenCalled()
    expect(mocks.deleteS3Prefix).not.toHaveBeenCalled()
  })
})

describe('deleteAdminUserWithStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findById.mockResolvedValue({ id: 'user-1', userId: 'biz-1' })
    mocks.listOwnedStorageRefs.mockResolvedValue([{ fileHash: 'h1', url: 'https://owned' }])
    mocks.deleteUserByIdForAdmin.mockResolvedValue({ found: true })
    mocks.deleteOrphanGlobalFiles.mockResolvedValue(undefined)
    mocks.deleteS3ObjectsByUrls.mockResolvedValue(undefined)
    mocks.deleteS3Prefix.mockResolvedValue(undefined)
    mocks.hasUrlReference.mockResolvedValue(false)
    mocks.isS3Configured.mockReturnValue(true)
  })

  it('collects refs, deletes the user, then cleans S3', async () => {
    const order: string[] = []
    mocks.listOwnedStorageRefs.mockImplementation(async () => {
      order.push('collect')
      return [{ fileHash: 'h1', url: 'https://owned' }]
    })
    mocks.deleteUserByIdForAdmin.mockImplementation(async () => {
      order.push('delete')
      return { found: true }
    })
    mocks.deleteS3ObjectsByUrls.mockImplementation(async () => {
      order.push('s3')
    })

    await expect(deleteAdminUserWithStorage('user-1', 'admin-1')).resolves.toEqual({ found: true })
    expect(order).toEqual(['collect', 'delete', 's3'])
    expect(mocks.deleteUserByIdForAdmin).toHaveBeenCalledWith('user-1', 'admin-1')
  })

  it('wraps S3 failures after the user is already deleted', async () => {
    mocks.deleteS3Prefix.mockRejectedValue(new Error('boom'))

    await expect(deleteAdminUserWithStorage('user-1', 'admin-1')).rejects.toBeInstanceOf(UserStorageCleanupError)
    expect(mocks.deleteUserByIdForAdmin).toHaveBeenCalled()
  })
})
