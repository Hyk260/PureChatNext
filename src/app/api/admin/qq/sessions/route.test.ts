// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptCredentials: vi.fn(),
  findByUserAndPlatform: vi.fn(),
  findCredentialsByIds: vi.fn(),
  listSessionsByPlatform: vi.fn(),
}))

vi.mock('@pure/database/models/agent', () => ({
  AgentModel: class {
    findVisibleById = vi.fn(async () => ({ title: 'Agent' }))
  },
}))
vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {
    findByUserAndPlatform = mocks.findByUserAndPlatform
    findCredentialsByIds = mocks.findCredentialsByIds
  },
  QQ_PLATFORM: 'qq',
}))
vi.mock('@pure/database/models/channelEvent', () => ({
  ChannelEventModel: class {
    listSessionsByPlatform = mocks.listSessionsByPlatform
  },
}))
vi.mock('@/envs/gateway', () => ({ gatewayEnv: { CHANNEL_GATEWAY_ENABLED: true } }))
vi.mock('@/libs/auth/get-session-user', () => ({
  withAdmin: (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) =>
    (request: NextRequest) => handler(request, { userId: 'admin-1' }),
}))
vi.mock('@/libs/channels/qq', () => ({
  decryptCredentials: mocks.decryptCredentials,
}))

import { GET } from './route'

function createSession(overrides: Record<string, unknown>) {
  return {
    activeAgentId: null,
    applicationId: 'qq-app',
    bindingAgentId: 'agent-1',
    bindingEnabled: true,
    bindingId: 'binding-owner',
    bindingLastErrorCode: null,
    bindingLastErrorMessage: null,
    bindingLastHeartbeatAt: new Date(),
    bindingNeedsRebind: false,
    bindingRuntimeStatus: 'online',
    bindingUpdatedAt: new Date(),
    bindingUserId: 'user-1',
    conversationVersion: 1,
    externalUserId: 'owner-external',
    externalUserName: 'Owner',
    id: 'session-owner',
    lastActiveAt: new Date(),
    threadType: 'c2c',
    ...overrides,
  }
}

describe('GET /api/admin/qq/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByUserAndPlatform.mockResolvedValue({ agentId: 'agent-1', id: 'binding-owner' })
    mocks.findCredentialsByIds.mockResolvedValue([
      { credentials: 'owner-creds', id: 'binding-owner' },
      { credentials: 'other-creds', id: 'binding-other' },
    ])
    mocks.decryptCredentials.mockImplementation((credentials: string) => ({
      connectionMode: credentials === 'other-creds' ? 'webhook' : 'websocket',
    }))
    mocks.listSessionsByPlatform.mockResolvedValue([
      createSession({}),
      createSession({
        bindingId: 'binding-other',
        bindingLastHeartbeatAt: null,
        bindingUserId: 'user-2',
        id: 'session-other',
      }),
    ])
  })

  it('resolves the status from each binding and keeps send access to the admin binding', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/qq/sessions'))
    const data = (await response.json()) as { sessions: Array<Record<string, unknown>> }

    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.findCredentialsByIds).toHaveBeenCalledWith(['binding-owner', 'binding-other'])
    expect(data.sessions[0]).toMatchObject({
      canSend: true,
      connected: true,
      connectionMode: 'websocket',
      isOwnBinding: true,
      runtimeStatus: 'online',
    })
    expect(data.sessions[1]).toMatchObject({
      canSend: false,
      connected: true,
      connectionMode: 'webhook',
      isOwnBinding: false,
      runtimeStatus: 'online',
    })
  })
})
