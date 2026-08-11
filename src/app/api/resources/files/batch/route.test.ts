// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  deleteS3ObjectsByUrls: vi.fn(),
  hasUrlReference: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))
vi.mock('@pure/database/repositories/knowledge', () => ({
  KnowledgeRepo: class {
    deleteMany = mocks.deleteMany
  },
}))
vi.mock('@pure/database/models/file', () => ({
  FileModel: class {
    hasUrlReference = mocks.hasUrlReference
  },
}))
vi.mock('@/server/modules/S3/cleanup', () => ({
  deleteS3ObjectsByUrls: mocks.deleteS3ObjectsByUrls,
}))

import { POST } from './route'

describe('POST /api/resources/files/batch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.deleteMany.mockResolvedValue([{ id: 'file-1', url: 'https://storage.example/resources/a.png' }])
    mocks.deleteS3ObjectsByUrls.mockResolvedValue(undefined)
    mocks.hasUrlReference.mockResolvedValue(false)
  })

  it('deletes DB rows then removes S3 objects', async () => {
    const request = new NextRequest('http://localhost/api/resources/files/batch', {
      body: JSON.stringify({
        action: 'delete',
        items: [{ id: 'file-1', sourceType: 'file' }],
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    const response = await POST(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    expect(mocks.deleteMany).toHaveBeenCalledWith([{ id: 'file-1', sourceType: 'file' }])
    expect(mocks.deleteS3ObjectsByUrls).toHaveBeenCalledWith(['https://storage.example/resources/a.png'])
    await expect(response.json()).resolves.toEqual({ deleted: 1 })
  })

  it('does not clean a shared S3 object', async () => {
    mocks.hasUrlReference.mockResolvedValue(true)

    const request = new NextRequest('http://localhost/api/resources/files/batch', {
      body: JSON.stringify({ action: 'delete', items: [{ id: 'file-1', sourceType: 'file' }] }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })

    const response = await POST(request, { params: Promise.resolve({}) })

    expect(response.status).toBe(200)
    expect(mocks.deleteS3ObjectsByUrls).not.toHaveBeenCalled()
  })
})
