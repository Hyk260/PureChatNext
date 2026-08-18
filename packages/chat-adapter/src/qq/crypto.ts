import { createPrivateKey, sign } from 'node:crypto'

/**
 * Ed25519 私钥种子的 PKCS#8 DER 前缀。
 *
 * ASN.1 结构：
 *   SEQUENCE {
 *     INTEGER 0
 *     SEQUENCE { OID 1.3.101.112（Ed25519） }
 *     OCTET STRING { OCTET STRING { <32 字节种子> } }
 *   }
 */
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

/**
 * 为 QQ Bot Webhook 地址验证生成 Ed25519 签名。
 *
 * 步骤（详见 `docs/self-hosting/qq/protocol.zh-CN.md`）：
 * 1. 重复 `clientSecret` 直到长度不小于 32，再截取前 32 字节作为种子；
 * 2. 根据种子构造 Ed25519 私钥；
 * 3. 对 `eventTs + plainToken` 进行签名；
 * 4. 返回十六进制格式的签名。
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
