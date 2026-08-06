import { appEnv } from '@/envs/app'

/**
 * Gateway → webhook 转发的共享密钥。
 * 优先 WECHAT_WEBHOOK_SECRET；否则回退 CRON_SECRET。
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
