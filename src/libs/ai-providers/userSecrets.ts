import { UserProviderSecretModel } from '@pure/database/models/userProviderSecret'

import type { SupportedProviderId } from './resolveClient'
import { isSupportedProviderId, resolveOptionalBaseURL, resolveProviderApiKey } from './resolveClient'

export type UserProviderCredentials = {
  apiKey: string
  baseURL?: string
}

export const MISSING_USER_PROVIDER_SECRET_MESSAGE = '请先在设置中保存该服务商 API Key'

export async function resolveUserProviderCredentials(params: {
  allowEnvFallback: boolean
  headerKey?: string
  provider: SupportedProviderId
  requestBaseURL?: string
  userId?: string | null
}): Promise<UserProviderCredentials | null> {
  const requestBaseURL = resolveOptionalBaseURL(params.requestBaseURL)

  if (params.userId) {
    try {
      const vault = await new UserProviderSecretModel().getDecrypted(params.userId, params.provider)
      if (vault?.apiKey) {
        return {
          apiKey: vault.apiKey,
          baseURL: requestBaseURL ?? resolveOptionalBaseURL(vault.baseURL),
        }
      }
    } catch {
      // Corrupted or undecryptable vault: fall through to optional env fallback.
    }
  }

  if (!params.allowEnvFallback) return null

  const envKey = resolveProviderApiKey(params.provider, params.headerKey, undefined)
  if (!envKey) return null
  return { apiKey: envKey, baseURL: requestBaseURL }
}

export function isByokProviderId(provider: string): provider is SupportedProviderId {
  return isSupportedProviderId(provider)
}
