#!/usr/bin/env node
/**
 * JWKS 密钥生成脚本
 * 用于生成用户 JWT 签名所需的 RS256 RSA 密钥对
 *
 * 使用方法:
 * node scripts/generate-jwks-key.mjs
 *
 * 将输出的单行 JSON 字符串设置为环境变量 JWKS_KEY
 */
import { exportJWK, generateKeyPair } from 'jose'
import crypto from 'node:crypto'

function generateKeyId() {
  return crypto.randomBytes(8).toString('hex')
}

async function generateJwks() {
  try {
    console.error('正在生成 RSA 密钥对...')

    const { privateKey } = await generateKeyPair('RS256', {
      extractable: true,
    })

    const jwk = await exportJWK(privateKey)

    jwk.use = 'sig'
    jwk.kid = generateKeyId()
    jwk.alg = 'RS256'

    const jwks = { keys: [jwk] }
    const jwksString = JSON.stringify(jwks)

    console.log(jwksString)

    console.error('\n✅ JWKS 已生成')
    console.error('请将上面输出的 JSON 字符串直接设置为环境变量 JWKS_KEY')
    console.error('例如在 .env.local 文件中添加:')
    console.error('\n> 环境变量配置行 (可直接复制):')
    console.error(`JWKS_KEY='${jwksString}'`)
    console.error('\n⚠️ 重要: 请妥善保管此密钥，它用于签署所有用户 JWT')

    return jwks
  } catch (error) {
    console.error('❌ 生成 JWKS 时出错:', error)
    process.exit(1)
  }
}

generateJwks()
