// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  countFailedByBindings: vi.fn(),
  decryptCredentials: vi.fn(),
  findByUserAndPlatform: vi.fn(),
  isWechatGatewaySupported: vi.fn(() => true),
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
  },
  WECHAT_PLATFORM: 'wechat',
}))
vi.mock('@pure/database/models/channelEvent', () => ({
  ChannelEventModel: class {
    countFailedByBindings = mocks.countFailedByBindings
    listSessionsByPlatform = mocks.listSessionsByPlatform
  },
}))
vi.mock('@/libs/auth/get-session-user', () => ({
  withAdmin: (handler: (request: NextRequest, context: { userId: string }) => Promise<Response>) =>
    (request: NextRequest) => handler(request, { userId: 'admin-1' }),
}))
vi.mock('@/libs/channels/wechat', () => ({ isWechatGatewaySupported: mocks.isWechatGatewaySupported }))
vi.mock('@/libs/channels/wechat/encrypt', () => ({ decryptCredentials: mocks.decryptCredentials }))
vi.mock('@/libs/channels/wechat/outbound', () => ({
  canSendWechatDevOutbound: (ownerId: string, sessionId: string) => ownerId === sessionId,
}))

import { GET } from './route'

function createSession(overrides: Record<string, unknown>) {
  return {
    activeAgentId: null,
    applicationId: 'wechat-app',
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
    threadType: null,
    ...overrides,
  }
}

describe('GET /api/admin/wechat/sessions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.findByUserAndPlatform.mockResolvedValue({
      agentId: 'agent-1',
      credentials: 'encrypted-owner',
      enabled: true,
      id: 'binding-owner',
      needsRebind: false,
    })
    mocks.decryptCredentials.mockReturnValue({ userId: 'owner-external' })
    mocks.listSessionsByPlatform.mockResolvedValue([
      createSession({}),
      createSession({
        bindingEnabled: false,
        bindingId: 'binding-other',
        bindingLastHeartbeatAt: null,
        bindingRuntimeStatus: 'online',
        bindingUserId: 'user-2',
        externalUserId: 'other-external',
        id: 'session-other',
      }),
    ])
    mocks.countFailedByBindings.mockResolvedValue(new Map([
      ['binding-owner', 2],
      ['binding-other', 0],
    ]))
  })

  it('uses each selected session binding for status and retry capability', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/wechat/sessions'))
    const data = (await response.json()) as { sessions: Array<Record<string, unknown>> }

    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(mocks.countFailedByBindings).toHaveBeenCalledWith(['binding-owner', 'binding-other'])
    expect(data.sessions[0]).toMatchObject({
      canSend: true,
      connected: true,
      failedEventCount: 2,
      isOwnBinding: true,
      runtimeStatus: 'degraded',
    })
    expect(data.sessions[1]).toMatchObject({
      canSend: false,
      connected: false,
      failedEventCount: 0,
      isOwnBinding: false,
      runtimeStatus: 'offline',
    })
  })
})
