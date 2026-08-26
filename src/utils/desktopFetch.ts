import { getDesktopApi } from '@/types/desktop'

let remoteBaseUrl: string | null = null

/**
 * Packaged Electron renderers use `purechat://renderer` as their origin.
 * API requests stay on that origin and are proxied by the Electron main
 * process, which avoids browser CORS / Origin validation on the remote server.
 */
export async function configureDesktopFetch(): Promise<boolean> {
  const api = getDesktopApi()
  if (!api || window.location.protocol !== 'purechat:') return true

  const configured = await api.getRemoteServer()
  remoteBaseUrl = configured.url
  return Boolean(remoteBaseUrl)
}

export const getDesktopRemoteBaseUrl = () => remoteBaseUrl
