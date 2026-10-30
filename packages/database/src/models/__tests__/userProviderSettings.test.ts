// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { UserProviderSettingsModel } from '../userProviderSettings'
import type { ChatDatabase } from '../../type'

describe('UserProviderSettingsModel', () => {
  it('stores enabled state per user and returns that user’s settings', async () => {
    const inserted: Array<{ enabled: boolean; providerId: string; userId: string }> = []
    let rows: Array<{ enabled: boolean; providerId: string }> = []
    const insertChain = {
      onConflictDoUpdate: vi.fn(async () => {
        const setting = inserted.at(-1)!
        rows = [...rows.filter((row) => row.providerId !== setting.providerId), setting]
      }),
      values: vi.fn((value: { enabled: boolean; providerId: string; userId: string }) => {
        inserted.push(value)
        return insertChain
      }),
    }
    const db = {
      insert: vi.fn(() => insertChain),
      query: {
        userProviderSettings: {
          findMany: vi.fn(async () => rows),
        },
      },
    } as unknown as ChatDatabase
    const model = new UserProviderSettingsModel(db)

    expect(await model.setEnabled('user-1', 'openai', false)).toEqual({ openai: false })
    expect(inserted).toEqual([expect.objectContaining({ enabled: false, providerId: 'openai', userId: 'user-1' })])
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(await model.list('user-1')).toEqual({ openai: false })
  })
})
