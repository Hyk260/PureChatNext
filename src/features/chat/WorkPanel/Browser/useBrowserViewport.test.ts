import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as desktop from '@/types/desktop'

import { browserViewportBounds, useBrowserViewport } from './useBrowserViewport'

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('native browser viewport clipping', () => {
  const viewport = { left: 600, top: 100, right: 1200, bottom: 800 }

  it('fills the viewport without an inset and clips to the panel during its animation', () => {
    expect(browserViewportBounds(viewport, { left: 600, top: 100, right: 1200, bottom: 800 })).toEqual({
      x: 600,
      y: 100,
      width: 600,
      height: 700,
    })
    expect(browserViewportBounds(viewport, { left: 600, top: 100, right: 800, bottom: 800 }).width).toBe(200)
    expect(browserViewportBounds(viewport, { left: 650, top: 100, right: 800, bottom: 800 })).toEqual({
      x: 650,
      y: 100,
      width: 150,
      height: 700,
    })
    expect(browserViewportBounds(viewport, { left: 600, top: 100, right: 600, bottom: 800 }).width).toBe(0)
  })
})

describe('native browser popover preview', () => {
  const dataUrl = 'data:image/png;base64,cGFnZQ=='

  function setup() {
    const host = document.createElement('div')
    document.body.append(host)
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 600, 500))
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    const capture = vi.fn(async () => ({ dataUrl, title: 'page' }))
    const layout = vi.fn(async () => {})
    type Api = NonNullable<ReturnType<typeof desktop.getDesktopApi>>
    vi.spyOn(desktop, 'getDesktopApi').mockReturnValue({ browser: { capture, layout } } as unknown as Api)
    const hook = renderHook(
      ({ sessionId }) => {
        const ref = useBrowserViewport(sessionId, true)
        ref.current = host
      },
      { initialProps: { sessionId: 'first' } }
    )
    const overlay = document.createElement('div')
    overlay.setAttribute('role', 'listbox')
    const rect = new DOMRect(100, 100, 600, 200)
    vi.spyOn(overlay, 'getClientRects').mockReturnValue(Object.assign([rect], { item: () => rect }))
    return { host, overlay, capture, layout, ...hook }
  }

  it('paints the captured page before hiding the native view, and restores it on close', async () => {
    const { host, overlay, capture, layout, unmount } = setup()
    document.body.append(overlay)
    await waitFor(() => expect(layout).toHaveBeenLastCalledWith(expect.objectContaining({ visible: false })))
    expect(host.style.backgroundImage).toContain(dataUrl)
    expect(capture).toHaveBeenCalledTimes(1)
    overlay.remove()
    await waitFor(() => expect(layout).toHaveBeenLastCalledWith(expect.objectContaining({ visible: true })))
    await waitFor(() => expect(host.style.backgroundImage).toBe(''))
    unmount()
  })

  it.each(['close', 'switch'])('ignores a late capture after %s', async (action) => {
    const { host, overlay, capture, rerender, unmount } = setup()
    let finish = (_capture: { dataUrl: string; title: string }) => {}
    capture.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    document.body.append(overlay)
    await waitFor(() => expect(capture).toHaveBeenCalledTimes(1))
    overlay.remove()
    if (action === 'switch') rerender({ sessionId: 'second' })
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    finish({ dataUrl, title: 'old page' })
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await waitFor(() => expect(host.style.backgroundImage).toBe(''))
    unmount()
  })
})
