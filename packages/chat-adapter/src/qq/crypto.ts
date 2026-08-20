import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto'

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

function createWebhookPrivateKey(clientSecret: string) {
  const secret = Buffer.from(clientSecret, 'utf8')
  if (secret.length === 0) {
    throw new Error('QQ client secret must not be empty')
  }

  const repeatCount = Math.ceil(32 / secret.length)
  const seed = Buffer.concat(Array.from({ length: repeatCount }, () => secret), 32)
  const pkcs8Der = Buffer.concat([ED25519_PKCS8_PREFIX, seed])

  return createPrivateKey({ format: 'der', key: pkcs8Der, type: 'pkcs8' })
}

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
  const privateKey = createWebhookPrivateKey(clientSecret)
  const message = Buffer.from(eventTs + plainToken)
  const signature = sign(null, message, privateKey)

  return signature.toString('hex')
}

/** 验证 QQ Bot Webhook 事件请求的 Ed25519 签名。 */
export function verifyWebhookSignature(
  bodyText: string,
  timestamp: string,
  signature: string,
  clientSecret: string
): boolean {
  try {
    if (!timestamp || !/^[\da-f]{128}$/i.test(signature)) return false

    const privateKey = createWebhookPrivateKey(clientSecret)
    const publicKey = createPublicKey(privateKey)
    const message = Buffer.from(timestamp + bodyText)

    return verify(null, message, publicKey, Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}
