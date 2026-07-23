import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/envs/auth', () => ({
  authEnv: {
    JWT_ACCESS_EXPIRATION: '15m',
    JWT_REFRESH_EXPIRATION: '7d',
    JWKS_KEY: JSON.stringify({
      keys: [
        {
          alg: 'RS256',
          d: 'private-d',
          dp: 'private-dp',
          dq: 'private-dq',
          e: 'AQAB',
          kid: 'test-kid',
          kty: 'RSA',
          n: 'test-modulus',
          p: 'private-p',
          q: 'private-q',
          qi: 'private-qi',
          use: 'sig',
        },
      ],
    }),
  },
}))

const signMock = vi.fn().mockResolvedValue('signed.jwt.token')
const setExpirationTimeMock = vi.fn()
const setIssuedAtMock = vi.fn()
const setSubjectMock = vi.fn()
const setProtectedHeaderMock = vi.fn()

const buildSignJWTChain = () => {
  const chain = {
    setExpirationTime: setExpirationTimeMock,
    setIssuedAt: setIssuedAtMock,
    setProtectedHeader: setProtectedHeaderMock,
    setSubject: setSubjectMock,
    sign: signMock,
  }

  setProtectedHeaderMock.mockReturnValue(chain)
  setSubjectMock.mockReturnValue(chain)
  setIssuedAtMock.mockReturnValue(chain)
  setExpirationTimeMock.mockReturnValue(chain)

  return chain
}

const SignJWTMock = vi.fn()
const importJWKMock = vi.fn().mockResolvedValue('mock-crypto-key')
const jwtVerifyMock = vi.fn()

vi.mock('jose', () => ({
  SignJWT: SignJWTMock,
  importJWK: (...args: unknown[]) => importJWKMock(...args),
  jwtVerify: (...args: unknown[]) => jwtVerifyMock(...args),
}))

describe('auth/jwt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    importJWKMock.mockResolvedValue('mock-crypto-key')
    signMock.mockResolvedValue('signed.jwt.token')
    SignJWTMock.mockImplementation(() => buildSignJWTChain())
  })

  describe('signAccessToken', () => {
    it('signs an access token with configured expiry and purpose', async () => {
      const { signAccessToken } = await import('./jwt')

      const token = await signAccessToken('user-123')

      expect(token).toBe('signed.jwt.token')
      expect(SignJWTMock).toHaveBeenCalledWith({
        purpose: 'access',
        userId: 'user-123',
      })
      expect(setSubjectMock).toHaveBeenCalledWith('user-123')
      expect(setExpirationTimeMock).toHaveBeenCalledWith('15m')
      expect(setProtectedHeaderMock).toHaveBeenCalledWith({ alg: 'RS256', kid: 'test-kid' })
      expect(signMock).toHaveBeenCalledWith('mock-crypto-key')
    })

    it('includes role claim when provided', async () => {
      const { signAccessToken } = await import('./jwt')

      await signAccessToken('user-123', 'admin')

      expect(SignJWTMock).toHaveBeenCalledWith({
        purpose: 'access',
        userId: 'user-123',
        role: 'admin',
      })
    })
  })

  describe('signRefreshToken', () => {
    it('signs a refresh token with family claim', async () => {
      const { signRefreshToken } = await import('./jwt')

      const result = await signRefreshToken('user-123')

      expect(result.token).toBe('signed.jwt.token')
      expect(result.family).toMatch(/^[a-f0-9]{32}$/)
      expect(SignJWTMock).toHaveBeenCalledWith({
        purpose: 'refresh',
        userId: 'user-123',
        family: result.family,
      })
      expect(setExpirationTimeMock).toHaveBeenCalledWith('7d')
    })
  })

  describe('verifyAccessToken', () => {
    it('returns payload when purpose matches', async () => {
      jwtVerifyMock.mockResolvedValue({
        payload: {
          purpose: 'access',
          sub: 'user-123',
          userId: 'user-123',
          exp: 1_700_000_000,
        },
      })

      const { verifyAccessToken } = await import('./jwt')
      const payload = await verifyAccessToken('valid.token')

      expect(payload).toEqual({
        purpose: 'access',
        sub: 'user-123',
        userId: 'user-123',
        exp: 1_700_000_000,
      })
    })

    it('returns null when purpose mismatches', async () => {
      jwtVerifyMock.mockResolvedValue({
        payload: {
          purpose: 'refresh',
          sub: 'user-123',
          userId: 'user-123',
        },
      })

      const { verifyAccessToken } = await import('./jwt')
      const payload = await verifyAccessToken('refresh.token')

      expect(payload).toBeNull()
    })

    it('returns null when verification throws', async () => {
      jwtVerifyMock.mockRejectedValue(new Error('invalid token'))

      const { verifyAccessToken } = await import('./jwt')
      const payload = await verifyAccessToken('invalid.token')

      expect(payload).toBeNull()
    })
  })

  describe('verifyRefreshToken', () => {
    it('returns valid result for refresh token payload', async () => {
      jwtVerifyMock.mockResolvedValue({
        payload: {
          purpose: 'refresh',
          sub: 'user-123',
          userId: 'user-123',
          family: 'family-abc',
        },
      })

      const { verifyRefreshToken } = await import('./jwt')
      const result = await verifyRefreshToken('valid.refresh.token')

      expect(result).toEqual({
        valid: true,
        expired: false,
        userId: 'user-123',
        family: 'family-abc',
      })
    })

    it('returns invalid result when purpose mismatches', async () => {
      jwtVerifyMock.mockResolvedValue({
        payload: {
          purpose: 'access',
          sub: 'user-123',
          userId: 'user-123',
          family: 'family-abc',
        },
      })

      const { verifyRefreshToken } = await import('./jwt')
      const result = await verifyRefreshToken('access.token')

      expect(result).toEqual({
        valid: false,
        expired: false,
      })
    })

    it('returns expired result for expired JWT errors', async () => {
      jwtVerifyMock.mockRejectedValue({
        code: 'ERR_JWT_EXPIRED',
        name: 'JWTExpired',
      })

      const { verifyRefreshToken } = await import('./jwt')
      const result = await verifyRefreshToken('expired.token')

      expect(result).toEqual({
        valid: false,
        expired: true,
      })
    })

    it('returns invalid result for non-expired verification errors', async () => {
      jwtVerifyMock.mockRejectedValue(new Error('bad signature'))

      const { verifyRefreshToken } = await import('./jwt')
      const result = await verifyRefreshToken('bad.token')

      expect(result).toEqual({
        valid: false,
        expired: false,
      })
    })
  })
})
