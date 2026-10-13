import { act, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { MemoryRouter, useNavigate, useSearchParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopApi } from '@/types/desktop'
import type { DesktopUpdateState } from '@/types/desktopUpdater'
import { DEFAULT_UPDATE_PREFERENCES } from '@/types/desktopUpdater'

const ui = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), open: vi.fn(), destroy: vi.fn() }))
vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({ message: ui, modal: {} }),
}))

import { useAboutUpdate } from './useAboutUpdate'

const initial: DesktopUpdateState = {
  status: 'idle',
  revision: 1,
  currentVersion: '0.2.0',
  developmentCachePath: null,
  installationSupport: { supported: true, signature: 'valid', message: '签名校验通过' },
  preferences: DEFAULT_UPDATE_PREFERENCES,
  progress: 0,
  release: null,
  message: null,
  manual: false,
}
let listener: (state: DesktopUpdateState) => void
const unsubscribe = vi.fn()
const updater = {
  getState: vi.fn<() => Promise<DesktopUpdateState>>(),
  check: vi.fn<() => Promise<DesktopUpdateState>>(),
  clearCache: vi.fn<() => Promise<DesktopUpdateState>>(),
  setPreferences: vi.fn(),
  install: vi.fn(),
  onStateChange: (next: typeof listener) => {
    listener = next
    return unsubscribe
  },
}

function wrapper({ children }: PropsWithChildren) {
  return <MemoryRouter initialEntries={['/settings/about']}>{children}</MemoryRouter>
}

function updateWrapper({ children }: PropsWithChildren) {
  return <MemoryRouter initialEntries={['/settings/about?update=install&keep=1']}>{children}</MemoryRouter>
}

beforeEach(() => {
  vi.clearAllMocks()
  updater.getState.mockResolvedValue(initial)
  window.pureChatDesktop = { updater } as unknown as DesktopApi
})
afterEach(() => {
  vi.restoreAllMocks()
  delete window.pureChatDesktop
})

describe('about update subscription', () => {
  it('shows one manual check tip through completion without marking cache clearing as loading', async () => {
    const { result } = renderHook(useAboutUpdate, { wrapper })
    await waitFor(() => expect(result.current.desktopState).toEqual(initial))
    act(() => listener({ ...initial, revision: 2, status: 'upToDate' }))
    expect(ui.open).not.toHaveBeenCalled()

    let resolve!: (state: DesktopUpdateState) => void
    updater.check.mockReturnValue(new Promise((done) => { resolve = done }))
    let request!: Promise<void>
    act(() => {
      request = result.current.check()
      result.current.check()
    })
    expect(result.current.pending).toBe(true)
    expect(result.current.clearingCache).toBe(false)
    expect(ui.open).toHaveBeenCalledTimes(1)
    expect(ui.open).toHaveBeenLastCalledWith({
      key: 'desktop-update-check', type: 'loading', content: '正在检查更新…', duration: 0,
    })
    await act(async () => {
      resolve({ ...initial, revision: 3, status: 'checking' })
      await request
    })
    expect(result.current.pending).toBe(false)
    expect(ui.open).toHaveBeenCalledTimes(1)
    act(() => listener({ ...initial, revision: 4, status: 'upToDate', message: '当前已是最新版本。' }))
    expect(ui.open).toHaveBeenLastCalledWith({
      key: 'desktop-update-check', type: 'success', content: '当前已是最新版本。', duration: 3,
    })
    act(() => listener({ ...initial, revision: 5, status: 'checking' }))
    act(() => listener({ ...initial, revision: 6, status: 'upToDate' }))
    expect(ui.open).toHaveBeenCalledTimes(2)
  })

  it('replaces the check tip on IPC failure and removes an unfinished tip on page exit', async () => {
    const { result, unmount } = renderHook(useAboutUpdate, { wrapper })
    await waitFor(() => expect(result.current.desktopState).toEqual(initial))
    updater.check.mockRejectedValueOnce(new Error('network unavailable'))
    await act(async () => { await result.current.check() })
    expect(ui.open).toHaveBeenLastCalledWith({
      key: 'desktop-update-check', type: 'error', content: 'network unavailable', duration: 3,
    })
    updater.check.mockResolvedValueOnce({ ...initial, revision: 2, status: 'checking' })
    await act(async () => { await result.current.check() })
    unmount()
    expect(ui.destroy).toHaveBeenCalledWith('desktop-update-check')
  })

  it('marks only a cache clearing request as clearingCache and resets it on completion', async () => {
    updater.getState.mockResolvedValue({ ...initial, developmentCachePath: '/tmp/purechat-dev-updater' })
    const { result } = renderHook(useAboutUpdate, { wrapper })
    await waitFor(() => expect(result.current.desktopState?.developmentCachePath).toBeTruthy())
    let resolve!: (state: DesktopUpdateState) => void
    updater.clearCache.mockReturnValue(new Promise((done) => { resolve = done }))
    let request!: Promise<void>
    act(() => { request = result.current.clearCache() })
    expect(result.current.clearingCache).toBe(true)
    expect(result.current.pending).toBe(true)
    await act(async () => {
      resolve({ ...initial, revision: 2 })
      await request
    })
    expect(result.current.clearingCache).toBe(false)
    expect(result.current.pending).toBe(false)
    expect(ui.success).toHaveBeenCalledWith('下载安装包缓存已清理')
  })

  it.each([false, true])('keeps saved switches at %s on the first render after page remount', async (enabled) => {
    const { result, unmount } = renderHook(useAboutUpdate, { wrapper })
    await waitFor(() => expect(result.current.desktopState).toEqual(initial))
    const saved = {
      ...initial,
      revision: 2,
      preferences: { ...initial.preferences, autoUpdate: enabled, testPlan: enabled },
    }
    updater.setPreferences.mockResolvedValue(saved)
    await act(async () => {
      await result.current.savePreferences({ autoUpdate: enabled, testPlan: enabled })
    })
    unmount()

    let resolve!: (state: DesktopUpdateState) => void
    updater.getState.mockReturnValue(new Promise((done) => { resolve = done }))
    const reopened = renderHook(useAboutUpdate, { wrapper })
    expect(reopened.result.current.autoUpdate).toBe(enabled)
    expect(reopened.result.current.desktopState?.preferences.testPlan).toBe(enabled)

    // A delayed older snapshot must not restore the defaults or pollute the remount cache.
    await act(async () => resolve(initial))
    expect(reopened.result.current.desktopState).toEqual(saved)
    const updated = { ...saved, revision: 3, preferences: { ...saved.preferences, testPlan: !enabled } }
    act(() => listener(updated))
    reopened.unmount()
    updater.getState.mockResolvedValue(updated)
    const third = renderHook(useAboutUpdate, { wrapper })
    expect(third.result.current.desktopState).toEqual(updated)
    await waitFor(() => expect(third.result.current.desktopState).toEqual(updated))
  })

  it('allows inspecting a downloaded update but never installs when the current signature is ineligible', async () => {
    updater.getState.mockResolvedValue({
      ...initial, status: 'ready',
      installationSupport: { supported: false, signature: 'ad-hoc', message: '仅支持下载更新' },
    })
    const { result } = renderHook(useAboutUpdate, { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    act(() => result.current.confirmInstall())
    expect(result.current.installConfirmationOpen).toBe(true)
    await act(async () => { await result.current.installUpdate() })
    expect(updater.install).not.toHaveBeenCalled()
  })

  it.each(['ready', 'downloaded'] as const)(
    'opens a requested confirmation after loading %s and consumes the request',
    async (status) => {
      let resolve!: (state: DesktopUpdateState) => void
      updater.getState.mockReturnValue(
        new Promise((done) => {
          resolve = done
        })
      )
      const { result } = renderHook(
        () => ({
          update: useAboutUpdate(),
          params: useSearchParams()[0],
          navigate: useNavigate(),
        }),
        { wrapper: updateWrapper }
      )
      expect(result.current.update.installConfirmationOpen).toBe(false)
      const ready: DesktopUpdateState = {
        ...initial,
        status,
        release: { version: '0.3.0', notes: '' },
      }
      await act(async () => resolve(ready))
      await waitFor(() => expect(result.current.update.installConfirmationOpen).toBe(true))
      expect(updater.install).not.toHaveBeenCalled()
      act(() => result.current.update.closeInstallConfirmation())
      expect(result.current.params.toString()).toBe('keep=1')
      act(() => listener({ ...ready, revision: 2 }))
      expect(result.current.update.installConfirmationOpen).toBe(false)
      act(() => result.current.navigate('/settings/about?update=install'))
      await waitFor(() => expect(result.current.update.installConfirmationOpen).toBe(true))
    }
  )

  it('waits for a requested download to finish before opening the confirmation', async () => {
    updater.getState.mockResolvedValue({ ...initial, status: 'downloading', progress: 100 })
    const { result } = renderHook(useAboutUpdate, { wrapper: updateWrapper })
    await waitFor(() => expect(result.current.status).toBe('downloading'))
    expect(result.current.installConfirmationOpen).toBe(false)
    act(() => listener({ ...initial, revision: 2, status: 'ready', release: { version: '0.3.0', notes: '' } }))
    await waitFor(() => expect(result.current.installConfirmationOpen).toBe(true))
    expect(updater.install).not.toHaveBeenCalled()
  })

  it('does not check for updates or store preferences on the web', async () => {
    delete window.pureChatDesktop
    const fetcher = vi.spyOn(globalThis, 'fetch')
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(useAboutUpdate, { wrapper: updateWrapper })

    await act(async () => {
      await result.current.check()
      await result.current.clearCache()
      await result.current.setAutoUpdate(false)
      result.current.confirmInstall()
    })

    expect(result.current.isDesktop).toBe(false)
    expect(result.current.pending).toBe(false)
    expect(updater.getState).not.toHaveBeenCalled()
    expect(updater.clearCache).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
    expect(storage).not.toHaveBeenCalled()
    expect(result.current.installConfirmationOpen).toBe(false)
  })

  it('subscribes before reading the snapshot and does not overwrite newer download events', async () => {
    let resolve!: (state: DesktopUpdateState) => void
    updater.getState.mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    const { result, unmount } = renderHook(useAboutUpdate, { wrapper })
    act(() => listener({ ...initial, revision: 5, status: 'downloading', progress: 40 }))
    await act(async () => resolve(initial))
    expect(result.current.desktopState?.progress).toBe(40)
    expect(result.current.version).toBe('0.2.0')
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it.each(['ready', 'downloaded'] as const)(
    'opens confirmation only on click after a %s event, including after page remount',
    async (status) => {
      const { result, unmount } = renderHook(useAboutUpdate, { wrapper })
      await waitFor(() => expect(result.current.version).toBe('0.2.0'))
      act(() => listener({ ...initial, revision: 2, manual: true, status: 'downloading', progress: 100 }))
      expect(result.current.installConfirmationOpen).toBe(false)
      const ready: DesktopUpdateState = {
        ...initial,
        revision: 3,
        manual: true,
        status,
        release: { version: '0.3.0', notes: '' },
      }
      act(() => listener(ready))
      expect(result.current.installConfirmationOpen).toBe(false)
      act(() => listener({ ...ready, revision: 4 }))
      expect(result.current.installConfirmationOpen).toBe(false)
      unmount()
      updater.getState.mockResolvedValue({ ...ready, revision: 4 })
      const reopened = renderHook(useAboutUpdate, { wrapper })
      await waitFor(() => expect(reopened.result.current.status).toBe(status))
      act(() => reopened.result.current.confirmInstall())
      expect(reopened.result.current.installConfirmationOpen).toBe(true)
      await act(async () => {
        await reopened.result.current.installUpdate()
      })
      expect(updater.install).toHaveBeenCalledTimes(status === 'ready' ? 1 : 0)
    }
  )

  it('opens the production confirmation on a development button click but never invokes installation', async () => {
    updater.getState.mockResolvedValue({
      ...initial,
      status: 'downloaded',
      developmentCachePath: '/tmp/purechat-dev-updater',
      release: { version: '0.2.1', notes: '' },
      progress: 100,
    })
    const { result } = renderHook(useAboutUpdate, { wrapper })
    await waitFor(() => expect(result.current.status).toBe('downloaded'))
    expect(result.current.installConfirmationOpen).toBe(false)
    act(() => result.current.confirmInstall())
    expect(result.current.installConfirmationOpen).toBe(true)
    await act(async () => {
      await result.current.installUpdate()
    })
    expect(updater.install).not.toHaveBeenCalled()
  })

  it('deduplicates user checks and retains preferences if saving fails', async () => {
    const { result } = renderHook(useAboutUpdate, { wrapper })
    await waitFor(() => expect(result.current.version).toBe('0.2.0'))
    let resolve!: (state: DesktopUpdateState) => void
    updater.check.mockReturnValue(
      new Promise((done) => {
        resolve = done
      })
    )
    let first!: Promise<void>
    act(() => {
      first = result.current.check()
      result.current.check()
    })
    expect(updater.check).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolve({ ...initial, revision: 2 })
      await first
    })
    updater.setPreferences.mockRejectedValue(new Error('storage unavailable'))
    await act(async () => {
      await result.current.savePreferences({ autoUpdate: false })
    })
    expect(result.current.autoUpdate).toBe(true)
    expect(ui.error).toHaveBeenCalledWith('storage unavailable')
  })

  it('resets the downloaded snapshot after clearing cache and preserves it if clearing fails', async () => {
    const downloaded: DesktopUpdateState = {
      ...initial,
      developmentCachePath: '/tmp/purechat-dev-updater',
      status: 'downloaded',
      progress: 100,
      release: { version: '0.3.0', notes: '' },
    }
    updater.getState.mockResolvedValue(downloaded)
    const { result } = renderHook(useAboutUpdate, { wrapper })
    await waitFor(() => expect(result.current.status).toBe('downloaded'))
    updater.clearCache.mockRejectedValueOnce(new Error('permission denied'))
    await act(async () => {
      await result.current.clearCache()
    })
    expect(ui.error).toHaveBeenCalledWith('permission denied')
    expect(result.current.status).toBe('downloaded')
    updater.clearCache.mockResolvedValueOnce({ ...downloaded, revision: 2, status: 'idle', progress: 0, release: null })
    await act(async () => {
      await result.current.clearCache()
    })
    expect(result.current.status).toBe('idle')
    expect(result.current.desktopState?.progress).toBe(0)
    expect(ui.success).toHaveBeenCalledWith('下载安装包缓存已清理')
    expect(result.current.pending).toBe(false)
  })
})
