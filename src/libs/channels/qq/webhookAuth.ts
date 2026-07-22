import { appEnv } from '@/envs/app'

/**
 * Shared secret for gateway → webhook forwarding.
 * Prefer QQ_WEBHOOK_SECRET; fall back to CRON_SECRET.
 * Public QQ Open Platform callbacks use Ed25519 (adapter), not this secret.
 */
export function resolveQQWebhookSecret(): string {
  return appEnv.QQ_WEBHOOK_SECRET?.trim() || appEnv.CRON_SECRET?.trim() || ''
}

export function authorizeQQInternalWebhook(request: Request): boolean {
  const secret = resolveQQWebhookSecret()
  // No secret configured → allow (local/dev). Production should set CRON_SECRET.
  if (!secret) return true

  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}
