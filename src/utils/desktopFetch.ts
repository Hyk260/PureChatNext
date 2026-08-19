import { getDesktopApi } from '@/types/desktop'

let remoteBaseUrl: string | null = null

const resolveFetchTarget = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

/**
 * Packaged Electron renderers use `purechat://renderer` as their origin.
 * Rewrite relative API requests to the configured remote server while
 * preserving the normal browser/Vite behavior for the web application.
 */
export async function configureDesktopFetch(): Promise<boolean> {
  const api = getDesktopApi()
  if (!api || window.location.protocol !== 'purechat:') return true

  const configured = await api.getRemoteServer()
  remoteBaseUrl = configured.url
  if (!remoteBaseUrl) return false

  const nativeFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const target = resolveFetchTarget(input)
    if (!remoteBaseUrl || !target.startsWith('/api/')) return nativeFetch(input, init)

    const rewritten = new URL(target, remoteBaseUrl).toString()
    if (input instanceof Request) {
      return nativeFetch(new Request(rewritten, input), {
        ...init,
        credentials: init?.credentials ?? 'include',
      })
    }

    return nativeFetch(rewritten, {
      ...init,
      credentials: init?.credentials ?? 'include',
    })
  }

  return true
}

export const getDesktopRemoteBaseUrl = () => remoteBaseUrl
