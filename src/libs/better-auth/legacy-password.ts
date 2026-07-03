import { createHash } from 'node:crypto'

import { hashPassword } from 'better-auth/crypto'

export const LEGACY_SHA256_PREFIX = 'legacy-sha256:'

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i

export function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$')
}

export function isSha256HexHash(hash: string): boolean {
  return SHA256_HEX_RE.test(hash)
}

/**
 * 将 users.password 中的旧格式转换为 accounts.password 可存储的格式。
 * - bcrypt：原样保留
 * - SHA256 hex：加 legacy-sha256: 前缀
 * - 明文（早期测试数据）：用 Better Auth scrypt 重新哈希
 */
export async function migrateStoredPasswordToAccount(storedPassword: string): Promise<string> {
  if (isBcryptHash(storedPassword)) {
    return storedPassword
  }

  if (isSha256HexHash(storedPassword)) {
    return `${LEGACY_SHA256_PREFIX}${storedPassword}`
  }

  return hashPassword(storedPassword)
}

/**
 * 校验 legacy 格式密码；若不是 legacy 格式则返回 null，交由其他 verifier 处理。
 */
export function verifyLegacyStoredPassword(hash: string, password: string): boolean | null {
  if (hash.startsWith(LEGACY_SHA256_PREFIX)) {
    const stored = hash.slice(LEGACY_SHA256_PREFIX.length)
    return createHash('sha256').update(password).digest('hex') === stored
  }

  if (isSha256HexHash(hash)) {
    return createHash('sha256').update(password).digest('hex') === hash
  }

  return null
}
