import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopApi, DesktopAuthStatus, DesktopAuthStatusListener } from '@/types/desktop'

describe('desktop session store', () => {
  const originalApi = window.pureChatDesktop
  let status: DesktopAuthStatus
  let statusListener: DesktopAuthStatusListener | undefined
  const subscriptions: Array<() => void> = []
  const auth = {
    getStatus: async (): Promise<DesktopAuthStatus> => {
      // The main process also broadcasts status when getStatus is called.
      statusListener?.(status)
      return status
    },
    onStatusChange: (listener: DesktopAuthStatusListener) => {
      statusListener = listener
      return () => {
        statusListener = undefined
      }
    },
  }
  const meResponse = () => Response.json({ data: { id: 'user-1', email: 'test@example.com', fullName: 'Test' } })

  beforeEach(() => {
    vi.resetModules()
    status = { status: 'signedIn' }
    statusListener = undefined
    window.pureChatDesktop = { auth } as unknown as DesktopApi
  })

  afterEach(() => {
    subscriptions.splice(0).forEach((unsubscribe) => unsubscribe())
    window.pureChatDesktop = originalApi
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const loadStore = async () => (await import('./desktop-session-store')).desktopSessionStore
  const emit = (next: DesktopAuthStatus) => {
    status = next
    statusListener?.(next)
  }

  it('shares one status subscription and one request across six consumers', async () => {
    const fetch = vi.fn().mockResolvedValue(meResponse())
    vi.stubGlobal('fetch', fetch)
    const onStatusChange = vi.spyOn(auth, 'onStatusChange')
    const getStatus = vi.spyOn(auth, 'getStatus')
    const store = await loadStore()
    for (let index = 0; index < 6; index += 1) subscriptions.push(store.subscribe(vi.fn()))
    await store.refetch()

    expect(onStatusChange).toHaveBeenCalledOnce()
    expect(getStatus).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledOnce()
    expect(store.getSnapshot()).toMatchObject({ data: { user: { id: 'user-1' } }, isPending: false, error: null })
  })

  it('clears all consumers on logout without fetching and skips the login page request', async () => {
    const fetch = vi.fn().mockResolvedValue(meResponse())
    vi.stubGlobal('fetch', fetch)
    const store = await loadStore()
    const consumers = Array.from({ length: 6 }, () => vi.fn())
    consumers.forEach((listener) => subscriptions.push(store.subscribe(listener)))
    await store.refetch()
    consumers.forEach((listener) => listener.mockClear())

    emit({ status: 'signedOut' })
    expect(store.getSnapshot()).toEqual({ data: null, error: null, isPending: false })
    consumers.forEach((listener) => expect(listener).toHaveBeenCalledOnce())
    subscriptions.splice(0).forEach((unsubscribe) => unsubscribe())
    subscriptions.push(store.subscribe(vi.fn()))
    await store.refetch()
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('does not request /me when initially signed out', async () => {
    status = { status: 'signedOut' }
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const store = await loadStore()
    subscriptions.push(store.subscribe(vi.fn()))
    await store.refetch()
    expect(fetch).not.toHaveBeenCalled()
    expect(store.getSnapshot()).toEqual({ data: null, error: null, isPending: false })
  })

  it('aborts an outstanding request and ignores its late success after logout', async () => {
    let finish!: (response: Response) => void
    const fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        })
    )
    vi.stubGlobal('fetch', fetch)
    const store = await loadStore()
    subscriptions.push(store.subscribe(vi.fn()))
    const loading = store.refetch()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce())

    emit({ status: 'signedOut' })
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true)
    finish(meResponse())
    await loading
    expect(store.getSnapshot()).toEqual({ data: null, error: null, isPending: false })
  })

  it('fetches once after a new signed-in event', async () => {
    status = { status: 'signedOut' }
    const fetch = vi.fn().mockResolvedValue(meResponse())
    vi.stubGlobal('fetch', fetch)
    const store = await loadStore()
    subscriptions.push(store.subscribe(vi.fn()))
    await store.refetch()

    emit({ status: 'signedIn' })
    await store.refetch()
    expect(fetch).toHaveBeenCalledOnce()
    expect(store.getSnapshot().data?.user.id).toBe('user-1')
  })

  it('treats a server 401 as signed out without retrying', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetch)
    const store = await loadStore()
    subscriptions.push(store.subscribe(vi.fn()))
    await store.refetch()
    expect(fetch).toHaveBeenCalledOnce()
    expect(store.getSnapshot()).toEqual({ data: null, error: null, isPending: false })
  })
})
