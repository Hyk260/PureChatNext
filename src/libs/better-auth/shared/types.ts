export type EmailVerificationMode = 'link' | 'otp'

export interface AuthServerConfig {
  emailVerificationMode: EmailVerificationMode
  enableEmailVerification: boolean
  enableMagicLink: boolean
  oAuthSSOProviders: string[]
}
