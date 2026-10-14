import type { DesktopAuthStatus } from '@/types/desktop'
import { getDesktopApi } from '@/types/desktop'

export type DesktopSession = {
  session: { expiresAt: Date; id: string; userId: string }
  user: { email: string; id: string; image?: string | null; name: string; role?: string | null }
}

type DesktopSessionSnapshot = {
  data: DesktopSession | null
  error: Error | null
  isPending: boolean
}

type DesktopMeResponse = {
  data?: { avatar?: string | null; email?: string | null; fullName?: string | null; id?: string; role?: string | null }
}

let snapshot: DesktopSessionSnapshot = { data: null, error: null, isPending: true }
let inflight: Promise<void> | null = null
let controller: AbortController | null = null
let revision = 0
let unsubscribeAuth: (() => void) | undefined
const listeners = new Set<() => void>()

const publish = (next: DesktopSessionSnapshot) => {
  snapshot = next
  listeners.forEach((listener) => listener())
}

const clearSession = () => {
  revision += 1
  controller?.abort()
  controller = null
  inflight = null
  publish({ data: null, error: null, isPending: false })
}

const refetch = (): Promise<void> => {
  if (inflight) return inflight
  const api = getDesktopApi()
  if (!api) {
    clearSession()
    return Promise.resolve()
  }

  const currentRevision = revision
  const requestController = new AbortController()
  controller = requestController
  // Keep a resolved session usable while route layouts resubscribe and refresh it.
  // Only the first load should block protected pages with the auth skeleton.
  publish({ ...snapshot, isPending: snapshot.data === null })
  // Install the shared promise before getStatus broadcasts its auth.status event.
  const request = Promise.resolve().then(async () => {
    try {
      const status = await api.auth.getStatus()
      if (currentRevision !== revision) return
      if (status.status !== 'signedIn') {
        clearSession()
        return
      }

      const response = await fetch('/api/auth/me', { credentials: 'include', signal: requestController.signal })
      if (currentRevision !== revision) return
      if (response.status === 401) {
        clearSession()
        return
      }
      if (!response.ok) throw new Error('加载桌面会话失败')
      const body = (await response.json()) as DesktopMeResponse
      if (currentRevision !== revision) return
      const user = body.data
      if (!user?.id || !user.email) throw new Error('桌面会话数据无效')
      publish({
        data: {
          session: { expiresAt: new Date(Date.now() + 900_000), id: 'desktop-session', userId: user.id },
          user: {
            email: user.email,
            id: user.id,
            image: user.avatar,
            name: user.fullName || user.email.split('@')[0],
            role: user.role,
          },
        },
        error: null,
        isPending: false,
      })
    } catch (cause) {
      if (currentRevision !== revision) return
      publish({ data: null, error: cause instanceof Error ? cause : new Error('加载桌面会话失败'), isPending: false })
    } finally {
      if (inflight === request) {
        inflight = null
        controller = null
      }
    }
  })
  inflight = request
  return request
}

const onAuthStatus = (status: DesktopAuthStatus) => {
  if (status.status !== 'signedIn') {
    clearSession()
    return
  }
  if (!snapshot.data) refetch()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (listeners.size === 1) {
    unsubscribeAuth = getDesktopApi()?.auth.onStatusChange(onAuthStatus)
    refetch()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      unsubscribeAuth?.()
      unsubscribeAuth = undefined
    }
  }
}

export const desktopSessionStore = { getSnapshot: () => snapshot, refetch, subscribe }
