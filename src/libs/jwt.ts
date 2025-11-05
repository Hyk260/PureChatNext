import { SignJWT, jwtVerify } from "jose"
import { authEnv } from '@/envs/auth';
import { randomBytes } from "crypto"

const secret = new TextEncoder().encode(authEnv.NEXT_AUTH_SECRET)

export interface JWTPayload {
  userId: string
  email?: string
  role?: string
  exp?: number
}

// 验证 JWT Token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JWTPayload
  } catch (error) {
    const jwtError = error as { code?: string; name?: string; message?: string }
    const errorCode = jwtError?.code || jwtError?.name || 'UNKNOWN_ERROR'
    const errorMessage = jwtError?.message || 'Unknown error'
    
    console.error("JWT verification failed:", {
      code: errorCode,
      message: errorMessage,
      error
    })
    
    // 如果是签名验证失败，可能是 secret 不匹配
    if (errorCode === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') {
      console.error("Token signature verification failed. Possible reasons:")
      console.error("1. Token was signed with a different secret")
      console.error("2. Secret key mismatch between signing and verification")
      console.error("3. Token may have been tampered with")
      console.error("Current secret key length:", secret.length)
    }
    
    return null
  }
}

// 生成访问令牌 (Access Token) - 15分钟有效期
export async function generateAccessToken(userId: string): Promise<string> {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret)
}

// 生成刷新令牌 (Refresh Token) - 7天有效期，包含 token family
export async function generateRefreshToken(userId: string): Promise<{ token: string; family: string }> {
  const tokenFamily = randomBytes(16).toString("hex")
  const token = await new SignJWT({ userId, family: tokenFamily })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret)

  return { token, family: tokenFamily }
}

// 验证刷新令牌 (Refresh Token)
export async function verifyRefreshToken(token: string): Promise<{ valid: boolean; expired: boolean; userId?: string; email?: string; family?: string }> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return {
      valid: true,
      expired: false,
      userId: payload.userId as string,
      email: payload.email as string,
      family: payload.family as string | undefined
    }
  } catch (error) {
    const jwtError = error as { code?: string; name?: string }
    const isExpired = jwtError?.code === 'ERR_JWT_EXPIRED' || jwtError?.name === 'JWTExpired'
    return {
      valid: false,
      expired: isExpired
    }
  }
}
