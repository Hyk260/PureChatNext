/**
 * Shared secret for gateway → webhook forwarding.
 * Prefer WECHAT_WEBHOOK_SECRET; fall back to CRON_SECRET.
 */
export function resolveWechatWebhookSecret(): string {
  return (
    process.env.WECHAT_WEBHOOK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    ''
  )
}

export function authorizeWechatWebhook(request: Request): boolean {
  const secret = resolveWechatWebhookSecret()
  // No secret configured → allow (local/dev). Production should set CRON_SECRET.
  if (!secret) return true

  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}
