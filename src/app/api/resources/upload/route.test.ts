// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class FileStorageQuotaExceededError extends Error {
    readonly code = 'FILE_STORAGE_QUOTA_EXCEEDED' as const

    constructor(
      readonly usedBytes: number,
      readonly limitBytes: number,
      readonly requestedBytes: number
    ) {
      super('File storage quota exceeded')
    }
  }

  return {
    createWithinStorageLimit: vi.fn(),
    deleteFile: vi.fn(),
    FileStorageQuotaExceededError,
    findById: vi.fn(),
    getStorageUsage: vi.fn(),
    uploadMedia: vi.fn(),
  }
})

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))
vi.mock('@/envs/file', () => ({
  fileEnv: {
    S3_ACCESS_KEY_ID: 'access',
    S3_BUCKET: 'bucket',
    S3_ENDPOINT: 'https://storage.example',
    S3_SECRET_ACCESS_KEY: 'secret',
  },
  fileStorageLimitBytes: 15,
}))
vi.mock('@pure/database/models/file', () => ({
  FileModel: class {
    createWithinStorageLimit = mocks.createWithinStorageLimit
    findById = mocks.findById
    getStorageUsage = mocks.getStorageUsage
  },
  FileStorageQuotaExceededError: mocks.FileStorageQuotaExceededError,
}))
vi.mock('@/server/modules/S3', () => ({
  FileS3: class {
    deleteFile = mocks.deleteFile
    uploadMedia = mocks.uploadMedia
  },
}))
vi.mock('@/server/modules/S3/url', () => ({
  buildPublicS3Url: (key: string) => `https://storage.example/${key}`,
  resolveFileAccessUrl: (id: string) => `/api/resources/files/${id}/content`,
}))

import { POST } from './route'

const createRequest = (contents = 'hello') => {
  const formData = new FormData()
  formData.set('file', new File([contents], 'test.txt', { type: 'text/plain' }))
  return new NextRequest('http://localhost/api/resources/upload', { body: formData, method: 'POST' })
}

describe('POST /api/resources/upload storage quota', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getStorageUsage.mockResolvedValue(0)
    mocks.createWithinStorageLimit.mockResolvedValue({ id: 'file-1' })
    mocks.findById.mockResolvedValue({ id: 'file-1', name: 'test.txt', url: 'https://storage.example/original' })
  })

  it('rejects an obvious over-limit upload before calling S3', async () => {
    mocks.getStorageUsage.mockResolvedValue(14)

    const response = await POST(createRequest('ab'))
    const payload = await response.json()

    expect(response.status).toBe(413)
    expect(payload).toMatchObject({
      code: 'FILE_STORAGE_QUOTA_EXCEEDED',
      limitBytes: 15,
      requestedBytes: 2,
      usedBytes: 14,
    })
    expect(mocks.uploadMedia).not.toHaveBeenCalled()
  })

  it('removes the uploaded object when the final transaction rejects the quota', async () => {
    mocks.createWithinStorageLimit.mockRejectedValue(new mocks.FileStorageQuotaExceededError(12, 15, 5))

    const response = await POST(createRequest())

    expect(response.status).toBe(413)
    expect(mocks.uploadMedia).toHaveBeenCalledOnce()
    expect(mocks.deleteFile).toHaveBeenCalledOnce()
  })

  it('removes the uploaded object when the database write fails', async () => {
    mocks.createWithinStorageLimit.mockRejectedValue(new Error('database unavailable'))

    const response = await POST(createRequest())

    expect(response.status).toBe(500)
    expect(mocks.deleteFile).toHaveBeenCalledOnce()
  })

  it('returns the created file without deleting the object when within quota', async () => {
    const response = await POST(createRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.url).toBe('/api/resources/files/file-1/content')
    expect(mocks.createWithinStorageLimit).toHaveBeenCalledWith(expect.objectContaining({ size: 5 }), 15, true)
    expect(mocks.deleteFile).not.toHaveBeenCalled()
  })
})
