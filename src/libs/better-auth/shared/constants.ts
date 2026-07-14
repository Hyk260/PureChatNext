/**
 * Canonical IDs of Better-Auth built-in social providers.
 * Keep this list in sync with provider definitions in `src/libs/better-auth/sso/providers`.
 */
export const BUILTIN_BETTER_AUTH_PROVIDERS = [
  'apple',
  'google',
  'github',
  'microsoft',
] as const

/**
 * Provider alias → canonical ID mapping.
 * This is used on the client to normalize configured provider keys.
 */
export const PROVIDER_ALIAS_MAP: Record<string, string> = {
  'microsoft-entra-id': 'microsoft',
}

export const SSO_PROVIDER_LABELS: Record<string, string> = {
  feishu: '飞书',
  github: 'GitHub',
  google: 'Google',
  microsoft: 'Microsoft',
  wechat: '微信',
}

/** SSO providers shown on sign-in UI (GitHub + WeChat only). */
export const AUTH_UI_SSO_PROVIDERS = ['github', 'wechat'] as const

/** Email OTP 过期时间（秒），与 Better Auth emailOTP 插件配置保持一致 */
export const OTP_EXPIRES_IN = 300

/** 同一 IP 24 小时滚动窗口内最多发送验证类邮件次数 */
export const VERIFICATION_DAILY_IP_MAX = 10

/** 验证类邮件 IP 日限窗口（秒） */
export const VERIFICATION_DAILY_IP_WINDOW_SECONDS = 86_400
