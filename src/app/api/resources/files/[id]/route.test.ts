// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  deleteS3ObjectsByUrls: vi.fn(),
  findById: vi.fn(),
  hasUrlReference: vi.fn(),
  update: vi.fn(),
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
    (request: NextRequest, context: { params: Promise<{ id: string }> }) =>
      handler(request, { params: context.params, userId: 'user-1' }),
}))
vi.mock('@pure/database/models/file', () => ({
  FileModel: class {
    delete = mocks.delete
    findById = mocks.findById
    hasUrlReference = mocks.hasUrlReference
    update = mocks.update
  },
}))
vi.mock('@/server/modules/S3/cleanup', () => ({
  deleteS3ObjectsByUrls: mocks.deleteS3ObjectsByUrls,
}))
vi.mock('@/server/modules/S3/url', () => ({
  resolveFileAccessUrl: (id: string) => `/api/resources/files/${id}/content`,
}))

import { DELETE } from './route'

describe('DELETE /api/resources/files/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.delete.mockResolvedValue({ id: 'file-1', url: 'https://storage.example/resources/a.png' })
    mocks.deleteS3ObjectsByUrls.mockResolvedValue(undefined)
    mocks.hasUrlReference.mockResolvedValue(false)
  })

  it('removes the DB row and its S3 object', async () => {
    const response = await DELETE(new NextRequest('http://localhost/api/resources/files/file-1'), {
      params: Promise.resolve({ id: 'file-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith('file-1')
    expect(mocks.deleteS3ObjectsByUrls).toHaveBeenCalledWith(['https://storage.example/resources/a.png'])
  })

  it('keeps a shared S3 object when another DB row still references it', async () => {
    mocks.hasUrlReference.mockResolvedValue(true)

    const response = await DELETE(new NextRequest('http://localhost/api/resources/files/file-1'), {
      params: Promise.resolve({ id: 'file-1' }),
    })

    expect(response.status).toBe(200)
    expect(mocks.deleteS3ObjectsByUrls).not.toHaveBeenCalled()
  })

  it('reports S3 cleanup failure instead of claiming full success', async () => {
    mocks.deleteS3ObjectsByUrls.mockRejectedValue(new Error('S3 unavailable'))

    const response = await DELETE(new NextRequest('http://localhost/api/resources/files/file-1'), {
      params: Promise.resolve({ id: 'file-1' }),
    })

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ databaseDeleted: true })
  })
})
