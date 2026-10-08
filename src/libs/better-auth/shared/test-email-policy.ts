/**
 * RFC 2606/6761 保留域名以及本地开发常用的测试域名。
 * 这些地址不是可投递的真实邮箱，不应触发认证邮件发送。
 */
const TEST_EMAIL_DOMAINS = new Set(['example.com', 'example.net', 'example.org', 'invalid', 'localhost', 'test'])

export const TEST_EMAIL_POLICY_MESSAGE = '请使用可接收邮件的真实邮箱注册'

export const isObviousTestEmail = (email: string | null | undefined) => {
  if (!email) return false

  const normalized = email.trim().toLowerCase()
  const atIndex = normalized.lastIndexOf('@')
  if (atIndex <= 0 || atIndex === normalized.length - 1) return false

  const domain = normalized.slice(atIndex + 1)
  return TEST_EMAIL_DOMAINS.has(domain) || domain.endsWith('.test') || domain.endsWith('.invalid')
}
