/**
 * Local quick-tunnel helpers (cloudflared TryCloudflare).
 * Shared by Vite `server.allowedHosts` and Better Auth / CORS trusted origins.
 */

import { parseEnvBoolean } from './helpers'

/** Vite `allowedHosts` 后缀匹配：含所有 `*.trycloudflare.com` */
export const TRYCLOUDFLARE_ALLOWED_HOST = '.trycloudflare.com'

/** Better Auth / CORS 通配 Origin */
export const TRYCLOUDFLARE_TRUSTED_ORIGIN = 'https://*.trycloudflare.com'

export function isTryCloudflareAllowed(raw = process.env.ALLOW_TRYCLOUDFLARE): boolean {
  return parseEnvBoolean(raw)
}

/** Vite `server.allowedHosts`：开启时返回 TryCloudflare host 后缀 */
export function resolveTryCloudflareAllowedHosts(
  raw = process.env.ALLOW_TRYCLOUDFLARE
): string[] | undefined {
  return isTryCloudflareAllowed(raw) ? [TRYCLOUDFLARE_ALLOWED_HOST] : undefined
}

/** Better Auth trustedOrigins / CORS：开启时返回通配 Origin */
export function resolveTryCloudflareTrustedOrigins(
  raw = process.env.ALLOW_TRYCLOUDFLARE
): string[] {
  return isTryCloudflareAllowed(raw) ? [TRYCLOUDFLARE_TRUSTED_ORIGIN] : []
}
