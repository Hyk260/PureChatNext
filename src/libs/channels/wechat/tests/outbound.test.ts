import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMessage = vi.fn()
const sendItem = vi.fn()
const uploadCdnMedia = vi.fn()

vi.mock('@pure/chat-adapter/wechat', () => ({
  MessageItemType: { FILE: 4, IMAGE: 2, TEXT: 1 },
  WechatApiClient: class {
    sendItem = sendItem
    sendMessage = sendMessage
    uploadCdnMedia = uploadCdnMedia
  },
  WechatUploadMediaType: { FILE: 3, IMAGE: 1 },
}))

vi.mock('@/envs/serverDB', () => ({
  serverDBEnv: { KEY_VAULTS_SECRET: 'outbound-test-secret' },
}))

import { encryptContextToken, encryptCredentials } from '../encrypt'
import {
  canSendWechatDevOutbound,
  sendWechatOutbound,
  sendWechatOutboundText,
  WechatOutboundError,
} from '../outbound'

describe('canSendWechatDevOutbound', () => {
  it('allows only the QR-authorized wechat user on the caller binding', () => {
    expect(canSendWechatDevOutbound('owner@im.wechat', 'owner@im.wechat')).toBe(true)
    expect(canSendWechatDevOutbound('owner@im.wechat', 'other@im.wechat')).toBe(false)
    expect(canSendWechatDevOutbound('', 'owner@im.wechat')).toBe(false)
  })
})

describe('sendWechatOutbound', () => {
  beforeEach(() => {
    sendMessage.mockReset()
    sendItem.mockReset()
    uploadCdnMedia.mockReset()
    sendMessage.mockResolvedValue({ ret: 0 })
    sendItem.mockResolvedValue({ ret: 0 })
    uploadCdnMedia.mockResolvedValue({
      aesKey: 'aes',
      cipherSize: 16,
      encryptQueryParam: 'q',
    })
  })

  it('decrypts credentials/token and sends via WechatApiClient.sendMessage', async () => {
    await sendWechatOutboundText({
      credentials: encryptCredentials({ botId: 'bot-1', botToken: 'token-1', userId: 'owner' }),
      encryptedContextToken: encryptContextToken('ctx-abc'),
      text: 'hello from web',
      toUserId: 'user@im.wechat',
    })

    expect(sendMessage).toHaveBeenCalledWith('user@im.wechat', 'hello from web', 'ctx-abc')
  })

  it('sends text then image/file attachments', async () => {
    await sendWechatOutbound({
      credentials: encryptCredentials({ botId: 'bot-1', botToken: 'token-1', userId: 'owner' }),
      encryptedContextToken: encryptContextToken('ctx-abc'),
      media: [
        { buffer: Buffer.from('img'), fileName: 'a.png', mimeType: 'image/png' },
        { buffer: Buffer.from('doc'), fileName: 'b.pdf', mimeType: 'application/pdf' },
      ],
      text: 'see files',
      toUserId: 'user@im.wechat',
    })

    expect(sendMessage).toHaveBeenCalledWith('user@im.wechat', 'see files', 'ctx-abc')
    expect(uploadCdnMedia).toHaveBeenCalledTimes(2)
    expect(sendItem).toHaveBeenCalledTimes(2)
    expect(sendItem.mock.calls[0]?.[1]).toMatchObject({ type: 2 })
    expect(sendItem.mock.calls[1]?.[1]).toMatchObject({
      file_item: { file_name: 'b.pdf' },
      type: 4,
    })
  })

  it('throws when context token is empty after decrypt', async () => {
    await expect(
      sendWechatOutboundText({
        credentials: encryptCredentials({ botId: 'bot-1', botToken: 'token-1', userId: 'owner' }),
        encryptedContextToken: encryptContextToken('   '),
        text: 'hello',
        toUserId: 'user@im.wechat',
      })
    ).rejects.toBeInstanceOf(WechatOutboundError)

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('throws when both text and media are empty', async () => {
    await expect(
      sendWechatOutbound({
        credentials: encryptCredentials({ botId: 'bot-1', botToken: 'token-1', userId: 'owner' }),
        encryptedContextToken: encryptContextToken('ctx'),
        toUserId: 'user@im.wechat',
      })
    ).rejects.toBeInstanceOf(WechatOutboundError)
  })
})
