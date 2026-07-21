import { authEnv } from '@/envs/auth'
import { type AuthServerConfig } from '@/libs/better-auth/shared'
import { parseSSOProviders } from '@/libs/better-auth/sso'

export type { AuthServerConfig, EmailVerificationMode } from '@/libs/better-auth/shared'

export const getAuthServerConfig = (): AuthServerConfig => ({
  emailVerificationMode: authEnv.AUTH_EMAIL_VERIFICATION_MODE,
  enableEmailVerification: authEnv.AUTH_EMAIL_VERIFICATION,
  enableMagicLink: authEnv.AUTH_ENABLE_MAGIC_LINK,
  oAuthSSOProviders: parseSSOProviders(authEnv.AUTH_SSO_PROVIDERS),
})
