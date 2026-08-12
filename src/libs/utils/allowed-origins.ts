import { appEnv } from '@/envs/app'
import { TRYCLOUDFLARE_TRUSTED_ORIGIN } from '@/envs/dev-tunnel'

const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5174', // Vite SPA (`pnpm dev:spa`)
  'http://localhost:4173',
  'http://localhost:8080',
  'http://localhost:8038',
]

/** 将 Origin / 通配模式转为可匹配的正则（支持 `https://*.trycloudflare.com`） */
function originPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+')
  return new RegExp(`^${escaped}$`, 'i')
}

/** CORS 与 Better Auth trustedOrigins 共用的允许来源列表（可含 `*` 通配） */
export function getAllowedOrigins(): string[] {
  const defaultOrigins = [appEnv.APP_URL, ...LOCAL_DEV_ORIGINS].filter(Boolean) as string[]
  const extraAllowedOrigins = (appEnv.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const tunnelOrigins = appEnv.ALLOW_TRYCLOUDFLARE ? [TRYCLOUDFLARE_TRUSTED_ORIGIN] : []

  return Array.from(new Set([...defaultOrigins, ...extraAllowedOrigins, ...tunnelOrigins]))
}

/** 判断请求 Origin 是否在允许列表中（支持通配模式） */
export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false
  return getAllowedOrigins().some((pattern) => {
    if (pattern.includes('*')) return originPatternToRegExp(pattern).test(origin)
    return pattern === origin
  })
}
