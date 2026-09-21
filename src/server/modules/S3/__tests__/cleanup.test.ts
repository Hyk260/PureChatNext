// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteFiles: vi.fn(),
  extractS3KeyFromUrl: vi.fn((url: string) => url.replace(/^https:\/\/storage\.example\//, '')),
  fileEnv: {
    S3_ACCESS_KEY_ID: 'access',
    S3_BUCKET: 'bucket',
    S3_ENDPOINT: 'https://storage.example',
    S3_SECRET_ACCESS_KEY: 'secret',
  },
  listFiles: vi.fn(),
}))

vi.mock('@/envs/file', () => ({
  fileEnv: mocks.fileEnv,
}))
vi.mock('@/server/modules/S3', () => ({
  FileS3: class {
    deleteFiles = mocks.deleteFiles
    listFiles = mocks.listFiles
  },
}))
vi.mock('@/server/modules/S3/url', () => ({
  extractS3KeyFromUrl: mocks.extractS3KeyFromUrl,
}))

import { deleteS3ObjectsByUrls, deleteS3Prefix } from '../cleanup'

describe('deleteS3ObjectsByUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleteFiles.mockResolvedValue(undefined)
    mocks.listFiles.mockResolvedValue([])
    mocks.fileEnv.S3_ACCESS_KEY_ID = 'access'
  })

  it('dedupes keys and deletes via FileS3', async () => {
    await deleteS3ObjectsByUrls([
      'https://storage.example/resources/a.png',
      'https://storage.example/resources/a.png',
      'https://storage.example/resources/b.png',
      null,
      '',
    ])

    expect(mocks.deleteFiles).toHaveBeenCalledWith(['resources/a.png', 'resources/b.png'])
  })

  it('fails clearly when S3 is not configured', async () => {
    mocks.fileEnv.S3_ACCESS_KEY_ID = ''

    await expect(deleteS3ObjectsByUrls(['https://storage.example/resources/a.png'])).rejects.toThrow('S3 文件存储未配置')

    expect(mocks.deleteFiles).not.toHaveBeenCalled()
  })

  it('propagates S3 delete errors', async () => {
    mocks.deleteFiles.mockRejectedValue(new Error('boom'))

    await expect(deleteS3ObjectsByUrls(['https://storage.example/resources/a.png'])).rejects.toThrow('boom')
  })
})

describe('deleteS3Prefix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleteFiles.mockResolvedValue(undefined)
    mocks.listFiles.mockResolvedValue([])
    mocks.fileEnv.S3_ACCESS_KEY_ID = 'access'
  })

  it('lists the prefix and deletes unique keys', async () => {
    mocks.listFiles.mockResolvedValue([{ Key: 'user/avatar/u1/a.png' }, { Key: 'user/avatar/u1/a.png' }, { Key: '' }])

    await deleteS3Prefix('user/avatar/u1/')

    expect(mocks.listFiles).toHaveBeenCalledWith('user/avatar/u1/')
    expect(mocks.deleteFiles).toHaveBeenCalledWith(['user/avatar/u1/a.png'])
  })

  it('skips delete when the prefix is empty', async () => {
    await deleteS3Prefix('user/avatar/u1/')

    expect(mocks.deleteFiles).not.toHaveBeenCalled()
  })
})
