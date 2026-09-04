import { describe, expect, it, vi } from 'vitest'

import { ChannelGenerationRegistry } from './generation'

describe('ChannelGenerationRegistry', () => {
  it('aborts an existing generation when a new one begins', () => {
    const registry = new ChannelGenerationRegistry()
    const previous = registry.begin('session')
    const current = registry.begin('session')

    expect(previous.signal.aborted).toBe(true)
    expect(current.signal.aborted).toBe(false)
    expect(registry.has('session')).toBe(true)
  })

  it('aborts the active generation and runs its cancellation hook', () => {
    const registry = new ChannelGenerationRegistry()
    const onAbort = vi.fn()
    const controller = registry.begin('session', { eventId: 'event-1', onAbort })

    expect(registry.abort('session')).toBe(true)
    expect(controller.signal.aborted).toBe(true)
    expect(onAbort).toHaveBeenCalledOnce()
    expect(registry.has('session')).toBe(false)
  })

  it('only ends the generation that is still active', () => {
    const registry = new ChannelGenerationRegistry()
    const previous = registry.begin('session')
    const current = registry.begin('session')

    registry.end('session', previous)
    expect(registry.has('session')).toBe(true)

    registry.end('session', current)
    expect(registry.has('session')).toBe(false)
  })
})
