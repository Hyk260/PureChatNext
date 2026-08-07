import { describe, expect, it } from 'vitest'

import type { WechatDevMessage } from './wechatConversationApi'
import {
  getActiveWechatEventIds,
  hasActiveWechatMessages,
  mergeWechatDevMessages,
  nextWechatMessagePollDelay,
} from './wechatConversationPolling'

function message(id: string, createdAt: string, status = 'completed'): WechatDevMessage {
  return { createdAt, eventId: id.split(':')[0]!, id, role: 'user', status, text: id }
}

describe('wechat conversation delta helpers', () => {
  it('merges, updates, deduplicates, and sorts delta messages', () => {
    const current = [
      message('event-b:user', '2026-08-07T00:00:02.000Z'),
      message('event-a:user', '2026-08-07T00:00:01.000Z', 'pending'),
    ]
    const updated = { ...message('event-a:user', '2026-08-07T00:00:01.000Z'), text: 'updated' }
    const result = mergeWechatDevMessages(current, [
      updated,
      updated,
      { ...message('event-c:assistant', '2026-08-07T00:00:02.000Z'), role: 'assistant' },
      message('event-c:user', '2026-08-07T00:00:02.000Z'),
    ])
    expect(result.changed).toBe(true)
    expect(result.messages.map(({ id }) => id)).toEqual([
      'event-a:user',
      'event-b:user',
      'event-c:user',
      'event-c:assistant',
    ])
    expect(result.messages[0]?.text).toBe('updated')
  })

  it('backs off unchanged responses and stays active while pending', () => {
    expect(nextWechatMessagePollDelay(2_000, { changed: false, pending: false })).toBe(5_000)
    expect(nextWechatMessagePollDelay(5_000, { changed: false, pending: false })).toBe(10_000)
    expect(nextWechatMessagePollDelay(10_000, { changed: false, pending: false })).toBe(15_000)
    expect(nextWechatMessagePollDelay(15_000, { changed: false, pending: false })).toBe(15_000)
    expect(nextWechatMessagePollDelay(15_000, { changed: true, pending: false })).toBe(2_000)
    const pending = [message('event-a:user', '2026-08-07T00:00:00.000Z', 'processing')]
    expect(hasActiveWechatMessages(pending)).toBe(true)
    expect(getActiveWechatEventIds([...pending, { ...pending[0]!, id: 'event-a:assistant' }])).toEqual(['event-a'])
    expect(nextWechatMessagePollDelay(15_000, { changed: false, pending: true })).toBe(2_000)
  })

  it('observes watched event completion and a newly available assistant response', () => {
    const pending = message('event-a:user', '2026-08-07T00:00:00.000Z', 'processing')
    const completed = { ...pending, status: 'completed' }
    const assistant = {
      ...completed,
      id: 'event-a:assistant',
      role: 'assistant' as const,
      text: 'done',
    }

    const result = mergeWechatDevMessages([pending], [completed, assistant])

    expect(result.changed).toBe(true)
    expect(result.messages).toEqual([completed, assistant])
    expect(hasActiveWechatMessages(result.messages)).toBe(false)
  })
})
