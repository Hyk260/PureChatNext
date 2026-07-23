import { createHmac } from 'node:crypto'

/** HMAC secret for API key hashing (`KEY_VAULTS_SECRET`). */
const getApiKeyHashSecret = () => process.env.KEY_VAULTS_SECRET

/** SHA-256 HMAC hex digest of an API key */
export const hashApiKey = (apiKey: string): string => {
  const secret = getApiKeyHashSecret()

  if (!secret) {
    throw new Error('`KEY_VAULTS_SECRET` is required for API key hash calculation.')
  }

  return createHmac('sha256', secret).update(apiKey).digest('hex')
}
