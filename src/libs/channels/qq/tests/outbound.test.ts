import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  decryptCredentials: vi.fn(),
  sendC2CMedia: vi.fn(),
  sendC2CMessage: vi.fn(),
  sendDmsMessage: vi.fn(),
  sendGroupMedia: vi.fn(),
  sendGroupMessage: vi.fn(),
  sendGuildMessage: vi.fn(),
  uploadC2CRichMedia: vi.fn(),
  uploadGroupRichMedia: vi.fn(),
}))

vi.mock('@pure/chat-adapter/qq', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pure/chat-adapter/qq')>()
  return {
    ...actual,
    QQApiClient: class {
      sendC2CMedia = mocks.sendC2CMedia
      sendC2CMessage = mocks.sendC2CMessage
      sendDmsMessage = mocks.sendDmsMessage
      sendGroupMedia = mocks.sendGroupMedia
      sendGroupMessage = mocks.sendGroupMessage
      sendGuildMessage = mocks.sendGuildMessage
      uploadC2CRichMedia = mocks.uploadC2CRichMedia
      uploadGroupRichMedia = mocks.uploadGroupRichMedia
    },
  }
})

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
    mocks.sendC2CMedia.mockReset().mockResolvedValue({ id: 'out-media', timestamp: '2026-01-01T00:00:00Z' })
    mocks.sendGroupMedia.mockReset().mockResolvedValue({ id: 'out-media', timestamp: '2026-01-01T00:00:00Z' })
    mocks.uploadC2CRichMedia.mockReset().mockResolvedValue({ file_info: 'file-info-1' })
    mocks.uploadGroupRichMedia.mockReset().mockResolvedValue({ file_info: 'file-info-1' })
  })

  it('routes c2c threads to sendC2CMessage', async () => {
    await sendQQDevOutbound({
      binding,
      reply: { msgId: 'msg-1', msgSeq: 1 },
      session,
      text: 'hello',
    })
    expect(mocks.sendC2CMessage).toHaveBeenCalledWith('user-1', 'hello', { msgId: 'msg-1', msgSeq: 1 })
  })

  it('routes group threads to sendGroupMessage with a passive reply', async () => {
    await sendQQDevOutbound({
      binding,
      reply: { msgId: 'msg-2', msgSeq: 2 },
      session: groupSession,
      text: 'hello',
    })
    expect(mocks.sendGroupMessage).toHaveBeenCalledWith('group-1', 'hello', { msgId: 'msg-2', msgSeq: 2 })
  })

  it('uploads and sends c2c image attachments with incremented msg_seq', async () => {
    const buffer = Buffer.from('png-bytes')
    await sendQQDevOutbound({
      binding,
      media: [{ buffer, fileName: 'a.png', mimeType: 'image/png' }],
      reply: { msgId: 'msg-3', msgSeq: 1 },
      session,
      text: 'caption',
    })
    expect(mocks.sendC2CMessage).toHaveBeenCalledWith('user-1', 'caption', { msgId: 'msg-3', msgSeq: 1 })
    expect(mocks.uploadC2CRichMedia).toHaveBeenCalledWith('user-1', 1, {
      fileData: buffer.toString('base64'),
    })
    expect(mocks.sendC2CMedia).toHaveBeenCalledWith('user-1', 'file-info-1', { msgId: 'msg-3', msgSeq: 2 })
  })

  it('rejects non-image attachments for group threads', async () => {
    await expect(
      sendQQDevOutbound({
        binding,
        media: [{ buffer: Buffer.from('pdf'), fileName: 'a.pdf', mimeType: 'application/pdf' }],
        reply: { msgId: 'msg-4', msgSeq: 1 },
        session: groupSession,
        text: '',
      })
    ).rejects.toThrow('群聊仅支持发送图片附件')
  })
})
