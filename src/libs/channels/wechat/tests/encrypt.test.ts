import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  serverDBEnv: { KEY_VAULTS_SECRET: 'test-secret-for-unit' as string | undefined },
}))

vi.mock('@/envs/serverDB', () => ({ serverDBEnv: mocks.serverDBEnv }))

import {
  decryptContextToken,
  decryptCredentials,
  encryptContextToken,
  encryptCredentials,
  requireWechatVaultSecret,
} from '../encrypt'

describe('wechat encryptCredentials', () => {
  beforeEach(() => {
    mocks.serverDBEnv.KEY_VAULTS_SECRET = 'test-secret-for-unit'
  })

  it('round-trips credentials with KEY_VAULTS_SECRET', () => {
    const creds = { botId: 'bot1', botToken: 'tok', userId: 'u1' }
    const enc = encryptCredentials(creds)
    expect(enc.startsWith('enc:v1:')).toBe(true)
    expect(decryptCredentials(enc)).toEqual(creds)
  })

  it('encrypts context tokens with the same authenticated secret box', () => {
    const encrypted = encryptContextToken('context-token-secret')
    expect(encrypted).not.toContain('context-token-secret')
    expect(decryptContextToken(encrypted)).toBe('context-token-secret')
  })

  it('still reads legacy plain credentials so the gateway can migrate them', () => {
    const creds = { botId: 'legacy-bot', botToken: 'legacy-token', userId: 'legacy-user' }
    const legacy = `plain:v1:${Buffer.from(JSON.stringify(creds)).toString('base64')}`
    expect(decryptCredentials(legacy)).toEqual(creds)
  })

  it('refuses to create new encrypted values without KEY_VAULTS_SECRET', () => {
    mocks.serverDBEnv.KEY_VAULTS_SECRET = undefined
    expect(() => requireWechatVaultSecret()).toThrow('KEY_VAULTS_SECRET')
    expect(() => encryptCredentials({ botId: 'bot', botToken: 'token', userId: 'user' })).toThrow(
      'KEY_VAULTS_SECRET'
    )
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
