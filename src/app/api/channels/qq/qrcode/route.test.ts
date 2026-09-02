// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cancelQQQrSession: vi.fn(),
  findVisibleById: vi.fn(),
  gatewayEnabled: true,
  completeQQQrSession: vi.fn(),
  getQQQrSessionStatus: vi.fn(),
  startQQQrSession: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) => (request: NextRequest) =>
      handler(request, { userId: 'user-1' }),
}))
vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    findVisibleById = mocks.findVisibleById
  },
}))
vi.mock('@/envs/gateway', () => ({
  gatewayEnv: {
    get CHANNEL_GATEWAY_ENABLED() {
      return mocks.gatewayEnabled
    },
  },
}))
vi.mock('@/libs/channels/qq/qrSession', () => ({
  cancelQQQrSession: mocks.cancelQQQrSession,
  completeQQQrSession: mocks.completeQQQrSession,
  getQQQrSessionStatus: mocks.getQQQrSessionStatus,
  startQQQrSession: mocks.startQQQrSession,
}))
vi.mock('@/libs/channels/qq/binding', () => ({
  QQBindingError: class QQBindingError extends Error {
    constructor(message: string, public readonly status = 400) {
      super(message)
    }
  },
}))

import { DELETE, GET, POST } from './route'

const postRequest = (body: unknown) => new NextRequest('http://localhost/api/channels/qq/qrcode', {
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
})

describe('/api/channels/qq/qrcode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.gatewayEnabled = true
    mocks.findVisibleById.mockResolvedValue({ id: 'agent-1' })
    mocks.completeQQQrSession.mockResolvedValue({ applicationId: 'app-1', ok: true })
    mocks.getQQQrSessionStatus.mockReturnValue({ qrCodeUrl: 'https://q.qq.com/qr', qrVersion: 1, status: 'waiting' })
    mocks.startQQQrSession.mockResolvedValue({
      qrCodeUrl: 'https://q.qq.com/qr',
      qrVersion: 1,
      sessionId: 'session-1',
      status: 'waiting',
    })
  })

  it('starts a QR session for a visible agent', async () => {
    const request = postRequest({ agentId: 'agent-1' })
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mocks.startQQQrSession).toHaveBeenCalledWith('user-1', 'agent-1', undefined, request.signal)
  })

  it('forwards the selected channel model into the QR session', async () => {
    const request = postRequest({ agentId: 'agent-1', model: 'gpt-5.4-mini', provider: 'openai' })
    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mocks.startQQQrSession).toHaveBeenCalledWith(
      'user-1',
      'agent-1',
      {
        model: 'gpt-5.4-mini',
        provider: 'openai',
      },
      request.signal
    )
  })

  it('rejects QR login when the persistent gateway is unavailable', async () => {
    mocks.gatewayEnabled = false
    const response = await POST(postRequest({ agentId: 'agent-1' }))

    expect(response.status).toBe(409)
    expect(mocks.startQQQrSession).not.toHaveBeenCalled()
  })

  it('rejects an agent that is not visible to the current user', async () => {
    mocks.findVisibleById.mockResolvedValue(null)
    const response = await POST(postRequest({ agentId: 'other-agent' }))

    expect(response.status).toBe(404)
  })

  it('reads status from the same route module that created the session', async () => {
    const response = await GET(new NextRequest('http://localhost/api/channels/qq/qrcode?sessionId=session-1'))

    expect(response.status).toBe(200)
    expect(mocks.getQQQrSessionStatus).toHaveBeenCalledWith('user-1', 'session-1')
  })

  it('completes a multi-bot QR selection through the same route', async () => {
    const response = await POST(postRequest({ action: 'complete', appId: 'app-1', sessionId: 'session-1' }))

    expect(response.status).toBe(200)
    expect(mocks.completeQQQrSession).toHaveBeenCalledWith('user-1', 'session-1', 'app-1')
  })

  it('cancels a session without revealing whether another user owns it', async () => {
    const response = await DELETE(new NextRequest('http://localhost/api/channels/qq/qrcode?sessionId=session-1', { method: 'DELETE' }))

    expect(response.status).toBe(200)
    expect(mocks.cancelQQQrSession).toHaveBeenCalledWith('user-1', 'session-1')
  })
})
