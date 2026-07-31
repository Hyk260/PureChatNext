import type { GenericOAuthConfig } from 'better-auth/plugins'

import { authEnv } from '@/envs/auth'

export const DEFAULT_OIDC_SCOPES = ['openid', 'email', 'profile']

type AuthEnv = typeof authEnv
/** authEnv 中值为 string | undefined 的 key（排除 boolean 等） */
type AuthEnvStringKey = Extract<
  {
    [K in keyof AuthEnv]: AuthEnv[K] extends string | undefined ? K : never
  }[keyof AuthEnv],
  string
>

/**
 * 校验 SSO 所需环境变量：`required` 全部非空时返回挑出的 env 片段，否则返回 false。
 * `optional` 仅一并带回，不参与必填校验（如 Apple 的 bundle id）。
 */
export function checkProviderEnvs<
  const R extends readonly AuthEnvStringKey[],
  const O extends readonly AuthEnvStringKey[] = [],
>(required: R, optional?: O): ({ [K in R[number]]: string } & { [K in O[number]]?: string }) | false {
  for (const key of required) {
    if (!authEnv[key]) return false
  }

  const result = {} as Record<string, string | undefined>
  for (const key of required) {
    result[key] = authEnv[key]
  }
  for (const key of optional ?? []) {
    result[key] = authEnv[key]
  }

  return result as { [K in R[number]]: string } & { [K in O[number]]?: string }
}

const createDiscoveryUrl = (issuer: string) => {
  const normalized = issuer.replace(/\/$/, '')
  return normalized.includes('/.well-known/') ? normalized : `${normalized}/.well-known/openid-configuration`
}

type OIDCProviderInput = {
  clientId?: string
  clientSecret?: string
  issuer?: string
  overrides?: Partial<GenericOAuthConfig>
  pkce?: boolean
  providerId: string
  scopes?: string[]
}

export const buildOidcConfig = ({
  providerId,
  clientId,
  clientSecret,
  issuer,
  scopes = DEFAULT_OIDC_SCOPES,
  pkce = true,
  overrides,
}: OIDCProviderInput): GenericOAuthConfig => {
  const sanitizedIssuer = issuer?.trim()

  if (!clientId || !clientSecret || !sanitizedIssuer) {
    throw new Error(`[Better-Auth] ${providerId} OAuth enabled but missing credentials`)
  }

  const normalizedIssuer = sanitizedIssuer.replace(/\/$/, '')
  const discoveryUrl = createDiscoveryUrl(normalizedIssuer)

  return {
    clientId,
    clientSecret,
    discoveryUrl,
    pkce,
    providerId,
    scopes,
    ...overrides,
  } satisfies GenericOAuthConfig
}
