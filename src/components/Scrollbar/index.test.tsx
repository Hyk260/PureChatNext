import { act, fireEvent, render } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Scrollbar from './index'

const resizeObservers: MockResizeObserver[] = []

class MockResizeObserver {
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    resizeObservers.push(this)
  }

  disconnect = vi.fn()

  observe = vi.fn()

  trigger() {
    this.callback([], this as unknown as ResizeObserver)
  }
}

const configureScrollElement = (element: HTMLElement, values: { clientHeight: number; scrollHeight: number }) => {
  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: values.clientHeight },
    clientWidth: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: values.scrollHeight },
    scrollWidth: { configurable: true, value: 100 },
    scrollTop: { configurable: true, value: 0, writable: true },
  })
}

const waitForAnimationFrame = () =>
  act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })

const getWrap = (container: HTMLElement) => container.firstElementChild?.firstElementChild as HTMLDivElement

describe('Scrollbar', () => {
  beforeEach(() => {
    resizeObservers.length = 0
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('skips custom measurement in native mode but keeps onScroll callbacks', () => {
    const onScroll = vi.fn()
    const { container } = render(
      <Scrollbar native onScroll={onScroll}>
        <div>content</div>
      </Scrollbar>
    )

    const wrap = getWrap(container)
    configureScrollElement(wrap, { clientHeight: 100, scrollHeight: 300 })
    wrap.scrollTop = 50
    fireEvent.scroll(wrap)

    expect(resizeObservers).toHaveLength(0)
    expect(onScroll).toHaveBeenCalledWith({ scrollLeft: 0, scrollTop: 50 })
    expect(container.querySelector('.pure-scrollbar-bar')).toBeNull()
  })

  it('measures thumb geometry on resize and updates only its transform while scrolling', async () => {
    const { container } = render(
      <Scrollbar>
        <div>content</div>
      </Scrollbar>
    )

    const wrap = getWrap(container)
    configureScrollElement(wrap, { clientHeight: 100, scrollHeight: 300 })
    resizeObservers[0].trigger()
    await waitForAnimationFrame()

    const thumb = container.querySelector('.pure-scrollbar-bar.vertical > div') as HTMLDivElement
    expect(thumb).toBeTruthy()
    expect(thumb.style.height).toBe('32px')

    wrap.scrollTop = 100
    fireEvent.scroll(wrap)
    await waitForAnimationFrame()

    expect(thumb.style.transform).toBe('translateY(32px)')
    expect(thumb.style.height).toBe('32px')
  })
})
