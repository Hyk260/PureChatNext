import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import { serverDBEnv } from '@/envs/serverDB'

/** Credentials from WeChat iLink QR scan, stored encrypted in channel_bindings. */
export type WechatCredentials = {
  botId: string
  botToken: string
  userId: string
}

const PREFIX_ENC = 'enc:v1:'
const PREFIX_PLAIN = 'plain:v1:'

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

export function requireWechatVaultSecret(): string {
  const secret = serverDBEnv.KEY_VAULTS_SECRET?.trim()
  if (!secret) throw new Error('KEY_VAULTS_SECRET is required for the WeChat gateway')
  return secret
}

function encryptText(value: string): string {
  const secret = requireWechatVaultSecret()
  const key = deriveKey(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX_ENC + Buffer.concat([iv, tag, ciphertext]).toString('base64')
}

function decryptText(payload: string): string {
  if (!payload.startsWith(PREFIX_ENC)) throw new Error('Encrypted payload required')
  const packed = Buffer.from(payload.slice(PREFIX_ENC.length), 'base64')
  if (packed.length < 29) throw new Error('Invalid encrypted payload')
  const iv = packed.subarray(0, 12)
  const tag = packed.subarray(12, 28)
  const ciphertext = packed.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(requireWechatVaultSecret()), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * Encrypt credentials for DB storage.
 * New credentials are always AES-256-GCM encrypted.
 */
export function encryptCredentials(credentials: WechatCredentials): string {
  return encryptText(JSON.stringify(credentials))
}

export function decryptCredentials(payload: string): WechatCredentials {
  if (payload.startsWith(PREFIX_PLAIN)) {
    const json = Buffer.from(payload.slice(PREFIX_PLAIN.length), 'base64').toString('utf8')
    return JSON.parse(json) as WechatCredentials
  }

  if (payload.startsWith(PREFIX_ENC)) {
    return JSON.parse(decryptText(payload)) as WechatCredentials
  }

  // Legacy / raw JSON fallback
  return JSON.parse(payload) as WechatCredentials
}

export const credentialsNeedMigration = (payload: string) => !payload.startsWith(PREFIX_ENC)

export function encryptContextToken(token: string): string {
  return encryptText(token)
}

export function decryptContextToken(payload: string): string {
  return decryptText(payload)
}
