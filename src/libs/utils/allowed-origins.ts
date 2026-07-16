import { appEnv } from '@/envs/app'

const LOCAL_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5174', // Vite SPA (`pnpm dev:spa`)
  'http://localhost:4173',
  'http://localhost:8080',
  'http://localhost:8038',
]

/** CORS 与 Better Auth trustedOrigins 共用的允许来源列表 */
export function getAllowedOrigins(): string[] {
  const defaultOrigins = [appEnv.APP_URL, ...LOCAL_DEV_ORIGINS].filter(Boolean) as string[]
  const extraAllowedOrigins = (appEnv.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return Array.from(new Set([...defaultOrigins, ...extraAllowedOrigins]))
}
