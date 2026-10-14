import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DesktopApi } from '@/types/desktop'
import type { DesktopUpdateState } from '@/types/desktopUpdater'
import { DEFAULT_UPDATE_PREFERENCES } from '@/types/desktopUpdater'

import { useDesktopUpdateVersion } from './useDesktopUpdateVersion'

const initial: DesktopUpdateState = {
  revision: 1,
  status: 'idle',
  currentVersion: '0.2.0',
  developmentCachePath: null,
  installationSupport: null,
  preferences: DEFAULT_UPDATE_PREFERENCES,
  effectiveSource: null,
  progress: 0,
  release: null,
  message: null,
  manual: false,
}
let listener: (state: DesktopUpdateState) => void
const unsubscribe = vi.fn()
const getState = vi.fn<() => Promise<DesktopUpdateState>>()

beforeEach(() => {
  getState.mockReset().mockResolvedValue(initial)
  unsubscribe.mockClear()
  window.pureChatDesktop = {
    updater: {
      getState,
      onStateChange: (next: typeof listener) => {
        listener = next
        return unsubscribe
      },
    },
  } as unknown as DesktopApi
})

afterEach(() => {
  delete window.pureChatDesktop
})

describe('desktop title bar update notification', () => {
  it('stays hidden on the web without calling Electron', () => {
    delete window.pureChatDesktop
    const { result } = renderHook(useDesktopUpdateVersion)
    expect(result.current).toBeNull()
    expect(getState).not.toHaveBeenCalled()
  })

  it('receives download states immediately and ignores a stale initial snapshot', async () => {
    let resolve!: (state: DesktopUpdateState) => void
    getState.mockReturnValue(new Promise((done) => { resolve = done }))
    const { result, unmount } = renderHook(useDesktopUpdateVersion)
    const update = { ...initial, release: { version: '0.2.1', notes: '' } }
    act(() => listener({ ...update, revision: 2, status: 'downloading' }))
    await act(async () => resolve(initial))
    expect(result.current).toBe('0.2.1')
    act(() => listener({ ...update, revision: 3, status: 'downloaded' }))
    expect(result.current).toBe('0.2.1')
    act(() => listener({ ...update, revision: 4, status: 'ready' }))
    expect(result.current).toBe('0.2.1')
    act(() => listener({ ...initial, revision: 5, status: 'upToDate' }))
    expect(result.current).toBeNull()
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    act(() => listener({ ...update, revision: 6, status: 'ready' }))
  })

  it('reads an already downloaded version when mounted and keeps failed downloads accessible', async () => {
    getState.mockResolvedValue({ ...initial, status: 'ready', release: { version: '0.2.1', notes: '' } })
    const { result } = renderHook(useDesktopUpdateVersion)
    await waitFor(() => expect(result.current).toBe('0.2.1'))
    act(() => listener({ ...initial, revision: 2, status: 'error', release: { version: '0.2.1', notes: '' } }))
    expect(result.current).toBe('0.2.1')
    act(() => listener({ ...initial, revision: 3, status: 'error' }))
    expect(result.current).toBeNull()
  })

  it('stays hidden when no newer release exists or reading the state fails', async () => {
    getState.mockResolvedValue({ ...initial, status: 'ready', release: { version: '0.2.0', notes: '' } })
    const first = renderHook(useDesktopUpdateVersion)
    await act(async () => {})
    expect(first.result.current).toBeNull()
    first.unmount()
    getState.mockRejectedValue(new Error('IPC unavailable'))
    const second = renderHook(useDesktopUpdateVersion)
    await act(async () => {})
    expect(second.result.current).toBeNull()
  })
})
