import { afterEach, describe, expect, it, vi } from 'vitest'

import { abortableDelay } from '../async'

afterEach(() => {
  vi.useRealTimers()
})

describe('abortableDelay', () => {
  it('supports ordinary waiting without a signal', async () => {
    vi.useFakeTimers()
    const promise = abortableDelay(50)
    await vi.advanceTimersByTimeAsync(50)
    await expect(promise).resolves.toBeUndefined()
  })

  it('removes the abort listener after normal completion', async () => {
    vi.useFakeTimers()
    const signal = new AbortController().signal
    const remove = vi.spyOn(signal, 'removeEventListener')
    const promise = abortableDelay(50, signal)
    await vi.advanceTimersByTimeAsync(50)
    await promise
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('resolves after the requested delay', async () => {
    vi.useFakeTimers()
    const promise = abortableDelay(100, new AbortController().signal)

    await vi.advanceTimersByTimeAsync(100)

    await expect(promise).resolves.toBeUndefined()
  })

  it('resolves when already aborted by default', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(abortableDelay(100, controller.signal)).resolves.toBeUndefined()
  })

  it('resolves when aborted during the delay by default', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const promise = abortableDelay(100, controller.signal)

    controller.abort()

    await expect(promise).resolves.toBeUndefined()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([false, true])('handles an already aborted signal in %s mode', async (rejectOnAbort) => {
    const controller = new AbortController()
    controller.abort()

    const promise = abortableDelay(100, controller.signal, { rejectOnAbort })

    if (rejectOnAbort) {
      await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    } else {
      await expect(promise).resolves.toBeUndefined()
    }
  })

  it('rejects when aborted during the delay in reject mode', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const promise = abortableDelay(100, controller.signal, { rejectOnAbort: true })

    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(vi.getTimerCount()).toBe(0)
  })
})
