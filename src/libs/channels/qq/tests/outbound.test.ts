import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptCredentials: vi.fn(),
  sendC2CMessage: vi.fn(),
  sendDmsMessage: vi.fn(),
  sendGroupMessage: vi.fn(),
  sendGuildMessage: vi.fn(),
}))

vi.mock('@pure/chat-adapter/qq', () => ({
  QQApiClient: class {
    sendC2CMessage = mocks.sendC2CMessage
    sendDmsMessage = mocks.sendDmsMessage
    sendGroupMessage = mocks.sendGroupMessage
    sendGuildMessage = mocks.sendGuildMessage
  },
}))

vi.mock('../encrypt', () => ({
  decryptCredentials: mocks.decryptCredentials,
}))

import { canSendQQDevOutbound, sendQQDevOutbound } from '../outbound'

const binding = {
  credentials: 'encrypted',
  enabled: true,
  id: 'binding-1',
  needsRebind: false,
} as never

const session = {
  bindingId: 'binding-1',
  externalUserId: 'qq:c2c:user-1',
  id: 'session-1',
} as never

const disabledBinding = {
  credentials: 'encrypted',
  enabled: false,
  id: 'binding-1',
  needsRebind: false,
} as never

const otherSession = {
  bindingId: 'other',
  externalUserId: 'qq:c2c:user-1',
  id: 'session-1',
} as never

const groupSession = {
  bindingId: 'binding-1',
  externalUserId: 'qq:group:group-1',
  id: 'session-2',
} as never

describe('canSendQQDevOutbound', () => {
  it('allows an enabled own binding only', () => {
    expect(canSendQQDevOutbound(binding, session)).toBe(true)
    expect(canSendQQDevOutbound(disabledBinding, session)).toBe(false)
    expect(canSendQQDevOutbound(binding, otherSession)).toBe(false)
  })
})

describe('sendQQDevOutbound', () => {
  beforeEach(() => {
    mocks.decryptCredentials.mockReset().mockReturnValue({
      appId: 'app-1',
      appSecret: 'secret-1',
      connectionMode: 'websocket',
    })
    mocks.sendC2CMessage.mockReset().mockResolvedValue({ id: 'out-1', timestamp: '2026-01-01T00:00:00Z' })
    mocks.sendDmsMessage.mockReset().mockResolvedValue({ id: 'out-1', timestamp: '2026-01-01T00:00:00Z' })
    mocks.sendGroupMessage.mockReset().mockResolvedValue({ id: 'out-1', timestamp: '2026-01-01T00:00:00Z' })
    mocks.sendGuildMessage.mockReset().mockResolvedValue({ id: 'out-1', timestamp: '2026-01-01T00:00:00Z' })
  })

  it('routes c2c threads to sendC2CMessage', async () => {
    await sendQQDevOutbound({ binding, session, text: 'hello' })
    expect(mocks.sendC2CMessage).toHaveBeenCalledWith('user-1', 'hello')
  })

  it('routes group threads to sendGroupMessage', async () => {
    await sendQQDevOutbound({
      binding,
      session: groupSession,
      text: 'hello',
    })
    expect(mocks.sendGroupMessage).toHaveBeenCalledWith('group-1', 'hello')
  })
})
