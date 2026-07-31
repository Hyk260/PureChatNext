'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

interface UseAutoScrollOptions {
  /**
   * Dependencies that trigger auto-scroll when changed
   */
  deps?: unknown[]
  /**
   * Whether auto-scroll is enabled (e.g. only when streaming)
   * @default true
   */
  enabled?: boolean
  /** Resolve an externally-owned scroll element (for example Scrollbar.wrapRef). */
  getScrollElement?: () => HTMLElement | null
  /**
   * Distance threshold from bottom to consider "near bottom" (px)
   * @default 80
   */
  threshold?: number
}

interface UseAutoScrollReturn<T extends HTMLElement> {
  handleScroll: () => void
  ref: RefObject<T | null>
  resetScrollLock: () => void
  userHasScrolled: boolean
}

/**
 * Auto-scroll a container to the bottom while content streams,
 * stopping when the user scrolls away.
 *
 * - Streaming start: smooth scroll once
 * - Token updates: instant follow via scrollTop (avoids interrupting smooth animations)
 */
export function useAutoScroll<T extends HTMLElement = HTMLDivElement>(
  options: UseAutoScrollOptions = {}
): UseAutoScrollReturn<T> {
  const { deps = [], enabled = true, getScrollElement, threshold = 80 } = options

  const ref = useRef<T | null>(null)
  const [userHasScrolled, setUserHasScrolled] = useState(false)
  const userHasScrolledRef = useRef(false)
  const isAutoScrollingRef = useRef(false)
  const prevEnabledRef = useRef(enabled)
  const depsKey = deps.map(String).join('|')

  const getContainer = useCallback(
    () => (getScrollElement?.() as T | null | undefined) ?? ref.current,
    [getScrollElement]
  )

  const setScrollLock = useCallback(
    (locked: boolean) => {
      if (userHasScrolledRef.current === locked) return
      userHasScrolledRef.current = locked
      setUserHasScrolled(locked)
    },
    [setUserHasScrolled]
  )

  const scrollToBottom = useCallback(
    (smooth: boolean) => {
      const container = getContainer()
      if (!container) return

      isAutoScrollingRef.current = true

      if (smooth) {
        container.scrollTo({ behavior: 'smooth', top: container.scrollHeight })
        window.setTimeout(() => {
          isAutoScrollingRef.current = false
        }, 320)
        return
      }

      requestAnimationFrame(() => {
        const nextContainer = getContainer()
        if (!nextContainer) return
        nextContainer.scrollTop = nextContainer.scrollHeight
        requestAnimationFrame(() => {
          isAutoScrollingRef.current = false
        })
      })
    },
    [getContainer]
  )

  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return

    const container = getContainer()
    if (!container) return

    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setScrollLock(distanceToBottom > threshold)
  }, [getContainer, setScrollLock, threshold])

  const resetScrollLock = useCallback(() => {
    setScrollLock(false)
  }, [setScrollLock])

  // Smooth scroll once when streaming / busy state turns on
  useEffect(() => {
    const justEnabled = !prevEnabledRef.current && enabled
    prevEnabledRef.current = enabled

    if (justEnabled) {
      userHasScrolledRef.current = false
      const frame = requestAnimationFrame(() => setUserHasScrolled(false))
      scrollToBottom(true)
      return () => cancelAnimationFrame(frame)
    }
  }, [enabled, scrollToBottom, setUserHasScrolled])

  // Follow content growth while enabled
  useEffect(() => {
    if (!enabled || userHasScrolled) return
    scrollToBottom(false)
  }, [depsKey, enabled, scrollToBottom, userHasScrolled])

  return {
    handleScroll,
    ref,
    resetScrollLock,
    userHasScrolled,
  }
}
