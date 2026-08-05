import { appEnv } from '@/envs/app'

/**
 * Shared secret for gateway → webhook forwarding.
 * Prefer WECHAT_WEBHOOK_SECRET; fall back to CRON_SECRET.
 */
export function resolveWechatWebhookSecret(): string {
  return appEnv.WECHAT_WEBHOOK_SECRET?.trim() || appEnv.CRON_SECRET?.trim() || ''
}

export function authorizeWechatWebhook(request: Request): boolean {
  const secret = resolveWechatWebhookSecret()
  if (!secret) return false

  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}
