import { APIError } from 'better-auth/api'
import { getClientIP } from '@pure/utils/clientIP'
import debug from 'debug'

import {
  SIGNUP_DAILY_IP_MAX,
  SIGNUP_DAILY_RATE_LIMIT_PATH,
  VERIFICATION_DAILY_IP_WINDOW_SECONDS,
} from '@/libs/better-auth/shared'
import { isDev } from '@/libs/constants'

const log = debug('auth:signup')

type SignupRateLimitStorage = {
  consume: (
    key: string,
    rule: { max: number; window: number }
  ) => Promise<{ allowed: boolean; retryAfter: number | null }>
}

type AuthRequestContext = {
  headers?: Headers
  request?: { headers: Headers }
} | null

export const SIGNUP_TOO_MANY_MESSAGE = '注册过于频繁，请稍后再试'

const SIGNUP_IP_RATE_LIMIT = {
  max: SIGNUP_DAILY_IP_MAX,
  window: VERIFICATION_DAILY_IP_WINDOW_SECONDS,
}

export const resolveSignupIp = (headers?: Headers | null) => {
  const ip = headers ? getClientIP(headers) : ''
  return ip || 'unknown'
}

export const headersFromAuthContext = (context: AuthRequestContext) =>
  context?.headers ?? context?.request?.headers ?? null

export async function assertSignupIpAllowed(storage: SignupRateLimitStorage, context: AuthRequestContext) {
  // 开发环境跳过。本地常无客户端 IP，请求会记到 unknown，同一 IP 24h 内满 SIGNUP_DAILY_IP_MAX（3）次即 429。
  // 生产仍按 IP 滚动窗口计数。排查限流时看本分支，以及 DEBUG=auth:signup 的 blocked 日志。
  if (isDev) return

  const ip = resolveSignupIp(headersFromAuthContext(context))
  const result = await storage.consume(`${ip}|${SIGNUP_DAILY_RATE_LIMIT_PATH}`, SIGNUP_IP_RATE_LIMIT)
  if (result.allowed) return

  log('blocked ip=%s retryAfter=%d', ip, result.retryAfter)
  throw new APIError('TOO_MANY_REQUESTS', { message: SIGNUP_TOO_MANY_MESSAGE })
}
