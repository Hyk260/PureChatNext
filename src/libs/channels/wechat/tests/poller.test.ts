import { MessageItemType, MessageState, MessageType } from '@pure/chat-adapter/wechat'
import type { WechatRawMessage } from '@pure/chat-adapter/wechat'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@pure/database/models/channelBinding', () => ({
  ChannelBindingModel: class {},
  WECHAT_PLATFORM: 'wechat',
}))
vi.mock('@pure/database/models/channelEvent', () => ({ ChannelEventModel: class {} }))
vi.mock('@/envs/serverDB', () => ({ serverDBEnv: { KEY_VAULTS_SECRET: 'poller-test-secret' } }))

import { formatWechatInboundLog, rawMessageToEvent } from '../poller'

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

  it('persists image messages with media metadata and image kind', () => {
    const event = rawMessageToEvent(
      'binding-1',
      message({
        item_list: [
          {
            image_item: {
              aeskey: 'a'.repeat(32),
              media: { encrypt_query_param: 'q' },
              url: 'https://example.com/pic.jpg',
            },
            type: MessageItemType.IMAGE,
          },
        ],
      })
    )
    expect(event).toMatchObject({
      messageKind: 'image',
      platformMessageId: 'client-1',
    })
    expect(JSON.parse(event!.content)).toMatchObject({
      type: 'image',
      url: 'https://example.com/pic.jpg',
      v: 1,
    })
  })

  it('persists file messages with metadata and file kind', () => {
    const event = rawMessageToEvent(
      'binding-1',
      message({
        item_list: [
          {
            file_item: {
              file_name: 'report.pdf',
              len: '2048',
              media: { encrypt_query_param: 'file-q' },
            },
            type: MessageItemType.FILE,
          },
        ],
      })
    )
    expect(event).toMatchObject({
      messageKind: 'file',
      platformMessageId: 'client-1',
    })
    expect(JSON.parse(event!.content)).toMatchObject({
      file_name: 'report.pdf',
      len: '2048',
      type: 'file',
      v: 1,
    })
    expect(formatWechatInboundLog(event!, true)).toContain('内容=[文件]')
  })

  it('detects file_item even when type is missing or mismatched', () => {
    const event = rawMessageToEvent(
      'binding-1',
      message({
        item_list: [
          {
            file_item: { file_name: 'App.vue', len: '128' },
            type: 3 as MessageItemType,
          },
        ],
      })
    )
    expect(event).toMatchObject({ messageKind: 'file' })
    expect(JSON.parse(event!.content)).toMatchObject({ file_name: 'App.vue', type: 'file' })
  })

  it('prefers file over caption text in the same item_list', () => {
    const event = rawMessageToEvent(
      'binding-1',
      message({
        item_list: [
          { text_item: { text: 'see attachment' }, type: MessageItemType.TEXT },
          {
            file_item: { file_name: 'sheet.xlsx', len: '10' },
            type: MessageItemType.FILE,
          },
        ],
      })
    )
    expect(event).toMatchObject({ messageKind: 'file' })
    expect(JSON.parse(event!.content).file_name).toBe('sheet.xlsx')
  })

  it('persists other non-text messages as unsupported instead of dropping them', () => {
    expect(rawMessageToEvent('binding-1', message({ item_list: [{ type: MessageItemType.VOICE }] }))).toMatchObject({
      content: '[unsupported message]',
      messageKind: 'unsupported',
    })
  })

  it('ignores bot and partial generating messages', () => {
    expect(rawMessageToEvent('binding-1', message({ message_type: MessageType.BOT }))).toBeNull()
    expect(rawMessageToEvent('binding-1', message({ message_state: MessageState.GENERATING }))).toBeNull()
  })

  it('logs hashed contacts and keeps message text opt-in', () => {
    const event = rawMessageToEvent('binding-1', message())!
    const safeLog = formatWechatInboundLog(event, false)
    expect(safeLog).toContain('联系人=sha256:')
    expect(safeLog).not.toContain('wechat-owner')
    expect(safeLog).not.toContain('hello')
    expect(formatWechatInboundLog(event, true)).toContain('内容="hello"')
  })
})
