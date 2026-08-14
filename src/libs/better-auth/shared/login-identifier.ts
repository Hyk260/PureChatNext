/** 与资料页用户名规则一致：字母、数字、下划线，最长 64 */
export const LOGIN_USERNAME_REGEX = /^\w{1,64}$/

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type LoginIdentifier = { kind: 'email'; value: string } | { kind: 'username'; value: string }

export function normalizeLoginIdentifier(raw: string): LoginIdentifier | null {
  const value = raw.trim()
  if (!value) return null

  if (value.includes('@')) {
    const email = value.toLowerCase()
    if (!EMAIL_REGEX.test(email)) return null
    return { kind: 'email', value: email }
  }

  if (!LOGIN_USERNAME_REGEX.test(value)) return null
  return { kind: 'username', value }
}
