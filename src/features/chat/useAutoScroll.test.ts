import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useAutoScroll } from './useAutoScroll'

const createScrollElement = (scrollTop: number) => {
  const element = document.createElement('div')

  Object.defineProperties(element, {
    clientHeight: { configurable: true, value: 400 },
    scrollHeight: { configurable: true, value: 1200 },
    scrollTop: { configurable: true, value: scrollTop, writable: true },
  })

  return element
}

const waitForAnimationFrame = () =>
  act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  })

describe('useAutoScroll', () => {
  it('scrolls an existing topic to the bottom on mount', async () => {
    const scrollElement = createScrollElement(0)

    renderHook(() =>
      useAutoScroll({
        getScrollElement: () => scrollElement,
        initialScrollToBottom: true,
      })
    )

    expect(scrollElement.scrollTop).toBe(1200)
    await waitForAnimationFrame()
    expect(scrollElement.scrollTop).toBe(1200)
  })

  it('does not change the initial position when bottom scrolling is disabled', () => {
    const scrollElement = createScrollElement(180)

    renderHook(() =>
      useAutoScroll({
        getScrollElement: () => scrollElement,
        initialScrollToBottom: false,
      })
    )

    expect(scrollElement.scrollTop).toBe(180)
  })
})
