import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  fetchProviderSecrets: vi.fn(),
  getDesktopApi: vi.fn(),
  saveProviderSecret: vi.fn(),
}))

vi.mock('@/types/desktop', () => ({ getDesktopApi: mocks.getDesktopApi }))
vi.mock('./secretsApi', () => ({
  fetchProviderSecrets: mocks.fetchProviderSecrets,
  saveProviderSecret: mocks.saveProviderSecret,
  secretForProvider: (items: Array<{ providerId: string }> | undefined, provider: string) =>
    items?.find((item) => item.providerId === provider),
}))
vi.mock('./store/useProviderConfigStore', () => ({
  useProviderConfigStore: {
    getState: () => ({ configs: { lmstudio: { baseURL: 'http://localhost:1234/v1' } } }),
  },
}))

import { getLmStudioRuntimeConfig } from './lmstudioRuntimeConfig'

afterEach(() => {
  vi.resetAllMocks()
})

describe('getLmStudioRuntimeConfig', () => {
  it('uses the account vault config in Web', async () => {
    mocks.getDesktopApi.mockReturnValue(undefined)
    mocks.fetchProviderSecrets.mockResolvedValue([
      { apiKey: 'account-key', baseURL: 'https://lm.example.com/v1', providerId: 'lmstudio' },
    ])

    await expect(getLmStudioRuntimeConfig()).resolves.toEqual({
      apiKey: 'account-key',
      baseURL: 'https://lm.example.com/v1',
    })
  })

  it('migrates a legacy desktop config into the account vault', async () => {
    const legacyConfig = { apiKey: 'desktop-key', baseURL: 'http://localhost:4567/v1' }
    const savedSecret = { ...legacyConfig, providerId: 'lmstudio' }
    const getRuntimeConfig = vi.fn().mockResolvedValue(legacyConfig)
    const clearLegacySettings = vi.fn().mockResolvedValue(undefined)
    mocks.getDesktopApi.mockReturnValue({ lmStudio: { clearLegacySettings, getRuntimeConfig } })
    mocks.fetchProviderSecrets.mockResolvedValueOnce([]).mockResolvedValueOnce([savedSecret])
    mocks.saveProviderSecret.mockResolvedValue(savedSecret)

    await expect(getLmStudioRuntimeConfig({ accountId: 'user-1' })).resolves.toEqual(legacyConfig)
    expect(getRuntimeConfig).toHaveBeenCalledWith({ accountId: 'user-1', providerId: 'lmstudio' })
    expect(mocks.saveProviderSecret).toHaveBeenCalledWith({
      apiKey: 'desktop-key',
      baseURL: 'http://localhost:4567/v1',
      provider: 'lmstudio',
    })
    expect(clearLegacySettings).toHaveBeenCalledWith({ accountId: 'user-1', providerId: 'lmstudio' })
  })

  it('keeps the account vault as the source when it already has LM Studio settings', async () => {
    const clearLegacySettings = vi.fn().mockResolvedValue(undefined)
    mocks.getDesktopApi.mockReturnValue({ lmStudio: { clearLegacySettings, getRuntimeConfig: vi.fn() } })
    mocks.fetchProviderSecrets.mockResolvedValue([
      { apiKey: 'account-key', baseURL: 'https://lm.example.com/v1', providerId: 'lmstudio' },
    ])

    await expect(getLmStudioRuntimeConfig({ accountId: 'user-1' })).resolves.toEqual({
      apiKey: 'account-key',
      baseURL: 'https://lm.example.com/v1',
    })
    expect(mocks.saveProviderSecret).not.toHaveBeenCalled()
    expect(clearLegacySettings).toHaveBeenCalledWith({ accountId: 'user-1', providerId: 'lmstudio' })
  })
})
