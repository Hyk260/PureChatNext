import { resolveCallbackUrl } from './safeCallbackUrl'

export const DESKTOP_AUTH_BLOCKED_PATHS = [
  '/login',
  '/signin',
  '/signup',
  '/verify-email',
  '/reset-password',
  '/auth-error',
  '/desktop-authorize',
] as const

export const isDesktopAuthBlockedPath = (pathname: string) =>
  DESKTOP_AUTH_BLOCKED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

export const resolveDesktopCallbackUrl = (raw: string | null | undefined) => {
  const callbackUrl = resolveCallbackUrl(raw, '/chat')
  return isDesktopAuthBlockedPath(new URL(callbackUrl, 'purechat://renderer').pathname) ? '/chat' : callbackUrl
}

export const isDesktopRenderer = () =>
  typeof window !== 'undefined' && Boolean(window.pureChatDesktop)

/** Packaged Electron uses the custom protocol; development Electron uses localhost. */
export const isPackagedDesktopRenderer = () =>
  isDesktopRenderer() && window.location.protocol === 'purechat:'
