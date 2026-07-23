let apiKeyCounter = 0

/**
 * Generate an API key: `sk-pc-{16-char alnum}`.
 */
export function generateApiKey(): string {
  const timestamp = performance.now().toString(36).replaceAll('.', '')

  const random1 = Math.random().toString(36).slice(2)
  const random2 = Math.random().toString(36).slice(2)
  const random3 = Math.random().toString(36).slice(2)

  apiKeyCounter = (apiKeyCounter + 1) % 1_000_000
  const counter = apiKeyCounter.toString(36)

  const combined = (timestamp + random1 + random2 + random3 + counter).replaceAll(/[^\da-z]/g, '')

  let randomPart = combined.slice(0, 16)

  while (randomPart.length < 16) {
    const additional = Math.random().toString(36).slice(2)
    randomPart += additional
  }

  randomPart = randomPart.slice(0, 16)

  return `sk-pc-${randomPart}`
}

/** Whether `expiresAt` is in the past (`null` = never expires). */
export function isApiKeyExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false
  return new Date() > expiresAt
}

/**
 * Validate key shape. Accepts current `sk-pc-…` and legacy `sk-lh-…`.
 */
export function validateApiKeyFormat(key: string): boolean {
  return /^sk-(?:pc|lh)-[\da-z]{16}$/.test(key)
}
