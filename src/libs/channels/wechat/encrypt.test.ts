import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/envs/serverDB', () => ({
  serverDBEnv: { KEY_VAULTS_SECRET: 'test-secret-for-unit' },
}))

import { encryptCredentials, decryptCredentials } from './encrypt'

describe('wechat encryptCredentials', () => {
  it('round-trips credentials with KEY_VAULTS_SECRET', () => {
    const creds = { botId: 'bot1', botToken: 'tok', userId: 'u1' }
    const enc = encryptCredentials(creds)
    expect(enc.startsWith('enc:v1:')).toBe(true)
    expect(decryptCredentials(enc)).toEqual(creds)
  })
})

describe('aes helpers sanity', () => {
  it('aes-256-gcm basic', () => {
    const key = createHash('sha256').update('x').digest()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ct = Buffer.concat([cipher.update('hi', 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    expect(Buffer.concat([decipher.update(ct), decipher.final()]).toString()).toBe('hi')
  })
})
