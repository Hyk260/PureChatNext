import { verifyPassword } from 'better-auth/crypto'

export async function verifyAccountPassword(hash: string, password: string): Promise<boolean> {
  if (!hash) return false

  return verifyPassword({ hash, password })
}
