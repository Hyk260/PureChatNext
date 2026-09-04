// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import { channelEvents } from '../../schemas/channel'
import type { ChannelEventItem } from '../../schemas/channel'
import type { ChatDatabase } from '../../type'
import { ChannelEventModel } from '../channelEvent'

const inbound = {
  bindingId: 'binding-1',
  content: 'hello',
  externalUserId: 'qq:c2c:user-1',
  externalUserName: 'QQ 单聊 user-1',
  messageKind: 'text' as const,
  platformMessageId: 'msg-1',
  platformPayload: { threadId: 'qq:c2c:user-1', threadType: 'c2c' },
  threadType: 'c2c',
}

const session = {
  activeAgentId: null,
  bindingId: 'binding-1',
  conversationVersion: 1,
  createdAt: new Date(),
  externalUserId: inbound.externalUserId,
  externalUserName: inbound.externalUserName,
  id: 'session-1',
  lastActiveAt: new Date(),
  threadType: 'c2c',
  updatedAt: new Date(),
}

const event = {
  id: 'event-1',
  bindingId: 'binding-1',
  sessionId: 'session-1',
  platformMessageId: 'msg-1',
  encryptedContextToken: '',
  externalUserId: inbound.externalUserId,
  messageKind: 'text',
  content: 'hello',
  conversationVersion: 1,
  status: 'pending',
  retryCount: 0,
  availableAt: new Date(),
  sentChunkCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
} as ChannelEventItem

function chain(returning: unknown) {
  return {
    where: vi.fn().mockResolvedValue([]),
    returning: vi.fn().mockResolvedValue(returning),
  }
}

function createTx(options: { duplicate?: boolean }) {
  const updateCalls = [] as unknown[]
  const insert = vi.fn((table: unknown) => {
    const builder = {
      values: vi.fn(() => {
        if (table === channelEvents) {
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue(options.duplicate ? [] : [event]),
            })),
          }
        }
        return {
          onConflictDoUpdate: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([session]),
          })),
        }
      }),
    }
    return builder
  })
  const select = vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(options.duplicate ? [event] : []),
      })),
    })),
  }))
  const update = vi.fn(() => ({
    set: vi.fn((value: unknown) => {
      updateCalls.push(value)
      return chain([])
    }),
  }))
  return { insert, select, tx: { insert, select, update }, updateCalls }
}

function createDb(tx: ReturnType<typeof createTx>['tx']): ChatDatabase {
  return {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  } as unknown as ChatDatabase
}

describe('ChannelEventModel QQ persistence', () => {
  it('ingests a new QQ inbound event idempotently and updates the binding', async () => {
    const { tx } = createTx({})
    const result = await new ChannelEventModel(createDb(tx)).ingestQQInbound(inbound)

    expect(result.inserted).toBe(true)
    expect(result.event.id).toBe('event-1')
    expect(tx.update).toHaveBeenCalled()
  })

  it('returns the existing event without duplicating on conflict', async () => {
    const { tx } = createTx({ duplicate: true })
    const result = await new ChannelEventModel(createDb(tx)).ingestQQInbound(inbound)

    expect(result.inserted).toBe(false)
    expect(result.event.id).toBe('event-1')
  })

  it('saves QQ generation metadata without a lease', async () => {
    const set = vi.fn(() => chain([]))
    const db = { update: vi.fn(() => ({ set })) } as unknown as ChatDatabase

    await new ChannelEventModel(db).saveQQResponse('event-1', {
      durationMs: 123,
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
      text: 'reply',
    })

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        durationMs: 123,
        model: 'deepseek-v4-flash',
        provider: 'deepseek',
        responseText: 'reply',
        status: 'completed',
      })
    )
  })
})
