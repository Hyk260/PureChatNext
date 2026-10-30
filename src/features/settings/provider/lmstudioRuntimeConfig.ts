import type { LmStudioRuntimeConfig } from '@/libs/ai-providers/lmstudio'
import { normalizeLmStudioBaseURL } from '@/libs/ai-providers/lmstudioBaseUrl'
import { getDesktopApi } from '@/types/desktop'

import { fetchProviderSecrets, saveProviderSecret, secretForProvider } from './secretsApi'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import { PROVIDER_DEFAULT_BASE_URLS } from './const'

const desktopMigrations = new Map<string, Promise<void>>()

async function migrateLegacyDesktopConfig(accountId: string) {
  const desktop = getDesktopApi()
  if (!desktop) return undefined

  let pending = desktopMigrations.get(accountId)
  if (!pending) {
    pending = (async () => {
      const legacy = await desktop.lmStudio.getRuntimeConfig({ accountId, providerId: 'lmstudio' })
      const baseURL = normalizeLmStudioBaseURL(legacy.baseURL)
      const hasLegacyConfig = Boolean(legacy.apiKey?.trim()) || baseURL !== PROVIDER_DEFAULT_BASE_URLS.lmstudio
      if (!hasLegacyConfig) return

      await saveProviderSecret({
        apiKey: legacy.apiKey?.trim() ?? '',
        baseURL,
        provider: 'lmstudio',
      })
      await desktop.lmStudio.clearLegacySettings({ accountId, providerId: 'lmstudio' }).catch(() => undefined)
    })()
    desktopMigrations.set(accountId, pending)
  }

  try {
    await pending
  } finally {
    desktopMigrations.delete(accountId)
  }

  const secrets = await fetchProviderSecrets()
  return secretForProvider(secrets, 'lmstudio')
}

export async function getLmStudioRuntimeConfig(input: { accountId?: string; apiKey?: string; baseURL?: string } = {}) {
  const secrets = await fetchProviderSecrets()
  let secret = secretForProvider(secrets, 'lmstudio')
  const desktop = input.accountId ? getDesktopApi() : undefined
  const hasSavedConfig = Boolean(secret?.apiKey.trim() || secret?.baseURL.trim())

  // Older desktop versions stored this provider only in the device config.
  // Copy it into the account vault once, then use the vault on both platforms.
  if (!hasSavedConfig && input.accountId && desktop) {
    secret = (await migrateLegacyDesktopConfig(input.accountId)) ?? secret
  } else if (input.accountId && desktop) {
    await desktop.lmStudio
      .clearLegacySettings({ accountId: input.accountId, providerId: 'lmstudio' })
      .catch(() => undefined)
  }

  const storedBaseURL = secret?.baseURL || useProviderConfigStore.getState().configs.lmstudio.baseURL
  const config: LmStudioRuntimeConfig = {
    ...(input.apiKey?.trim() || secret?.apiKey ? { apiKey: input.apiKey?.trim() || secret?.apiKey } : {}),
    baseURL: input.baseURL?.trim() || storedBaseURL || PROVIDER_DEFAULT_BASE_URLS.lmstudio,
  }

  return { ...config, baseURL: normalizeLmStudioBaseURL(config.baseURL) }
}
