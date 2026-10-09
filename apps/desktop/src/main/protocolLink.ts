import { APP_RENDERER_URL } from './rendererSecurity'

const protocolScheme = 'purechat:'

export interface DesktopAuthProtocolCallback {
  code: string | null
  error: string | null
  errorDescription: string | null
  state: string | null
}

const parseProtocolUrl = (value: string) => {
  try {
    const url = new URL(value)
    if (url.protocol !== protocolScheme || url.username || url.password || url.port || !url.hostname) return null
    return url
  } catch {
    return null
  }
}

export const parseDesktopAuthCallback = (value: string): DesktopAuthProtocolCallback | null => {
  const url = parseProtocolUrl(value)
  if (!url || url.hostname !== 'auth' || url.pathname !== '/callback') return null
  return {
    code: url.searchParams.get('code'),
    error: url.searchParams.get('error'),
    errorDescription: url.searchParams.get('error_description'),
    state: url.searchParams.get('state'),
  }
}

export const isRecognizedProtocolLink = (value: string) => Boolean(parseProtocolUrl(value))

/**
 * Convert an OS-level purechat:// link into a trusted renderer URL.
 *
 * `purechat://renderer/...` is already an internal renderer URL. For public
 * deep links such as `purechat://chat/123`, the host becomes the first SPA
 * path segment so the custom renderer origin remains protected.
 */
export const resolveProtocolLink = (value: string): string | null => {
  const url = parseProtocolUrl(value)
  if (!url || parseDesktopAuthCallback(value)) return null

  if (url.hostname === 'renderer') {
    return `${APP_RENDERER_URL}${url.pathname.replace(/^\/+/, '')}${url.search}${url.hash}`
  }

  const path = `/${url.hostname}${url.pathname}`.replace(/\/+/g, '/')
  return `${APP_RENDERER_URL}${path.replace(/^\/+/, '')}${url.search}${url.hash}`
}

export const protocolLinksFromCommandLine = (args: readonly string[]): string[] =>
  args.filter(isRecognizedProtocolLink)
