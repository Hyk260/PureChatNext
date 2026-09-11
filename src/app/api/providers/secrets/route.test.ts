// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  listPublic: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))
vi.mock('@pure/database/models/userProviderSecret', () => ({
  MissingProviderApiKeyError: class MissingProviderApiKeyError extends Error {
    constructor(message = '请填写 API Key') {
      super(message)
      this.name = 'MissingProviderApiKeyError'
    }
  },
  UserProviderSecretModel: class {
    delete = mocks.delete
    listPublic = mocks.listPublic
    upsert = mocks.upsert
  },
  isUserProviderSecretId: (value: string) => value === 'openai' || value === 'deepseek',
}))

import { DELETE, GET, PUT } from './route'

const request = (method: string, body?: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/providers/secrets', {
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
    method,
  })

describe('/api/providers/secrets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listPublic.mockResolvedValue([
      { apiKey: 'sk-live-wxyz', baseURL: '', keyHint: 'wxyz', providerId: 'deepseek' },
    ])
    mocks.upsert.mockResolvedValue({
      apiKey: 'sk-live-wxyz',
      baseURL: 'https://api.deepseek.com',
      keyHint: 'wxyz',
      providerId: 'deepseek',
    })
    mocks.delete.mockResolvedValue(undefined)
  })

  it('lists decrypted secrets for the current user', async () => {
    const response = await GET(request('GET'))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.items).toEqual([
      { apiKey: 'sk-live-wxyz', baseURL: '', keyHint: 'wxyz', providerId: 'deepseek' },
    ])
  })

  it('encrypts and stores a provider secret', async () => {
    const response = await PUT(request('PUT', { apiKey: 'sk-live-wxyz', provider: 'deepseek' }))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(mocks.upsert).toHaveBeenCalledWith('user-1', 'deepseek', { apiKey: 'sk-live-wxyz', baseURL: undefined })
  })

  it('returns 503 when KEY_VAULTS_SECRET is missing', async () => {
    mocks.upsert.mockRejectedValueOnce(new Error('KEY_VAULTS_SECRET is required to encrypt provider secrets'))
    const response = await PUT(request('PUT', { apiKey: 'sk-live', provider: 'openai' }))
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({ error: '服务器未配置 KEY_VAULTS_SECRET，无法加密保存密钥' })
  })

  it('deletes a stored provider secret', async () => {
    const response = await DELETE(request('DELETE', { provider: 'openai' }))
    expect(response.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith('user-1', 'openai')
  })
})
