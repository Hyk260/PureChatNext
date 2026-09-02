// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import type { ChatDatabase } from '../../type'
import { ChannelEventModel } from '../channelEvent'
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
