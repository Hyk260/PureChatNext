/** Credits ↔ USD 换算常量。 */
export const CREDITS_PER_DOLLAR = 1_000_000

/** 每月免费积分发放额（自然月，Asia/Shanghai）。 */
export const MONTHLY_FREE_CREDITS = 500_000

/**
 * beforeChat 最小预留：余额低于此值拒绝发往 PureChat，避免无意义打上游。
 */
export const MIN_RESERVE_CREDITS = 1_000

export const PURECHAT_PROVIDER_ID = 'purechat' as const

/** Map legacy `purehub` requests to `purechat`; leave other providers unchanged. */
export const normalizeProviderId = (provider: string | undefined): string | undefined => {
  if (provider === 'purehub') return PURECHAT_PROVIDER_ID
  return provider
}
