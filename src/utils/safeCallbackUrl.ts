/**
 * Resolve post-login redirect targets without open redirects.
 * Only same-app relative paths (`/...`) are allowed.
 */
export function resolveCallbackUrl(
  raw: string | null | undefined,
  fallback = '/',
): string {
  if (!raw) return fallback

  const value = raw.trim()
  if (!value) return fallback

  // Reject protocol-relative and absolute URLs
  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  // Reject backslash tricks / encoded absolute URLs
  if (value.includes('\\') || /^\/[a-z][a-z0-9+.-]*:/i.test(value)) {
    return fallback
  }

  return value
}
