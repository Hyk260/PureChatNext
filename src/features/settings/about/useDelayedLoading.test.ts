import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDelayedLoading } from './useDelayedLoading'

describe('useDelayedLoading', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not show brief loading states', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: false },
    })

    rerender({ loading: true })
    act(() => vi.advanceTimersByTime(249))
    expect(result.current).toBe(false)

    rerender({ loading: false })
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(false)
  })

  it('keeps the indicator visible across short loading gaps', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ loading }) => useDelayedLoading(loading), {
      initialProps: { loading: true },
    })

    act(() => vi.advanceTimersByTime(250))
    expect(result.current).toBe(true)

    rerender({ loading: false })
    act(() => vi.advanceTimersByTime(200))
    rerender({ loading: true })
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe(true)

    rerender({ loading: false })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe(false)
  })
})
