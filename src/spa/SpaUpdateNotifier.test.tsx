import { fireEvent, render, waitFor } from '@testing-library/react'
import { isValidElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  notification: {
    destroy: vi.fn(),
    open: vi.fn(),
  },
}))

vi.mock('@/components/AntdStaticMethods', () => ({
  useApp: () => ({ notification: mocks.notification }),
}))

import SpaUpdateNotifier from './SpaUpdateNotifier'
import { SPA_UPDATE_DISMISS_KEY } from './spaUpdateCheck'

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  })
}

function mockVersion(buildTime: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: async () => ({ buildTime, version: '1.0.0' }),
      ok: true,
    })
  )
}

function latestOpenArgs() {
  const args = mocks.notification.open.mock.calls.at(-1)?.[0]
  if (!args) throw new Error('notification.open was not called')
  return args
}

function clickLater() {
  const { actions } = latestOpenArgs()
  if (!isValidElement(actions)) throw new Error('expected actions element')

  const children = (actions.props as { children?: unknown }).children
  const later = Array.isArray(children) ? children[0] : null
  if (!isValidElement(later)) throw new Error('expected 稍后再说 button')

  ;(later.props as { onClick?: () => void }).onClick?.()
}

describe('SpaUpdateNotifier', () => {
  beforeEach(() => {
    mocks.notification.open.mockReset()
    mocks.notification.destroy.mockReset()
    sessionStorage.clear()
    document.head.innerHTML = '<meta name="buildTime" content="local-time" />'
    setVisibility('visible')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.head.innerHTML = ''
    sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  it('does not listen in DEV (enabled=false)', async () => {
    mockVersion('remote-time')
    render(<SpaUpdateNotifier enabled={false} preview={false} />)

    fireEvent(document, new Event('visibilitychange'))
    await Promise.resolve()

    expect(fetch).not.toHaveBeenCalled()
    expect(mocks.notification.open).not.toHaveBeenCalled()
  })

  it('does not notify when fingerprints match', async () => {
    mockVersion('local-time')
    render(<SpaUpdateNotifier enabled preview={false} />)

    fireEvent(document, new Event('visibilitychange'))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })
    expect(mocks.notification.open).not.toHaveBeenCalled()
  })

  it('notifies when fingerprints differ and stays until the user acts', async () => {
    mockVersion('remote-time')
    render(<SpaUpdateNotifier enabled preview={false} />)

    fireEvent(document, new Event('visibilitychange'))

    await waitFor(() => {
      expect(mocks.notification.open).toHaveBeenCalledTimes(1)
    })
    expect(latestOpenArgs()).toMatchObject({
      duration: false,
      title: '检测到系统有新版本发布，是否立即刷新页面？',
    })
  })

  it('does not notify again after the same fingerprint is dismissed', async () => {
    mockVersion('remote-time')
    render(<SpaUpdateNotifier enabled preview={false} />)

    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => {
      expect(mocks.notification.open).toHaveBeenCalledTimes(1)
    })

    latestOpenArgs().onClose()
    expect(sessionStorage.getItem(SPA_UPDATE_DISMISS_KEY)).toBe('remote-time')

    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })
    expect(mocks.notification.open).toHaveBeenCalledTimes(1)
  })

  it('notifies again when a newer fingerprint arrives after dismiss', async () => {
    mockVersion('remote-v1')
    render(<SpaUpdateNotifier enabled preview={false} />)

    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => {
      expect(mocks.notification.open).toHaveBeenCalledTimes(1)
    })

    clickLater()
    expect(sessionStorage.getItem(SPA_UPDATE_DISMISS_KEY)).toBe('remote-v1')
    expect(mocks.notification.destroy).toHaveBeenCalled()

    mockVersion('remote-v2')
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => {
      expect(mocks.notification.open).toHaveBeenCalledTimes(2)
    })
  })

  it('opens immediately in preview mode without fetching', () => {
    mockVersion('remote-time')
    render(<SpaUpdateNotifier enabled preview />)

    expect(mocks.notification.open).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('re-opens preview toast after close when the tab becomes visible', () => {
    mockVersion('remote-time')
    render(<SpaUpdateNotifier enabled preview />)
    expect(mocks.notification.open).toHaveBeenCalledTimes(1)

    latestOpenArgs().onClose()
    fireEvent(document, new Event('visibilitychange'))

    expect(mocks.notification.open).toHaveBeenCalledTimes(2)
    expect(fetch).not.toHaveBeenCalled()
  })
})
