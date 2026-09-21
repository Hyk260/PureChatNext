import { createNanoId, generateCompactUuid } from '@pure/utils'

import { LOGIN_USERNAME_REGEX } from './login-identifier'

const USERNAME_MAX_LENGTH = 64
const SUFFIX_LENGTH = 4
const STEM_MAX_LENGTH = USERNAME_MAX_LENGTH - SUFFIX_LENGTH - 1
const MAX_SUFFIX_ATTEMPTS = 8
const usernameSuffix = createNanoId(SUFFIX_LENGTH)

/** 清洗成可登录用户名；无效或空则返回 null */
export function sanitizeUsername(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replaceAll(/[^\w]+/g, '_')
    .replaceAll(/_+/g, '_')
    .replaceAll(/^_|_$/g, '')
    .slice(0, USERNAME_MAX_LENGTH)

  return cleaned && LOGIN_USERNAME_REGEX.test(cleaned) ? cleaned : null
}

export async function allocateUniqueUsername(
  preferred: string,
  isTaken: (username: string) => Promise<boolean>,
  randomSuffix: () => string = usernameSuffix
): Promise<string> {
  const base = sanitizeUsername(preferred)
  if (base && !(await isTaken(base))) return base

  const stem = (base ?? 'user').slice(0, STEM_MAX_LENGTH)
  for (let i = 0; i < MAX_SUFFIX_ATTEMPTS; i++) {
    const candidate = `${stem}_${randomSuffix()}`
    if (!(await isTaken(candidate))) return candidate
  }

  // ponytail: 8 次短后缀后用 uuid；插入仍受 users_username_unique 兜底
  return `${stem.slice(0, USERNAME_MAX_LENGTH - 33)}_${generateCompactUuid()}`
}
