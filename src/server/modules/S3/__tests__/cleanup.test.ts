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
}))

vi.mock('@/envs/file', () => ({
  fileEnv: mocks.fileEnv,
}))
vi.mock('@/server/modules/S3', () => ({
  FileS3: class {
    deleteFiles = mocks.deleteFiles
  },
}))
vi.mock('@/server/modules/S3/url', () => ({
  extractS3KeyFromUrl: mocks.extractS3KeyFromUrl,
}))

import { deleteS3ObjectsByUrls } from '../cleanup'

describe('deleteS3ObjectsByUrls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleteFiles.mockResolvedValue(undefined)
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
