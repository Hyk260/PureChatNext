// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const getUpdates = vi.fn()

vi.mock('@pure/chat-adapter/wechat', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pure/chat-adapter/wechat')>()
  return {
    ...actual,
    WechatApiClient: class {
      getUpdates = getUpdates
    },
  }
})
vi.mock('../encrypt', () => ({
  decryptCredentials: () => ({ botId: 'bot', botToken: 'token', userId: 'user' }),
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {},
  WECHAT_PLATFORM: 'wechat',
}))
vi.mock('@pure/database/models/channelEvent', () => ({ ChannelEventModel: class {} }))
vi.mock('@/envs/serverDB', () => ({ serverDBEnv: { KEY_VAULTS_SECRET: 'poller-test-secret' } }))

import type { ChannelBindingItem } from '@pure/database/schemas/channel'

import { pollWechatUpdates } from '../poller'

function binding(): ChannelBindingItem {
  const now = new Date('2026-08-12T00:00:00Z')
  return {
    accessedAt: now,
    agentId: 'agent-1',
    applicationId: 'app-1',
    createdAt: now,
    credentials: 'encrypted',
    enabled: true,
    gatewayLeaseExpiresAt: null,
    gatewayLeaseOwner: null,
    id: 'binding-1',
    lastActiveAt: null,
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastHeartbeatAt: null,
    model: null,
    needsRebind: false,
    pendingWelcome: false,
    platform: 'wechat',
    pollCursor: null,
    provider: null,
    runtimeStatus: 'starting',
    updatedAt: now,
    userId: 'user-1',
  }
}

describe('pollWechatUpdates', () => {
  afterEach(() => {
    getUpdates.mockReset()
  })

  it('retries when getUpdates times out with AbortError', async () => {
    getUpdates
      .mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }))
      .mockResolvedValue({ get_updates_buf: 'cursor-1', msgs: [] })

    const ac = new AbortController()
    const onReady = vi.fn(() => ac.abort())
    const onStatus = vi.fn()
    await pollWechatUpdates(binding(), {
      forwardBatch: async () => undefined,
      onReady,
      onStatus,
      signal: ac.signal,
    })

    expect(onReady).toHaveBeenCalledOnce()
    expect(onStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'degraded' }))
    expect(onStatus).toHaveBeenCalledWith({ status: 'online' })
  })

  it('exits when the client abort signal fires', async () => {
    const ac = new AbortController()
    getUpdates.mockImplementation(async (cursor?: string, signal?: AbortSignal) => {
      await new Promise<void>((_, reject) => {
        signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })
      return { get_updates_buf: cursor, msgs: [] }
    })

    const onReady = vi.fn()
    const loop = pollWechatUpdates(binding(), {
      forwardBatch: async () => undefined,
      onReady,
      signal: ac.signal,
    })
    ac.abort()
    await loop
    expect(onReady).not.toHaveBeenCalled()
  })
})
