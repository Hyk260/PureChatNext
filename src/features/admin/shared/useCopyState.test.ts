import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useCopyState } from './useCopyState'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useCopyState', () => {
  it('retains the original reset timing for overlapping copies', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { result, unmount } = renderHook(useCopyState)
    await act(() => result.current.copyText('first'))
    expect(result.current.copyState).toBe('copied')
    await act(() => vi.advanceTimersByTimeAsync(1000))
    await act(() => result.current.copyText('second'))
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(result.current.copyState).toBe('idle')
    expect(writeText.mock.calls).toEqual([['first'], ['second']])
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports clipboard failure without using a DOM fallback', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    const { result, unmount } = renderHook(useCopyState)
    await act(() => result.current.copyText('text'))
    expect(result.current.copyState).toBe('failed')
    act(() => result.current.setCopyState('idle'))
    expect(result.current.copyState).toBe('idle')
    unmount()
  })
})
