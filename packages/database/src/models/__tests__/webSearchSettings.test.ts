import { afterEach, describe, expect, it, vi } from 'vitest'
import { decryptVaultJson } from '@pure/utils/server'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { mergeWebSearchSettings, WebSearchSettingsModel } from '../webSearchSettings'
import type { ChatDatabase } from '../../type'

afterEach(() => vi.unstubAllEnvs())

describe('account search settings storage', () => {
  it('clears individual overrides without losing sibling fields or provider settings', () => {
    expect(
      mergeWebSearchSettings(
        {
          searchProvider: 'exa',
          maxResults: 9,
          providers: {
            exa: { apiKeys: ['key'], searchBaseURL: 'https://proxy.example' },
            tavily: { apiKeys: ['other'] },
          },
        },
        {
          searchProvider: null,
          providers: { exa: { apiKeys: [], searchBaseURL: null } },
        }
      )
    ).toEqual({ maxResults: 9, providers: { exa: {}, tavily: { apiKeys: ['other'] } } })
  })

  it('locks account updates, keeps secrets out of JSONB, and decrypts only the requested account', async () => {
    vi.stubEnv('KEY_VAULTS_SECRET', 'test-web-settings-secret')
    let row: Record<string, unknown> | undefined
    const findFirst = vi.fn(async () => row)
    const lock = vi.fn(async () => [])
    const tx = {
      query: { userWebSearchSettings: { findFirst } },
      select: () => ({ from: () => ({ where: () => ({ for: lock }) }) }),
      insert: () => ({
        values: (value: Record<string, unknown>) => ({
          onConflictDoUpdate: async () => {
            row = value
          },
        }),
      }),
    }
    const db = {
      ...tx,
      transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx),
    } as unknown as ChatDatabase
    const model = new WebSearchSettingsModel(db)
    await model.patch('owner', {
      maxResults: 7,
      providers: { exa: { apiKeys: ['secret-key'], basicAuthPassword: 'password' } },
    })
    expect(lock).toHaveBeenCalledWith('update')
    expect(JSON.stringify(row?.settings)).not.toContain('secret-key')
    expect(JSON.stringify(row?.settings)).not.toContain('password')
    expect(String(row?.keyVaults)).toMatch(/^enc:v1:/)
    expect(decryptVaultJson(String(row?.keyVaults))).toEqual({
      exa: { apiKeys: ['secret-key'], basicAuthPassword: 'password' },
    })
    await expect(model.get('owner')).resolves.toMatchObject({
      maxResults: 7,
      providers: { exa: { apiKeys: ['secret-key'] } },
    })
    expect(findFirst.mock.calls).toHaveLength(2)
  })
})
