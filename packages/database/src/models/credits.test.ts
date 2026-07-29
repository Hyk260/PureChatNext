// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { CreditsModel } from './credits'
import { type ChatDatabase } from '../type'

type InsertedValue = Record<string, unknown>

const createChargeDb = (options?: { duplicate?: boolean }) => {
  const inserted: InsertedValue[] = []
  let selectIndex = 0
  const tx = {
    insert: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.values = vi.fn((value: InsertedValue) => {
        inserted.push(value)
        return chain
      })
      chain.onConflictDoNothing = vi.fn(async () => undefined)
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(undefined).then(resolve)
      return chain
    }),
    select: vi.fn(() => {
      const result = selectIndex++ === 0 ? (options?.duplicate ? [{ id: 'existing' }] : []) : [{ grant: 500_000, used: 1_000 }]
      const chain: Record<string, unknown> = {}
      chain.from = vi.fn(() => chain)
      chain.where = vi.fn(() => chain)
      chain.limit = vi.fn(() => chain)
      chain.for = vi.fn(async () => result)
      chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
      return chain
    }),
    update: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.set = vi.fn(() => chain)
      chain.where = vi.fn(async () => undefined)
      return chain
    }),
  }
  const db = {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  } as unknown as ChatDatabase
  return { db, inserted, tx }
}

describe('CreditsModel chargeChatUsage', () => {
  it('persists token details and duration with the chat ledger entry', async () => {
    const { db, inserted } = createChargeDb()
    const result = await new CreditsModel(db).chargeChatUsage({
      cachedInputTokens: 200,
      credits: 1_234,
      durationMs: 4321.4,
      inputTokens: 1_000,
      messageId: 'message-1',
      model: 'claude-sonnet',
      outputTokens: 300,
      period: '2026-07',
      provider: 'purehub',
      userId: 'user-1',
    })

    expect(result).toEqual({ charged: 1_234, skipped: false })
    expect(inserted).toContainEqual(
      expect.objectContaining({
        cachedInputTokens: 200,
        credits: 1_234,
        durationMs: 4321,
        inputTokens: 1_000,
        messageId: 'message-1',
        outputTokens: 300,
        reason: 'chat_usage',
      })
    )
  })

  it('does not charge or insert another ledger row for a duplicate message', async () => {
    const { db, inserted, tx } = createChargeDb({ duplicate: true })
    const result = await new CreditsModel(db).chargeChatUsage({
      credits: 100,
      durationMs: 500,
      messageId: 'message-1',
      model: 'claude-sonnet',
      period: '2026-07',
      provider: 'purehub',
      userId: 'user-1',
    })

    expect(result).toEqual({ charged: 0, skipped: true })
    expect(inserted).toEqual([])
    expect(tx.update).not.toHaveBeenCalled()
  })
})
