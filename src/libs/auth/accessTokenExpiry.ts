import { authEnv } from '@/envs/auth'

const UNIT_SECONDS = { d: 86_400, h: 3_600, m: 60, s: 1 }

export function parseAccessTokenExpiry(expiration: string): number {
  const match = expiration.match(/^(\d+)([smhd])$/i)
  if (!match) return 900
  return Number(match[1]) * UNIT_SECONDS[match[2].toLowerCase() as keyof typeof UNIT_SECONDS]
}

export const ACCESS_TOKEN_EXPIRES_IN = parseAccessTokenExpiry(authEnv.JWT_ACCESS_EXPIRATION)
