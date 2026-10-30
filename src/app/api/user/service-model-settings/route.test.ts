// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  speechCredentials: vi.fn(),
}))

vi.mock('@/server/speech', () => ({
  resolveSpeechCredentials: mocks.speechCredentials,
  SpeechError: class extends Error {},
}))

vi.mock('@pure/database/models/serviceModelSettings', () => ({
  ServiceModelSettingsModel: vi.fn(() => mocks),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => unknown) =>
    (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))

import { DELETE, GET, PATCH } from './route'

const request = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/user/service-model-settings', {
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    method,
  })

describe('/api/user/service-model-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({})
    mocks.patch.mockResolvedValue({ topicNaming: { model: 'chat', provider: 'deepseek' } })
    mocks.delete.mockResolvedValue(undefined)
    mocks.speechCredentials.mockResolvedValue({ apiKey: 'private-key' })
  })

  it('reads settings without allowing cache reuse', async () => {
    const response = await GET(request('GET'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(mocks.get).toHaveBeenCalledWith('user-1')
  })

  it('validates and persists a sparse patch for the signed-in user', async () => {
    const response = await PATCH(request('PATCH', { topicNaming: { model: 'chat', provider: 'deepseek' } }))

    expect(response.status).toBe(200)
    expect(mocks.patch).toHaveBeenCalledWith('user-1', { topicNaming: { model: 'chat', provider: 'deepseek' } })
  })

  it('rejects an invalid provider and deletes settings on reset', async () => {
    const invalid = await PATCH(request('PATCH', { qqSpeech: { model: 'tts', provider: 'bad provider' } }))
    expect(invalid.status).toBe(400)
    expect(mocks.patch).not.toHaveBeenCalled()

    const reset = await DELETE(request('DELETE'))
    expect(reset.status).toBe(200)
    expect(mocks.delete).toHaveBeenCalledWith('user-1')
  })

  it('validates speech protocol, voice and endpoint before resolving owner credentials', async () => {
    const config = { provider: 'bailian', model: 'qwen-audio-3.1-tts-flash', voice: 'longanhuan_v3.1', endpoint: 'https://workspace.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer' }
    expect((await PATCH(request('PATCH', { qqSpeech: { ...config, voice: 'alloy' } }))).status).toBe(400)
    expect(mocks.speechCredentials).not.toHaveBeenCalled()
    const response = await PATCH(request('PATCH', { qqSpeech: config }))
    expect(response.status).toBe(200)
    expect(mocks.speechCredentials).toHaveBeenCalledWith('user-1', config)
    expect(mocks.patch).toHaveBeenCalledWith('user-1', { qqSpeech: config })
    expect(JSON.stringify(await response.json())).not.toContain('private-key')
  })
})
