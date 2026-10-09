import { getDesktopApi } from '@/types/desktop'

let remoteBaseUrl: string | null = null
let desktopFetchInstalled = false

const isApiPath = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/')

export const resolveDesktopApiUrl = (inputUrl: URL, rendererOrigin: string): URL | null => {
  if (inputUrl.origin !== rendererOrigin || !isApiPath(inputUrl.pathname)) return null

  // Changing an HTTP URL's `.protocol` to a non-special scheme is ignored by
  // the WHATWG URL implementation. Construct the custom-protocol URL directly
  // or Chromium will request `http://renderer/...` and attempt a DNS lookup.
  return new URL(`${inputUrl.pathname}${inputUrl.search}`, 'purechat://renderer/')
}

const getDesktopApiUrl = (input: RequestInfo | URL): URL | null => {
  const inputUrl =
    typeof input === 'string' || input instanceof URL ? new URL(input, window.location.href) : new URL(input.url)

  // Browser requests to another origin are intentionally left untouched. Only
  // same-origin SPA API calls belong to the Electron transport.
  return resolveDesktopApiUrl(inputUrl, window.location.origin)
}

/**
 * Development Electron still renders from the Vite HTTP origin. Route its API
 * calls through the same main-process protocol proxy used by packaged builds,
 * so the main process can inject the stored Bearer token.
 */
const installDesktopFetch = () => {
  if (desktopFetchInstalled || window.location.protocol === 'purechat:' || !getDesktopApi()) return

  const nativeFetch = window.fetch.bind(window)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const targetUrl = getDesktopApiUrl(input)
    if (!targetUrl) return nativeFetch(input, init)

    if (input instanceof Request) return nativeFetch(new Request(targetUrl, input), init)
    return nativeFetch(targetUrl, init)
  }) as typeof window.fetch
  desktopFetchInstalled = true
}

/**
 * Packaged Electron renderers use `purechat://renderer` as their origin.
 * API requests stay on that origin and are proxied by the Electron main
 * process, which avoids browser CORS / Origin validation on the remote server.
 */
export async function configureDesktopFetch(): Promise<boolean> {
  const api = getDesktopApi()
  if (!api) return true

  installDesktopFetch()

  const configured = await api.getRemoteServer()
  remoteBaseUrl = configured.url
  return Boolean(remoteBaseUrl)
}

export const getDesktopRemoteBaseUrl = () => remoteBaseUrl
