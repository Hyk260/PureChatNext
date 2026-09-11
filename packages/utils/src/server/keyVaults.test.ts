// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'

import { decryptVaultJson, decryptVaultText, encryptVaultJson, encryptVaultText, providerKeyHint, requireKeyVaultsSecret } from './keyVaults'

const originalSecret = process.env.KEY_VAULTS_SECRET

describe('keyVaults', () => {
  afterEach(() => {
    process.env.KEY_VAULTS_SECRET = originalSecret
  })

  it('round-trips UTF-8 text with AES-256-GCM', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret-for-unit'
    const encrypted = encryptVaultText('sk-live-secret')
    expect(encrypted.startsWith('enc:v1:')).toBe(true)
    expect(encrypted).not.toContain('sk-live-secret')
    expect(decryptVaultText(encrypted)).toBe('sk-live-secret')
  })

  it('round-trips JSON vault payloads', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret-for-unit'
    const vault = { apiKey: 'sk-test', baseURL: 'https://api.deepseek.com' }
    expect(decryptVaultJson<typeof vault>(encryptVaultJson(vault))).toEqual(vault)
  })

  it('refuses to encrypt without KEY_VAULTS_SECRET', () => {
    delete process.env.KEY_VAULTS_SECRET
    expect(() => requireKeyVaultsSecret()).toThrow('KEY_VAULTS_SECRET')
    expect(() => encryptVaultText('x')).toThrow('KEY_VAULTS_SECRET')
  })

  it('rejects tampered ciphertext', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret-for-unit'
    const encrypted = encryptVaultText('payload')
    const tampered = `${encrypted.slice(0, -2)}aa`
    expect(() => decryptVaultText(tampered)).toThrow()
  })

  it('uses the last four characters as a key hint', () => {
    expect(providerKeyHint('sk-abcdefgh')).toBe('efgh')
    expect(providerKeyHint('ab')).toBe('ab')
    expect(providerKeyHint('  sk-wxyz  ')).toBe('wxyz')
  })
})
