import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendMessage = vi.fn()

vi.mock('@pure/chat-adapter/wechat', () => ({
  WechatApiClient: class {
    sendMessage = sendMessage
  },
}))

vi.mock('@/envs/serverDB', () => ({
  serverDBEnv: { KEY_VAULTS_SECRET: 'outbound-test-secret' },
}))

import { encryptContextToken, encryptCredentials } from '../encrypt'
import { canSendWechatDevOutbound, sendWechatOutboundText, WechatOutboundError } from '../outbound'

describe('canSendWechatDevOutbound', () => {
  it('allows only the QR-authorized wechat user on the caller binding', () => {
    expect(canSendWechatDevOutbound('owner@im.wechat', 'owner@im.wechat')).toBe(true)
    expect(canSendWechatDevOutbound('owner@im.wechat', 'other@im.wechat')).toBe(false)
    expect(canSendWechatDevOutbound('', 'owner@im.wechat')).toBe(false)
  })
})

describe('sendWechatOutboundText', () => {
  beforeEach(() => {
    sendMessage.mockReset()
    sendMessage.mockResolvedValue({ ret: 0 })
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
})
