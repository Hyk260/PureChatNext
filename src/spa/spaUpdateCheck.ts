import { sessionStg } from '@pure/utils/storage'

export const SPA_UPDATE_DISMISS_KEY = 'spa-update-dismissed-build-time'
export const SPA_UPDATE_NOTIFICATION_KEY = 'spa-update'

/** 本地预览：设置 `VITE_SPA_UPDATE_PREVIEW=1` 或使用 `?spaUpdatePreview=1`。 */
export function isSpaUpdatePreview(
  search = typeof window === 'undefined' ? '' : window.location.search,
  envPreview = import.meta.env.VITE_SPA_UPDATE_PREVIEW
): boolean {
  if (envPreview === '1') return true
  return new URLSearchParams(search).get('spaUpdatePreview') === '1'
}

export function readLocalSpaBuildTime(doc: Pick<Document, 'querySelector'> = document): string | null {
  return doc.querySelector('meta[name="buildTime"]')?.getAttribute('content') || null
}

export function shouldNotifySpaUpdate(local: string | null, remote: string | null, dismissed: string | null): boolean {
  if (!local || !remote) return false
  if (local === remote) return false
  if (dismissed === remote) return false
  return true
}

export async function fetchRemoteSpaBuildTime(fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher('/api/version', { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const data: unknown = await res.json()
    if (!data || typeof data !== 'object' || !('buildTime' in data)) return null
    return typeof data.buildTime === 'string' && data.buildTime.length > 0 ? data.buildTime : null
  } catch {
    return null
  }
}

export async function checkForSpaUpdate(options: { isShowing: boolean }): Promise<{
  remote: string | null
  show: boolean
}> {
  if (options.isShowing) return { remote: null, show: false }

  const local = readLocalSpaBuildTime()
  const remote = await fetchRemoteSpaBuildTime()
  const dismissed = sessionStg.getString(SPA_UPDATE_DISMISS_KEY)

  return { remote, show: shouldNotifySpaUpdate(local, remote, dismissed) }
}
