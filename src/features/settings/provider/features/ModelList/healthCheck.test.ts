import { describe, expect, it, vi } from 'vitest'

import { runWithConcurrency } from './healthCheck'

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

describe('runWithConcurrency', () => {
  it('runs requests serially when concurrency is disabled', async () => {
    let active = 0
    let maxActive = 0

    await runWithConcurrency(
      [1, 2, 3],
      async () => {
        active += 1
        maxActive = Math.max(maxActive, active)
        await wait(2)
        active -= 1
      },
      1
    )

    expect(maxActive).toBe(1)
  })

  it('does not exceed the configured concurrency', async () => {
    let active = 0
    let maxActive = 0
    const worker = vi.fn(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await wait(2)
      active -= 1
    })

    await runWithConcurrency([1, 2, 3, 4, 5], worker, 3)

    expect(worker).toHaveBeenCalledTimes(5)
    expect(maxActive).toBe(3)
  })

  it('stops scheduling new work after cancellation', async () => {
    const controller = new AbortController()
    const worker = vi.fn(async () => {
      controller.abort()
      await wait(2)
    })

    await runWithConcurrency([1, 2, 3], worker, 1, controller.signal)

    expect(worker).toHaveBeenCalledTimes(1)
  })
})
