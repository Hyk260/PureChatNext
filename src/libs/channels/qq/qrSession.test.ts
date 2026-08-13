// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bindQQCredentials: vi.fn(),
  callbacks: undefined as
    | {
        onFailure: (error: Error) => void
        onQrDisplayed?: (url: string) => void
        onSuccess: (credentials: Array<{ appId: string; appSecret: string }>) => void
      }
    | undefined,
  stop: vi.fn(),
}))

vi.mock('@tencent-connect/qqbot-connector', () => ({
  startQrConnect: vi.fn((callbacks) => {
    mocks.callbacks = callbacks
    queueMicrotask(() => callbacks.onQrDisplayed?.('https://q.qq.com/qr/one'))
    return mocks.stop
  }),
}))
vi.mock('./binding', () => ({ bindQQCredentials: mocks.bindQQCredentials }))

import {
  cancelQQQrSession,
  clearQQQrSessionsForTests,
  completeQQQrSession,
  getQQQrSessionStatus,
  startQQQrSession,
} from './qrSession'

describe('QQ QR sessions', () => {
  beforeEach(() => {
    clearQQQrSessionsForTests()
    vi.clearAllMocks()
    mocks.callbacks = undefined
    mocks.bindQQCredentials.mockResolvedValue({ applicationId: 'app-1', ok: true })
  })

  it('isolates sessions by authenticated user', async () => {
    const started = await startQQQrSession('user-1', 'agent-1')

    expect(started).toMatchObject({ qrCodeUrl: 'https://q.qq.com/qr/one', qrVersion: 1, status: 'waiting' })
    expect(getQQQrSessionStatus('user-2', started.sessionId)).toBeUndefined()
    expect(cancelQQQrSession('user-2', started.sessionId)).toBe(false)
  })

  it('cancels the previous session when the same user starts again', async () => {
    const first = await startQQQrSession('user-1', 'agent-1')
    const second = await startQQQrSession('user-1', 'agent-1')

    expect(mocks.stop).toHaveBeenCalledTimes(1)
    expect(getQQQrSessionStatus('user-1', first.sessionId)).toBeUndefined()
    expect(getQQQrSessionStatus('user-1', second.sessionId)?.status).toBe('waiting')
  })

  it('automatically binds a single returned bot without exposing its secret', async () => {
    const started = await startQQQrSession('user-1', 'agent-1')
    mocks.callbacks?.onSuccess([{ appId: 'app-1', appSecret: 'top-secret' }])
    await vi.waitFor(() => expect(getQQQrSessionStatus('user-1', started.sessionId)?.status).toBe('connected'))

    expect(mocks.bindQQCredentials).toHaveBeenCalledWith({
      agentId: 'agent-1',
      appId: 'app-1',
      appSecret: 'top-secret',
      connectionMode: 'websocket',
      userId: 'user-1',
    })
    expect(JSON.stringify(getQQQrSessionStatus('user-1', started.sessionId))).not.toContain('top-secret')
  })

  it('requires an explicit selection when multiple bots are returned', async () => {
    const started = await startQQQrSession('user-1', 'agent-1')
    mocks.callbacks?.onSuccess([
      { appId: 'app-1', appSecret: 'secret-1' },
      { appId: 'app-2', appSecret: 'secret-2' },
    ])

    expect(getQQQrSessionStatus('user-1', started.sessionId)).toEqual({ appIds: ['app-1', 'app-2'], status: 'selecting' })
    await expect(completeQQQrSession('user-1', started.sessionId, 'unknown')).rejects.toThrow('请选择')
    await completeQQQrSession('user-1', started.sessionId, 'app-2')
    expect(mocks.bindQQCredentials).toHaveBeenCalledWith(expect.objectContaining({ appId: 'app-2', appSecret: 'secret-2' }))
  })

  it('publishes a sanitized connector failure', async () => {
    const started = await startQQQrSession('user-1', 'agent-1')
    mocks.callbacks?.onFailure(new Error('internal upstream detail'))

    expect(getQQQrSessionStatus('user-1', started.sessionId)).toEqual({
      message: 'QQ 扫码连接失败，请重试',
      status: 'failed',
    })
  })
})
