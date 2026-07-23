import { createPrivateKey, sign } from 'node:crypto'

/**
 * PKCS#8 DER prefix for an Ed25519 private key seed.
 *
 * ASN.1:
 *   SEQUENCE {
 *     INTEGER 0
 *     SEQUENCE { OID 1.3.101.112 (Ed25519) }
 *     OCTET STRING { OCTET STRING { <32-byte seed> } }
 *   }
 */
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

/**
 * Ed25519 sign for QQ Bot webhook URL verification.
 *
 * Steps (see `docs/self-hosting/qq/protocol.zh-CN.md`):
 * 1. Repeat `clientSecret` until length ≥ 32, then take the first 32 bytes as seed
 * 2. Build an Ed25519 private key from that seed
 * 3. Sign `eventTs + plainToken`
 * 4. Return hex signature
 */
export function signWebhookResponse(eventTs: string, plainToken: string, clientSecret: string): string {
  let seedStr = clientSecret
  while (seedStr.length < 32) {
    seedStr = seedStr.repeat(2)
  }
  const seed = Buffer.from(seedStr.slice(0, 32), 'utf8')

  const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, seed])
  const privateKey = createPrivateKey({ format: 'der', key: pkcs8Der, type: 'pkcs8' })

  const message = Buffer.from(eventTs + plainToken)
  const signature = sign(null, message, privateKey)

  return signature.toString('hex')
}
