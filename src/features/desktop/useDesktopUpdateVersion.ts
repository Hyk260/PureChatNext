import { useEffect, useState } from 'react'

import { getDesktopApi } from '@/types/desktop'
import type { DesktopUpdateState } from '@/types/desktopUpdater'

export function useDesktopUpdateVersion() {
  const api = getDesktopApi()
  const [state, setState] = useState<DesktopUpdateState | null>(null)

  useEffect(() => {
    if (!api) return
    let active = true
    const receive = (next: DesktopUpdateState) => {
      if (active) setState((previous) => (previous && previous.revision > next.revision ? previous : next))
    }
    const unsubscribe = api.updater.onStateChange(receive)
    api.updater.getState().then(receive).catch(() => undefined)
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  const releaseVersion = state?.release?.version
  if (!releaseVersion || releaseVersion === state.currentVersion) return null
  if (state.status !== 'downloading' && state.status !== 'downloaded' && state.status !== 'ready' && state.status !== 'error')
    return null
  return releaseVersion
}
