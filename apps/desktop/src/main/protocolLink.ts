import { APP_RENDERER_URL } from './rendererSecurity'

const protocolScheme = 'purechat:'

/**
 * Convert an OS-level purechat:// link into a trusted renderer URL.
 *
 * `purechat://renderer/...` is already an internal renderer URL. For public
 * deep links such as `purechat://chat/123`, the host becomes the first SPA
 * path segment so the custom renderer origin remains protected.
 */
export const resolveProtocolLink = (value: string): string | null => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }

  if (url.protocol !== protocolScheme || url.username || url.password || url.port || !url.hostname) return null

  if (url.hostname === 'renderer') {
    return `${APP_RENDERER_URL}${url.pathname.replace(/^\/+/, '')}${url.search}${url.hash}`
  }

  const path = `/${url.hostname}${url.pathname}`.replace(/\/+/g, '/')
  return `${APP_RENDERER_URL}${path.replace(/^\/+/, '')}${url.search}${url.hash}`
}

export const protocolLinksFromCommandLine = (args: readonly string[]): string[] =>
  args.filter((value) => resolveProtocolLink(value) !== null)
