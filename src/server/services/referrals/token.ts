import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

const contextSchema = z.object({ v: z.literal(1), token: z.string().max(1024) }).strict()
const tokenSchema = z.object({ id: z.string().uuid(), exp: z.number().int().positive() }).strict()
const signature = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(`purechat-referral:${payload}`).digest('base64url')

export function createReferralContext(id: string, expiresAt: Date, secret: string) {
  const payload = Buffer.from(JSON.stringify({ id, exp: expiresAt.getTime() })).toString('base64url')
  return Buffer.from(JSON.stringify({ v: 1, token: `${payload}.${signature(payload, secret)}` })).toString('base64url')
}

/** Expiration is checked against the database so accepted links remain idempotent. */
export function parseReferralContext(context: string, secret: string) {
  try {
    if (!context || context.length > 2048) return null
    const decoded = contextSchema.parse(JSON.parse(Buffer.from(context, 'base64url').toString('utf8')))
    const parts = decoded.token.split('.')
    if (parts.length !== 2) return null
    const [payload, supplied] = parts
    const expected = Buffer.from(signature(payload!, secret))
    const actual = Buffer.from(supplied!)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    return tokenSchema.parse(JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')))
  } catch {
    return null
  }
}
