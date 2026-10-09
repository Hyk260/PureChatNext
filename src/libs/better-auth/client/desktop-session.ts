'use client'

import { useSyncExternalStore } from 'react'

import { desktopSessionStore } from './desktop-session-store'

export type { DesktopSession } from './desktop-session-store'

export const useDesktopSession = () => {
  const snapshot = useSyncExternalStore(
    desktopSessionStore.subscribe,
    desktopSessionStore.getSnapshot,
    desktopSessionStore.getSnapshot
  )
  return { ...snapshot, refetch: desktopSessionStore.refetch }
}
