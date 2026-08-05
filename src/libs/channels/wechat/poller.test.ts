import { MessageItemType, MessageState, MessageType } from '@pure/chat-adapter/wechat'
import type { WechatRawMessage } from '@pure/chat-adapter/wechat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {},
  WECHAT_PLATFORM: 'wechat',
}))
vi.mock('@pure/database/models/channelEvent', () => ({ ChannelEventModel: class {} }))
vi.mock('@/envs/serverDB', () => ({ serverDBEnv: { KEY_VAULTS_SECRET: 'poller-test-secret' } }))

import { rawMessageToEvent } from './poller'

const message = (patch: Partial<WechatRawMessage> = {}): WechatRawMessage => ({
  client_id: 'client-1',
  context_token: 'context-secret',
  create_time_ms: Date.now(),
  from_user_id: 'wechat-owner',
  item_list: [{ text_item: { text: 'hello' }, type: MessageItemType.TEXT }],
  message_id: 123,
  message_state: MessageState.FINISH,
  message_type: MessageType.USER,
  to_user_id: 'bot',
  ...patch,
})

describe('rawMessageToEvent', () => {
  it('uses the stable client id, encrypts context and classifies commands', () => {
    const event = rawMessageToEvent(
      'binding-1',
      message({ item_list: [{ text_item: { text: '/agents 2' }, type: MessageItemType.TEXT }] })
    )
    expect(event).toMatchObject({
      content: '/agents 2',
      externalUserId: 'wechat-owner',
      messageKind: 'command',
      platformMessageId: 'client-1',
    })
    expect(event?.encryptedContextToken).not.toContain('context-secret')
  })

  it('persists non-text messages as unsupported instead of dropping them', () => {
    expect(rawMessageToEvent('binding-1', message({ item_list: [{ type: MessageItemType.IMAGE }] }))).toMatchObject({
      content: '[unsupported message]',
      messageKind: 'unsupported',
    })
  })

  it('ignores bot and partial generating messages', () => {
    expect(rawMessageToEvent('binding-1', message({ message_type: MessageType.BOT }))).toBeNull()
    expect(rawMessageToEvent('binding-1', message({ message_state: MessageState.GENERATING }))).toBeNull()
  })
})
