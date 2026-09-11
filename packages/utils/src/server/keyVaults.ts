import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PREFIX_ENC = 'enc:v1:'

const getVaultSecret = () => process.env.KEY_VAULTS_SECRET?.trim()

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

/** Require `KEY_VAULTS_SECRET` before encrypting user provider secrets. */
export function requireKeyVaultsSecret(): string {
  const secret = getVaultSecret()
  if (!secret) throw new Error('KEY_VAULTS_SECRET is required to encrypt provider secrets')
  return secret
}

/** AES-256-GCM encrypt a UTF-8 string. Payload format: `enc:v1:` + base64(iv + tag + ciphertext). */
export function encryptVaultText(value: string): string {
  const key = deriveKey(requireKeyVaultsSecret())
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX_ENC + Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

/** Decrypt a payload produced by `encryptVaultText`. */
export function decryptVaultText(payload: string): string {
  if (!payload.startsWith(PREFIX_ENC)) throw new Error('Encrypted payload required')
  const packed = Buffer.from(payload.slice(PREFIX_ENC.length), 'base64')
  if (packed.length < 29) throw new Error('Invalid encrypted payload')
  const iv = packed.subarray(0, 12)
  const tag = packed.subarray(12, 28)
  const ciphertext = packed.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(requireKeyVaultsSecret()), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function encryptVaultJson(value: unknown): string {
  return encryptVaultText(JSON.stringify(value))
}

export function decryptVaultJson<T>(payload: string): T {
  return JSON.parse(decryptVaultText(payload)) as T
}

/** Last 4 characters of an API key for UI display. Never a substitute for the key. */
export function providerKeyHint(apiKey: string): string {
  const trimmed = apiKey.trim()
  if (trimmed.length <= 4) return trimmed
  return trimmed.slice(-4)
}
