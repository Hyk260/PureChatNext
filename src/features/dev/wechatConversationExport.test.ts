import { describe, expect, it } from 'vitest'

import type { WechatDevMessage, WechatDevSession } from './wechatConversationApi'
import { createWechatConversationExport, createWechatExportFilename } from './wechatConversationExport'

const session = {
  agentId: 'agent-1',
  agentTitle: '助手',
  conversationVersion: 2,
  externalUserId: 'wx-user',
  externalUserName: '测试 / 用户',
  id: 'session-1',
} as WechatDevSession

const messages: WechatDevMessage[] = [
  {
    createdAt: '2026-08-07T00:00:00.000Z',
    eventId: 'event-1',
    id: 'event-1:user',
    messageKind: 'text',
    role: 'user',
    source: 'user',
    status: 'completed',
    text: '测试\n"引号"',
  },
  {
    createdAt: '2026-08-07T00:00:01.000Z',
    durationMs: 321,
    eventId: 'event-1',
    id: 'event-1:assistant',
    messageKind: 'text',
    model: 'gpt-test',
    provider: 'openai',
    role: 'assistant',
    source: 'model',
    status: 'completed',
    text: '回答',
  },
  {
    createdAt: '2026-08-07T00:00:02.000Z',
    eventId: 'event-2',
    id: 'event-2:assistant',
    messageKind: 'outbound',
    role: 'assistant',
    source: 'manual',
    status: 'completed',
    text: '手工代发',
  },
  {
    createdAt: '2026-08-07T00:00:03.000Z',
    eventId: 'event-3',
    id: 'event-3:user',
    messageKind: 'image',
    role: 'user',
    source: 'user',
    status: 'completed',
    text: '[图片]',
  },
]

describe('WeChat conversation export', () => {
  it('creates a metadata-rich export and excludes manual outbound messages', () => {
    const result = createWechatConversationExport('full', messages, session, '2026-08-07T01:00:00.000Z')

    expect(result).toMatchObject({ exportedAt: '2026-08-07T01:00:00.000Z', version: '1.0' })
    expect('messages' in result && result.messages).toHaveLength(3)
    expect('messages' in result && result.messages[1]).toMatchObject({
      durationMs: 321,
      model: 'gpt-test',
      provider: 'openai',
      source: 'model',
    })
  })

  it('creates strict OpenAI-compatible text messages', () => {
    expect(createWechatConversationExport('openai', messages, session)).toEqual([
      { content: '测试\n"引号"', role: 'user' },
      { content: '回答', role: 'assistant' },
    ])
  })

  it('creates a filesystem-safe filename', () => {
    expect(createWechatExportFilename(session, new Date('2026-08-07T01:02:03.000Z'))).toBe(
      'wechat-测试-用户-v2-2026-08-07T01-02-03.json'
    )
  })
})
