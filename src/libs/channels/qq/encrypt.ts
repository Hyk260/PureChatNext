import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

import { serverDBEnv } from '@/envs/serverDB'

export type QQConnectionMode = 'websocket' | 'webhook'

/** Credentials from QQ Open Platform, stored encrypted in channel_bindings. */
export type QQCredentials = {
  appId: string
  appSecret: string
  connectionMode: QQConnectionMode
}

const PREFIX_ENC = 'enc:v1:'
const PREFIX_PLAIN = 'plain:v1:'

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest()
}

/**
 * Encrypt credentials for DB storage.
 * Uses AES-256-GCM when KEY_VAULTS_SECRET is set; otherwise plain base64 (server-only).
 */
export function encryptCredentials(credentials: QQCredentials): string {
  const json = JSON.stringify(credentials)
  const secret = serverDBEnv.KEY_VAULTS_SECRET?.trim()

  if (!secret) {
    return PREFIX_PLAIN + Buffer.from(json, 'utf8').toString('base64')
  }

  const key = deriveKey(secret)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const packed = Buffer.concat([iv, tag, ciphertext])
  return PREFIX_ENC + packed.toString('base64')
}

export function decryptCredentials(payload: string): QQCredentials {
  let parsed: QQCredentials

  if (payload.startsWith(PREFIX_PLAIN)) {
    const json = Buffer.from(payload.slice(PREFIX_PLAIN.length), 'base64').toString('utf8')
    parsed = JSON.parse(json) as QQCredentials
  } else if (payload.startsWith(PREFIX_ENC)) {
    const secret = serverDBEnv.KEY_VAULTS_SECRET?.trim()
    if (!secret) {
      throw new Error('KEY_VAULTS_SECRET is required to decrypt qq credentials')
    }
    const packed = Buffer.from(payload.slice(PREFIX_ENC.length), 'base64')
    const iv = packed.subarray(0, 12)
    const tag = packed.subarray(12, 28)
    const ciphertext = packed.subarray(28)
    const key = deriveKey(secret)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    parsed = JSON.parse(json) as QQCredentials
  } else {
    parsed = JSON.parse(payload) as QQCredentials
  }

  if (!parsed.connectionMode) {
    parsed.connectionMode = 'websocket'
  }

  return parsed
}
