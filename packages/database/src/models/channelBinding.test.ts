// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import { ChannelBindingModel } from './channelBinding'
import type { ChatDatabase } from '../type'

type UpdateCall = { set: Record<string, unknown>; table: unknown }

function createTransactionDb(existing: Record<string, unknown> | undefined) {
  const updateCalls: UpdateCall[] = []
  const binding = existing ? { id: 'binding-1', ...existing } : undefined
  const updated = binding ? { ...binding, agentId: 'agent-new', model: 'gpt-5.4-mini', provider: 'openai' } : undefined

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => ({ for: vi.fn().mockResolvedValue(binding ? [binding] : []) })),
        })),
      })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((set: Record<string, unknown>) => {
        updateCalls.push({ set, table })
        return {
          where: vi.fn(() =>
            table === tx.update.mock.calls[0]?.[0]
              ? { returning: vi.fn().mockResolvedValue(updated ? [updated] : []) }
              : Promise.resolve([])
          ),
        }
      }),
    })),
  }
  const db = {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) => callback(tx)),
  } as unknown as ChatDatabase

  return { db, tx, updateCalls }
}

describe('ChannelBindingModel.updateConfiguration', () => {
  it('updates the binding and resets every session and queued event in one transaction', async () => {
    const { db, tx, updateCalls } = createTransactionDb({ agentId: 'agent-old' })
    const result = await new ChannelBindingModel(db).updateConfiguration({
      agentId: 'agent-new',
      model: 'gpt-5.4-mini',
      platform: 'wechat',
      provider: 'openai',
      userId: 'user-1',
    })

    expect(db.transaction).toHaveBeenCalledOnce()
    expect(tx.select).toHaveBeenCalledOnce()
    expect(tx.update).toHaveBeenCalledTimes(3)
    expect(result).toMatchObject({ agentId: 'agent-new', model: 'gpt-5.4-mini', provider: 'openai' })

    expect(updateCalls[0]?.set).toMatchObject({
      agentId: 'agent-new',
      model: 'gpt-5.4-mini',
      provider: 'openai',
    })
    expect(updateCalls[1]?.set).toMatchObject({ activeAgentId: null })
    expect(updateCalls[1]?.set.conversationVersion).toBeDefined()
    expect(updateCalls[2]?.set).toMatchObject({
      leaseExpiresAt: null,
      leaseOwner: null,
      status: 'canceled',
    })
  })

  it('returns null without mutating anything when the binding is missing', async () => {
    const { db, tx } = createTransactionDb(undefined)

    await expect(
      new ChannelBindingModel(db).updateConfiguration({
        agentId: 'agent-new',
        model: 'deepseek-v4-flash',
        platform: 'wechat',
        provider: 'deepseek',
        userId: 'missing-user',
      })
    ).resolves.toBeNull()
    expect(tx.update).not.toHaveBeenCalled()
  })
})
