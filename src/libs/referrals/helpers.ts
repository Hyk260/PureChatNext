import { z } from 'zod'

export const REFERRAL_BATCH_MAX = 3
export const referralCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{8}$/, '请输入 8 位字母或数字邀请码')

export function maskReferralEmail(email: string) {
  const separator = email.lastIndexOf('@')
  if (separator < 0) return '***'
  const local = Array.from(email.slice(0, separator))
  const domain = email.slice(separator + 1)
  if (local.length >= 6) return `${local.slice(0, 2).join('')}***${local.at(-1)}@${domain}`
  if (local.length >= 4) return `${local[0]}***${local.at(-1)}@${domain}`
  if (local.length === 3) return `${local[0]}***@${domain}`
  return `***@${domain}`
}

export function getReferralContext(params: Pick<URLSearchParams, 'get'>) {
  const direct = params.get('referral_context')
  if (direct) return direct
  const callback = params.get('callbackUrl')
  if (!callback || !isReferralCallback(callback)) return ''
  return new URL(callback, 'http://localhost').searchParams.get('referral_context') || ''
}
export const REFERRAL_DAYS = [7, 30, 90, 0] as const
export const REFERRAL_STATUS_LABELS = {
  sending: '发送结果待确认',
  sent: '邀请已发送',
  failed: '发送失败',
  accepted: '已接受',
  expired: '已过期',
}
export const referralEmailsSchema = z.array(z.string().trim().toLowerCase().email()).min(1).max(REFERRAL_BATCH_MAX)

export function parseReferralEmails(input: string) {
  const emails = [
    ...new Set(
      input
        .split(/[,，;；\s]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    ),
  ]
  const invalid = emails.filter((email) => !z.string().email().safeParse(email).success)
  let error: string | null = null
  if (!emails.length) error = '请添加电子邮箱'
  else if (invalid.length) error = `请输入有效邮箱：${invalid.join('、')}`
  else if (emails.length > REFERRAL_BATCH_MAX) error = `每次最多邀请 ${REFERRAL_BATCH_MAX} 位好友`
  return { emails, error }
}

export function referralCallback(context: string) {
  return `/accept-referral?${new URLSearchParams({ referral_context: context })}`
}

export function isReferralCallback(callbackUrl: string) {
  try {
    const url = new URL(callbackUrl, 'http://localhost')
    return url.pathname === '/accept-referral' && Boolean(url.searchParams.get('referral_context'))
  } catch {
    return false
  }
}

/** Strip nested callback URLs too: signup/verification queries contain bearer tokens. */
export function sanitizeReferralTelemetryUrl(raw: string) {
  try {
    const url = new URL(raw, 'http://localhost')
    const callback = url.searchParams.get('callbackUrl') || url.searchParams.get('callbackURL')
    if (url.searchParams.has('referral_context') || (callback && isReferralCallback(callback))) {
      url.search = ''
      url.hash = ''
    }
    return raw.startsWith('/') ? `${url.pathname}${url.search}${url.hash}` : url.toString()
  } catch {
    return raw
  }
}
