import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useImeEnterGuard } from './useImeEnterGuard'

const enterEvent = (overrides: { isComposing?: boolean; keyCode?: number } = {}) =>
  ({
    nativeEvent: {
      isComposing: overrides.isComposing ?? false,
      keyCode: overrides.keyCode ?? 13,
    },
  }) as unknown as Parameters<ReturnType<typeof useImeEnterGuard>['shouldIgnoreEnter']>[0]

describe('useImeEnterGuard', () => {
  it('ignores Enter while composing', () => {
    const { result } = renderHook(() => useImeEnterGuard())

    act(() => result.current.onCompositionStart())
    expect(result.current.shouldIgnoreEnter(enterEvent({ isComposing: true, keyCode: 229 }))).toBe(true)

    act(() => result.current.onCompositionEnd())
    expect(result.current.shouldIgnoreEnter(enterEvent())).toBe(true)
  })

  it('allows Enter after composition has fully ended', async () => {
    const { result } = renderHook(() => useImeEnterGuard())

    act(() => result.current.onCompositionEnd())
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    })

    expect(result.current.shouldIgnoreEnter(enterEvent())).toBe(false)
  })
})
