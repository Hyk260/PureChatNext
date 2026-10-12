import { afterEach, describe, expect, it, vi } from 'vitest'

import { checkForSpaUpdate, SPA_UPDATE_DISMISS_KEY } from './spaUpdateCheck'

const response = (buildTime: string | null) => new Response(JSON.stringify({ buildTime, version: '0.3.0' }))

function setLocalBuildTime(buildTime: string) {
  const meta = document.createElement('meta')
  meta.name = 'buildTime'
  meta.content = buildTime
  document.head.append(meta)
}

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
  document.querySelector('meta[name="buildTime"]')?.remove()
})

describe('automatic SPA update check', () => {
  it('detects a new deployment even when the removed about-page preference was disabled', async () => {
    window.localStorage.setItem('spa-auto-check-update-v1', 'false')
    setLocalBuildTime('local')
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response('remote'))

    expect(await checkForSpaUpdate({ isShowing: false })).toEqual({ remote: 'remote', show: true })
    expect(fetcher).toHaveBeenCalledWith(
      '/api/version',
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) })
    )
  })

  it('respects dismissal for the same deployment but prompts for a later deployment', async () => {
    setLocalBuildTime('local')
    window.sessionStorage.setItem(SPA_UPDATE_DISMISS_KEY, 'remote')
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response('remote'))
    expect((await checkForSpaUpdate({ isShowing: false })).show).toBe(false)

    fetcher.mockImplementation(async () => response('newer'))
    expect(await checkForSpaUpdate({ isShowing: false })).toEqual({ remote: 'newer', show: true })
  })

  it('skips the network while a notification is already showing', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
    expect(await checkForSpaUpdate({ isShowing: true })).toEqual({ remote: null, show: false })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('does not prompt for the current deployment or missing fingerprints', async () => {
    setLocalBuildTime('same')
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response('same'))
    expect((await checkForSpaUpdate({ isShowing: false })).show).toBe(false)

    fetcher.mockImplementation(async () => response(null))
    expect((await checkForSpaUpdate({ isShowing: false })).show).toBe(false)

    document.querySelector('meta[name="buildTime"]')?.remove()
    fetcher.mockImplementation(async () => response('remote'))
    expect((await checkForSpaUpdate({ isShowing: false })).show).toBe(false)
  })

  it.each(['network', 'http', 'invalid', 'timeout'])('does not prompt on %s failure', async (kind) => {
    setLocalBuildTime('local')
    const fetcher = vi.spyOn(globalThis, 'fetch')
    if (kind === 'network' || kind === 'timeout') fetcher.mockRejectedValue(new Error(kind))
    if (kind === 'http') fetcher.mockResolvedValue(new Response('', { status: 503 }))
    if (kind === 'invalid') fetcher.mockResolvedValue(new Response('{broken'))
    expect(await checkForSpaUpdate({ isShowing: false })).toEqual({ remote: null, show: false })
  })
})
