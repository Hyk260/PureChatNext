// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getDecrypted: vi.fn(),
  resolveProviderApiKey: vi.fn(),
}))

vi.mock('@pure/database/models/userProviderSecret', () => ({
  UserProviderSecretModel: class {
    getDecrypted = mocks.getDecrypted
  },
}))
vi.mock('./resolveClient', () => ({
  isSupportedProviderId: (id: string) => id === 'openai' || id === 'deepseek',
  resolveOptionalBaseURL: (value?: string) => {
    if (typeof value !== 'string') return undefined
    const trimmed = value.trim()
    return trimmed || undefined
  },
  resolveProviderApiKey: mocks.resolveProviderApiKey,
}))

import { resolveUserProviderCredentials } from './userSecrets'

describe('resolveUserProviderCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDecrypted.mockResolvedValue(null)
    mocks.resolveProviderApiKey.mockReturnValue(undefined)
  })

  it('prefers the user vault over env keys', async () => {
    mocks.getDecrypted.mockResolvedValue({ apiKey: 'sk-user', baseURL: 'https://vault.example/v1' })
    mocks.resolveProviderApiKey.mockReturnValue('sk-env')

    await expect(
      resolveUserProviderCredentials({
        allowEnvFallback: true,
        headerKey: 'sk-header',
        provider: 'deepseek',
        userId: 'user-1',
      })
    ).resolves.toEqual({ apiKey: 'sk-user', baseURL: 'https://vault.example/v1' })
  })

  it('does not fall back to env keys for channel runtimes', async () => {
    mocks.resolveProviderApiKey.mockReturnValue('sk-env')

    await expect(
      resolveUserProviderCredentials({
        allowEnvFallback: false,
        provider: 'deepseek',
        userId: 'user-1',
      })
    ).resolves.toBeNull()
  })

  it('uses env keys for web when the vault is empty', async () => {
    mocks.resolveProviderApiKey.mockReturnValue('sk-env')

    await expect(
      resolveUserProviderCredentials({
        allowEnvFallback: true,
        provider: 'openai',
        requestBaseURL: 'https://proxy.example/v1',
        userId: 'user-1',
      })
    ).resolves.toEqual({ apiKey: 'sk-env', baseURL: 'https://proxy.example/v1' })
  })
})
