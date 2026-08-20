import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { signWebhookResponse, verifyWebhookSignature } from '../crypto'

const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')
const OFFICIAL_SECRET = 'DG5g3B4j9X2KOErG'

function createIndependentPrivateKey(secretText: string) {
  const secret = Buffer.from(secretText, 'utf8')
  const seed = Buffer.alloc(32)

  for (let offset = 0; offset < seed.length; offset += secret.length) {
    secret.copy(seed, offset, 0, Math.min(secret.length, seed.length - offset))
  }

  return createPrivateKey({
    format: 'der',
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    type: 'pkcs8',
  })
}

describe('QQ webhook crypto', () => {
  it('matches the official op=13 signature vector exactly', () => {
    expect(signWebhookResponse('1725442341', 'Arq0D5A61EgUu4OxUvOp', OFFICIAL_SECRET)).toBe(
      '87befc99c42c651b3aac0278e71ada338433ae26fcb24307bdc5ad38c1adc2d01bcfcadc0842edac85e85205028a1132afe09280305f13aa6909ffc2d652c706'
    )
  })

  it('verifies an independently signed inbound request with its exact raw body', () => {
    const bodyText = '{ "op": 0,"d": {}, "t": "GATEWAY_EVENT_NAME"}'
    const timestamp = '1725442341'
    const privateKey = createIndependentPrivateKey(OFFICIAL_SECRET)
    const publicKey = createPublicKey(privateKey)
    const message = Buffer.from(timestamp + bodyText)
    const signature = sign(null, message, privateKey)

    expect(verify(null, message, publicKey, signature)).toBe(true)
    expect(verifyWebhookSignature(bodyText, timestamp, signature.toString('hex'), OFFICIAL_SECRET)).toBe(
      true
    )
    expect(
      verifyWebhookSignature(`${bodyText} `, timestamp, signature.toString('hex'), OFFICIAL_SECRET)
    ).toBe(false)
  })

  it.each(['', 'not-hex', '00'])('returns false for malformed signature %j', (signature) => {
    expect(verifyWebhookSignature('{}', '1725442341', signature, OFFICIAL_SECRET)).toBe(false)
  })

  it('returns false instead of throwing for invalid key material', () => {
    expect(verifyWebhookSignature('{}', '1725442341', '00'.repeat(64), '')).toBe(false)
  })
})
