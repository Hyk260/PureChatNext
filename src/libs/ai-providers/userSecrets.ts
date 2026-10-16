import { UserProviderSecretModel } from '@pure/database/models/userProviderSecret'
import { CustomProviderModel, isValidProviderId } from '@pure/database/models/customProvider'

import {
  isSupportedProviderId,
  PROVIDER_RUNTIME_DEFAULT_BASE_URLS,
  resolveOptionalBaseURL,
  resolveProviderApiKey,
} from './resolveClient'

export type UserProviderCredentials = {
  apiKey: string
  baseURL?: string
}

export const MISSING_USER_PROVIDER_SECRET_MESSAGE = '请先在设置中保存该服务商 API Key'

export async function resolveUserProviderCredentials(params: {
  allowEnvFallback: boolean
  headerKey?: string
  provider: string
  requestBaseURL?: string
  userId?: string | null
}): Promise<UserProviderCredentials | null> {
  const requestBaseURL = resolveOptionalBaseURL(params.requestBaseURL)

  if (!isSupportedProviderId(params.provider)) {
    return resolveCustomProviderCredentials(params.provider, params.userId)
  }

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

  const headerKey = params.headerKey?.trim()
  // A verified application's Bearer token must never become an upstream key.
  const looksLikeJwt = headerKey ? /^[\w-]+\.[\w-]+\.[\w-]+$/.test(headerKey) : false
  if (headerKey && !params.userId && !looksLikeJwt) {
    return { apiKey: headerKey, baseURL: requestBaseURL }
  }

  if (!params.allowEnvFallback || !params.userId) return null

  const envKey = resolveProviderApiKey(params.provider, undefined, undefined)
  if (!envKey) return null
  return { apiKey: envKey, baseURL: PROVIDER_RUNTIME_DEFAULT_BASE_URLS[params.provider] }
}

export function isByokProviderId(provider: string): boolean {
  return isSupportedProviderId(provider) || (provider !== 'purechat' && isValidProviderId(provider))
}

const resolveCustomProviderCredentials = async (providerId: string, userId?: string | null) => {
  if (!userId || !isValidProviderId(providerId)) return null

  try {
    const provider = await new CustomProviderModel(userId).find(providerId)
    if (!provider) return null

    const vault = await new UserProviderSecretModel().getDecrypted(userId, providerId)
    if (!vault?.apiKey) return null

    return { apiKey: vault.apiKey, baseURL: provider.baseURL }
  } catch {
    return null
  }
}
