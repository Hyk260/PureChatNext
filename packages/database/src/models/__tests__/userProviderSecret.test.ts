// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn(), serverDB: {} }))

import { encryptVaultJson } from '@pure/utils/server'

import { MissingProviderApiKeyError, UserProviderSecretModel } from '../userProviderSecret'
import type { ChatDatabase } from '../../type'

const SECRET = 'test-secret-for-unit'

function createDb(options?: {
  existing?: { id: string; keyHint: string; keyVaults: string; providerId: string }
  rows?: Array<{ id: string; keyHint: string; keyVaults: string; providerId: string; userId: string }>
}) {
  const inserted: Record<string, unknown>[] = []
  const updated: Record<string, unknown>[] = []
  const deleted: unknown[] = []
  const db = {
    delete: vi.fn(() => ({
      where: vi.fn(async (where: unknown) => {
        deleted.push(where)
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (value: Record<string, unknown>) => {
        inserted.push(value)
      }),
    })),
    query: {
      userProviderSecrets: {
        findFirst: vi.fn(async () => options?.existing ?? null),
        findMany: vi.fn(async () => options?.rows ?? []),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn((value: Record<string, unknown>) => {
        updated.push(value)
        return { where: vi.fn(async () => undefined) }
      }),
    })),
  } as unknown as ChatDatabase

  return { db, deleted, inserted, updated }
}

describe('UserProviderSecretModel', () => {
  beforeEach(() => {
    process.env.KEY_VAULTS_SECRET = SECRET
  })

  it('lists decrypted secrets for the owning user', async () => {
    const keyVaults = encryptVaultJson({ apiKey: 'sk-secret-key', baseURL: 'https://api.example/v1' })
    const { db } = createDb({
      rows: [{ id: 'ups_1', keyHint: 'tkey', keyVaults, providerId: 'deepseek', userId: 'user-1' }],
    })

    const items = await new UserProviderSecretModel(db).listPublic('user-1')
    expect(items).toEqual([
      { apiKey: 'sk-secret-key', baseURL: 'https://api.example/v1', keyHint: 'tkey', providerId: 'deepseek' },
    ])
  })

  it('decrypts a stored vault for server-side use', async () => {
    const keyVaults = encryptVaultJson({ apiKey: 'sk-live', baseURL: '' })
    const { db } = createDb({
      existing: { id: 'ups_1', keyHint: 'live', keyVaults, providerId: 'openai' },
    })

    await expect(new UserProviderSecretModel(db).getDecrypted('user-1', 'openai')).resolves.toEqual({
      apiKey: 'sk-live',
      baseURL: '',
    })
  })

  it('keeps the existing apiKey when upserting only baseURL', async () => {
    const keyVaults = encryptVaultJson({ apiKey: 'sk-keep', baseURL: '' })
    const { db, updated } = createDb({
      existing: { id: 'ups_1', keyHint: 'keep', keyVaults, providerId: 'deepseek' },
    })

    const result = await new UserProviderSecretModel(db).upsert('user-1', 'deepseek', {
      baseURL: 'https://proxy.example/v1',
    })

    expect(result).toMatchObject({
      apiKey: 'sk-keep',
      baseURL: 'https://proxy.example/v1',
      keyHint: 'keep',
      providerId: 'deepseek',
    })
    expect(updated[0]?.keyHint).toBe('keep')
    expect(typeof updated[0]?.keyVaults).toBe('string')
    expect(String(updated[0]?.keyVaults)).not.toContain('sk-keep')
  })

  it('rejects creating a secret without an apiKey', async () => {
    const { db, inserted } = createDb()
    await expect(new UserProviderSecretModel(db).upsert('user-1', 'deepseek', { baseURL: 'https://x' })).rejects.toBeInstanceOf(
      MissingProviderApiKeyError
    )
    expect(inserted).toHaveLength(0)
  })
})
