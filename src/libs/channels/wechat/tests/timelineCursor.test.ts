import { describe, expect, it } from 'vitest'

import {
  advanceWechatTimelineCursor,
  compareWechatTimelineCursors,
  encodeWechatTimelineCursor,
  parseWechatTimelineCursor,
} from '../timelineCursor'

describe('wechat timeline cursor', () => {
  it('orders equal timestamps by event id', () => {
    const createdAt = new Date('2026-08-07T01:02:03.456Z')
    expect(compareWechatTimelineCursors({ createdAt, id: 'event-a' }, { createdAt, id: 'event-b' })).toBeLessThan(0)
    expect(compareWechatTimelineCursors({ createdAt, id: 'event-b' }, { createdAt, id: 'event-a' })).toBeGreaterThan(0)
  })

  it('round-trips the opaque API cursor', () => {
    const cursor = { createdAt: new Date('2026-08-07T01:02:03.456Z'), id: 'event:with/slashes' }
    expect(parseWechatTimelineCursor(encodeWechatTimelineCursor(cursor))).toEqual(cursor)
  })

  it('supports the empty-timeline floor cursor', () => {
    const cursor = { createdAt: new Date(0), id: '' }
    expect(parseWechatTimelineCursor(encodeWechatTimelineCursor(cursor))).toEqual(cursor)
  })

  it('does not regress when watched events are older than the current cursor', () => {
    const current = { createdAt: new Date('2026-08-07T01:02:03.456Z'), id: 'event-b' }
    const result = advanceWechatTimelineCursor(current, [
      { createdAt: new Date('2026-08-07T01:02:02.000Z'), id: 'watched-event' },
      { createdAt: new Date('2026-08-07T01:02:03.456Z'), id: 'event-a' },
    ])
    expect(result).toBe(current)
  })

  it('advances deterministically by id for equal timestamps', () => {
    const createdAt = new Date('2026-08-07T01:02:03.456Z')
    expect(
      advanceWechatTimelineCursor({ createdAt, id: 'event-a' }, [
        { createdAt, id: 'event-c' },
        { createdAt, id: 'event-b' },
      ])
    ).toEqual({ createdAt, id: 'event-c' })
  })

  it.each(['', 'not-base64-json', Buffer.from('{}').toString('base64url')])(
    'rejects invalid API cursor %j',
    (value) => {
      expect(parseWechatTimelineCursor(value)).toBeNull()
    }
  )
})
