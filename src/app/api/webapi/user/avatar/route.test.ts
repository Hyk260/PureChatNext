// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteFile: vi.fn(),
  findById: vi.fn(),
  inferImageMimeTypeFromBytes: vi.fn(),
  isS3Configured: vi.fn(() => true),
  listFiles: vi.fn(),
  updateUser: vi.fn(),
  uploadBuffer: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'auth-user-1' }),
}))
vi.mock('@/auth', () => ({
  auth: { api: { updateUser: mocks.updateUser } },
}))
vi.mock('@/envs/file', () => ({
  fileEnv: {
    S3_ENABLE_PATH_STYLE: false,
    S3_ENDPOINT: 'https://cos.ap-shanghai.myqcloud.com',
    S3_PUBLIC_DOMAIN: 'https://cdn.purechat.cn',
    S3_SET_ACL: false,
  },
}))
vi.mock('@pure/database/models/user', () => ({
  UserModel: class {
    findById = mocks.findById
  },
}))
vi.mock('@/server/modules/S3', () => ({
  FileS3: class {
    deleteFile = mocks.deleteFile
    listFiles = mocks.listFiles
    uploadBuffer = mocks.uploadBuffer
  },
}))
vi.mock('@/server/modules/S3/config', () => ({
  isS3Configured: mocks.isS3Configured,
}))
vi.mock('@pure/utils', () => ({
  inferImageMimeTypeFromBytes: mocks.inferImageMimeTypeFromBytes,
}))

import { POST } from './route'

const jpegFile = () => new File([new Uint8Array([0xff, 0xd8, 0xff])], 'avatar.jpg', { type: 'image/jpeg' })

const createRequest = (file = jpegFile()) => {
  const formData = new FormData()
  formData.set('file', file)
  return new NextRequest('http://localhost/api/webapi/user/avatar', { body: formData, method: 'POST' })
}

describe('POST /api/webapi/user/avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    mocks.isS3Configured.mockReturnValue(true)
    mocks.inferImageMimeTypeFromBytes.mockResolvedValue('image/jpeg')
    mocks.findById.mockResolvedValue({
      avatar: 'http://localhost:5174/api/webapi/user/avatar/huangyk/old.jpg',
      userId: 'huangyk',
    })
    mocks.listFiles.mockResolvedValue([
      { Key: 'user/avatar/huangyk/old.jpg' },
      { Key: 'user/avatar/huangyk/stale.jpg' },
      { Key: 'user/avatar/huangyk/avatar.jpg' },
    ])
    mocks.uploadBuffer.mockResolvedValue({})
    mocks.deleteFile.mockResolvedValue({})
    mocks.updateUser.mockResolvedValue({})
  })

  it('overwrites the stable avatar object and deletes leftover files', async () => {
    const response = await POST(createRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.avatar).toBe('https://cdn.purechat.cn/user/avatar/huangyk/avatar.jpg?v=1700000000000')
    expect(mocks.uploadBuffer).toHaveBeenCalledWith(
      'user/avatar/huangyk/avatar.jpg',
      expect.any(Buffer),
      'image/jpeg',
      'public, max-age=0, must-revalidate'
    )
    expect(mocks.deleteFile).toHaveBeenCalledWith('user/avatar/huangyk/old.jpg')
    expect(mocks.deleteFile).toHaveBeenCalledWith('user/avatar/huangyk/stale.jpg')
    expect(mocks.deleteFile).not.toHaveBeenCalledWith('user/avatar/huangyk/avatar.jpg')
  })

  it('still deletes the previous avatar when listing the prefix fails', async () => {
    mocks.listFiles.mockRejectedValue(new Error('ListBucket denied'))

    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    expect(mocks.deleteFile).toHaveBeenCalledWith('user/avatar/huangyk/old.jpg')
    expect(mocks.deleteFile).not.toHaveBeenCalledWith('user/avatar/huangyk/avatar.jpg')
  })
})
