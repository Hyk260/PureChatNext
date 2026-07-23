import debug from 'debug'
import { importJWK, jwtVerify, SignJWT } from 'jose'
import { randomBytes } from 'node:crypto'

import { authEnv } from '@/envs/auth'

const log = debug('auth:jwt')

const ACCESS_TOKEN_PURPOSE = 'access' as const
const REFRESH_TOKEN_PURPOSE = 'refresh' as const

export interface AccessTokenPayload {
  purpose: typeof ACCESS_TOKEN_PURPOSE
  sub: string
  userId: string
  role?: string
  exp?: number
}

export interface RefreshTokenPayload {
  purpose: typeof REFRESH_TOKEN_PURPOSE
  sub: string
  userId: string
  family: string
}

export type VerifyRefreshResult =
  { valid: true; expired: false; userId: string; family: string } | { valid: false; expired: boolean }

interface JwkKey {
  alg?: string
  d?: string
  dp?: string
  dq?: string
  e?: string
  kid?: string
  kty?: string
  n?: string
  p?: string
  q?: string
  qi?: string
  use?: string
}

interface Jwks {
  keys: JwkKey[]
}

const getJwksKey = (): JwkKey => {
  const jwksString = authEnv.JWKS_KEY

  if (!jwksString) {
    throw new Error('JWKS_KEY environment variable is not set')
  }

  const jwks = JSON.parse(jwksString) as Jwks
  const rsaKey = jwks.keys.find((key) => key.alg === 'RS256' && key.kty === 'RSA')

  if (!rsaKey) {
    throw new Error('No RS256 RSA key found in JWKS')
  }

  return rsaKey
}

const getSigningKey = async () => {
  const rsaKey = getJwksKey()

  return {
    key: await importJWK(rsaKey, 'RS256'),
    kid: rsaKey.kid as string,
  }
}

const getVerificationKey = async () => {
  const privateRsaKey = getJwksKey()

  const publicKeyJwk: JwkKey = {
    alg: privateRsaKey.alg,
    e: privateRsaKey.e,
    kid: privateRsaKey.kid,
    kty: privateRsaKey.kty,
    n: privateRsaKey.n,
    use: privateRsaKey.use,
  }

  for (const key of Object.keys(publicKeyJwk) as (keyof JwkKey)[]) {
    if (publicKeyJwk[key] === undefined) {
      delete publicKeyJwk[key]
    }
  }

  return importJWK(publicKeyJwk, 'RS256')
}

const isJwtExpiredError = (error: unknown): boolean => {
  const jwtError = error as { code?: string; name?: string }
  return jwtError?.code === 'ERR_JWT_EXPIRED' || jwtError?.name === 'JWTExpired'
}

const toAccessTokenPayload = (payload: Record<string, unknown>): AccessTokenPayload | null => {
  if (payload.purpose !== ACCESS_TOKEN_PURPOSE) {
    log('Access token purpose mismatch: expected %s, got %s', ACCESS_TOKEN_PURPOSE, payload.purpose)
    return null
  }

  const userId = typeof payload.userId === 'string' ? payload.userId : payload.sub

  if (typeof userId !== 'string' || !userId) {
    log('Access token missing userId/sub claim')
    return null
  }

  return {
    purpose: ACCESS_TOKEN_PURPOSE,
    sub: typeof payload.sub === 'string' ? payload.sub : userId,
    userId,
    role: typeof payload.role === 'string' ? payload.role : undefined,
    exp: typeof payload.exp === 'number' ? payload.exp : undefined,
  }
}

/**
 * Sign a short-lived access token for authenticated API requests.
 */
export const signAccessToken = async (userId: string, role?: string): Promise<string> => {
  const { key, kid } = await getSigningKey()

  const jwt = new SignJWT({
    purpose: ACCESS_TOKEN_PURPOSE,
    userId,
    ...(role ? { role } : {}),
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(authEnv.JWT_ACCESS_EXPIRATION)

  log('Signing access token for user %s', userId)
  return jwt.sign(key)
}

/**
 * Verify an access token and return its payload when valid.
 */
export const verifyAccessToken = async (token: string): Promise<AccessTokenPayload | null> => {
  try {
    log('Verifying access token')

    const publicKey = await getVerificationKey()
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
    })

    const accessPayload = toAccessTokenPayload(payload as Record<string, unknown>)

    if (!accessPayload) {
      return null
    }

    log('Access token verification successful for user %s', accessPayload.userId)
    return accessPayload
  } catch (error) {
    log('Access token verification failed: %O', error)
    return null
  }
}

/**
 * Sign a refresh token with a token family identifier.
 */
export const signRefreshToken = async (userId: string): Promise<{ token: string; family: string }> => {
  const { key, kid } = await getSigningKey()
  const tokenFamily = randomBytes(16).toString('hex')

  const token = await new SignJWT({
    purpose: REFRESH_TOKEN_PURPOSE,
    userId,
    family: tokenFamily,
  })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(authEnv.JWT_REFRESH_EXPIRATION)
    .sign(key)

  log('Signing refresh token for user %s', userId)
  return { token, family: tokenFamily }
}

/**
 * Verify a refresh token and distinguish expired vs invalid tokens.
 */
export const verifyRefreshToken = async (token: string): Promise<VerifyRefreshResult> => {
  try {
    log('Verifying refresh token')

    const publicKey = await getVerificationKey()
    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
    })

    if (payload.purpose !== REFRESH_TOKEN_PURPOSE) {
      log('Refresh token purpose mismatch: expected %s, got %s', REFRESH_TOKEN_PURPOSE, payload.purpose)
      return { valid: false, expired: false }
    }

    const userId = typeof payload.userId === 'string' ? payload.userId : payload.sub
    const family = payload.family

    if (typeof userId !== 'string' || !userId || typeof family !== 'string' || !family) {
      log('Refresh token missing required claims')
      return { valid: false, expired: false }
    }

    log('Refresh token verification successful for user %s', userId)
    return {
      valid: true,
      expired: false,
      userId,
      family,
    }
  } catch (error) {
    log('Refresh token verification failed: %O', error)
    return {
      valid: false,
      expired: isJwtExpiredError(error),
    }
  }
}
