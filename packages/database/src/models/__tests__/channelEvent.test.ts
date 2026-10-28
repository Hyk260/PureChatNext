// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import type { ChatDatabase } from '../../type'
import { ChannelEventModel } from '../channelEvent'
import { channelEvents, channelSessions } from '../../schemas/channel'
import type { ChannelEventItem } from '../../schemas/channel'

function createDb(eventTransitioned: boolean) {
  const returning = vi.fn().mockResolvedValue(eventTransitioned ? [{ id: 'event-1' }] : [])
  const where = vi.fn(() => ({ returning }))
  const set = vi.fn(() => ({ where }))
  const update = vi.fn(() => ({ set }))
  const tx = { update }
  const db = {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  } as unknown as ChatDatabase
  return { db, update }
}

const event = {
  availableAt: new Date('2026-01-01T00:00:00Z'),
  bindingId: 'binding-1',
  id: 'event-1',
  retryCount: 0,
} as ChannelEventItem

describe('ChannelEventModel.retryOrFail', () => {
  it('does not degrade the binding when the current owner no longer transitions the event', async () => {
    const { db, update } = createDb(false)

    await new ChannelEventModel(db).retryOrFail(event, 'stale-owner', 'LEASE_LOST', 'lease lost')

    expect(db.transaction).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
  })

  it('degrades the binding after the current owner transitions the event', async () => {
    const { db, update } = createDb(true)

    await new ChannelEventModel(db).retryOrFail(event, 'current-owner', 'PROCESSING_ERROR', 'failed')

    expect(update).toHaveBeenCalledTimes(2)
  })
})

describe('ChannelEventModel.saveResponse', () => {
  it('persists response text and generation metadata in one update', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'event-1' }])
    const where = vi.fn(() => ({ returning }))
    const set = vi.fn(() => ({ where }))
    const db = { update: vi.fn(() => ({ set })) } as unknown as ChatDatabase

    await new ChannelEventModel(db).saveResponse('event-1', 'owner-1', {
      durationMs: 4321,
      model: 'gpt-test',
      provider: 'openai',
      text: 'reply',
    })

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 4321,
        model: 'gpt-test',
        provider: 'openai',
        responseText: 'reply',
      })
    )
  })
})

describe('ChannelEventModel.getSessionByBinding', () => {
  it('includes the authorized binding in the session query', async () => {
    const findFirst = vi.fn().mockResolvedValue(undefined)
    const db = { query: { channelSessions: { findFirst } } } as unknown as ChatDatabase

    await new ChannelEventModel(db).getSessionByBinding('session-1', 'binding-1')

    expect(findFirst).toHaveBeenCalledWith({
      where: and(eq(channelSessions.id, 'session-1'), eq(channelSessions.bindingId, 'binding-1')),
    })
  })
})

describe('ChannelEventModel.findMediaEventBySessionAndBinding', () => {
  it('selects media metadata with event, session, and binding ownership conditions', async () => {
    const limit = vi.fn().mockResolvedValue([])
    const where = vi.fn(() => ({ limit }))
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))
    const db = { select } as unknown as ChatDatabase

    await new ChannelEventModel(db).findMediaEventBySessionAndBinding('event-1', 'session-1', 'binding-1')

    expect(select).toHaveBeenCalledWith({
      bindingId: channelEvents.bindingId,
      content: channelEvents.content,
      id: channelEvents.id,
      messageKind: channelEvents.messageKind,
      sessionId: channelEvents.sessionId,
    })
    expect(where).toHaveBeenCalledWith(
      and(
        eq(channelEvents.id, 'event-1'),
        eq(channelEvents.sessionId, 'session-1'),
        eq(channelEvents.bindingId, 'binding-1')
      )
    )
  })
})

describe('ChannelEventModel.countFailedByBindings', () => {
  it('groups failed-event counts by the requested bindings', async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { bindingId: 'binding-1', count: 2 },
      { bindingId: 'binding-2', count: 1 },
    ])
    const where = vi.fn(() => ({ groupBy }))
    const from = vi.fn(() => ({ where }))
    const select = vi.fn(() => ({ from }))
    const db = { select } as unknown as ChatDatabase

    const result = await new ChannelEventModel(db).countFailedByBindings(['binding-1', 'binding-2'])

    expect(select).toHaveBeenCalledWith({ bindingId: channelEvents.bindingId, count: expect.anything() })
    expect(where).toHaveBeenCalledWith(
      and(
        inArray(channelEvents.bindingId, ['binding-1', 'binding-2']),
        eq(channelEvents.status, 'failed')
      )
    )
    expect(result).toEqual(new Map([['binding-1', 2], ['binding-2', 1]]))
  })

  it('returns no query for an empty binding list', async () => {
    const select = vi.fn()
    const db = { select } as unknown as ChatDatabase

    await expect(new ChannelEventModel(db).countFailedByBindings([])).resolves.toEqual(new Map())
    expect(select).not.toHaveBeenCalled()
  })
})
