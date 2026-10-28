import { describe, expect, it } from 'vitest'

import type { ChannelPollMessage } from './channelConversationPolling'
import {
  getActiveChannelEventIds,
  hasActiveChannelMessages,
  mergeChannelMessages,
  nextChannelMessagePollDelay,
} from './channelConversationPolling'

function message(id: string, createdAt: string, status = 'completed'): ChannelPollMessage & { text: string } {
  return { createdAt, eventId: id.split(':')[0]!, id, role: 'user', status, text: id }
}

describe('channel conversation delta helpers', () => {
  it('merges, updates, deduplicates, and sorts delta messages', () => {
    const current = [
      message('event-b:user', '2026-08-07T00:00:02.000Z'),
      message('event-a:user', '2026-08-07T00:00:01.000Z', 'pending'),
    ]
    const updated = { ...message('event-a:user', '2026-08-07T00:00:01.000Z'), text: 'updated' }
    const result = mergeChannelMessages(current, [
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
    expect(nextChannelMessagePollDelay(2_000, { changed: false, pending: false })).toBe(5_000)
    expect(nextChannelMessagePollDelay(5_000, { changed: false, pending: false })).toBe(10_000)
    expect(nextChannelMessagePollDelay(10_000, { changed: false, pending: false })).toBe(15_000)
    expect(nextChannelMessagePollDelay(15_000, { changed: false, pending: false })).toBe(15_000)
    expect(nextChannelMessagePollDelay(15_000, { changed: true, pending: false })).toBe(2_000)
    const pending = [message('event-a:user', '2026-08-07T00:00:00.000Z', 'processing')]
    expect(hasActiveChannelMessages(pending)).toBe(true)
    expect(getActiveChannelEventIds([...pending, { ...pending[0]!, id: 'event-a:assistant' }])).toEqual(['event-a'])
    expect(nextChannelMessagePollDelay(15_000, { changed: false, pending: true })).toBe(2_000)
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

    const result = mergeChannelMessages([pending], [completed, assistant])

    expect(result.changed).toBe(true)
    expect(result.messages).toEqual([completed, assistant])
    expect(hasActiveChannelMessages(result.messages)).toBe(false)
  })
})
