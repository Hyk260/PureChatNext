import { authEnv } from '@/envs/auth'
import { parseSSOProviders } from '@/libs/better-auth/utils/server'

export type EmailVerificationMode = 'link' | 'otp'

export interface AuthServerConfig {
  emailVerificationMode: EmailVerificationMode
  enableEmailVerification: boolean
  enableMagicLink: boolean
  oAuthSSOProviders: string[]
}

export const getAuthServerConfig = (): AuthServerConfig => ({
  emailVerificationMode: authEnv.AUTH_EMAIL_VERIFICATION_MODE,
  enableEmailVerification: authEnv.AUTH_EMAIL_VERIFICATION,
  enableMagicLink: authEnv.AUTH_ENABLE_MAGIC_LINK,
  oAuthSSOProviders: parseSSOProviders(authEnv.AUTH_SSO_PROVIDERS),
})
