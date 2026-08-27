import { describe, expect, it } from 'vitest'

import { fromIpcErrorEnvelope, isIpcErrorEnvelope, toIpcErrorEnvelope } from './errors'

describe('IPC error envelope', () => {
  it('round-trips an Error without throwing across the bridge', () => {
    const envelope = toIpcErrorEnvelope(new TypeError('拒绝访问'))
    expect(isIpcErrorEnvelope(envelope)).toBe(true)
    const restored = fromIpcErrorEnvelope(envelope)
    expect(restored).toBeInstanceOf(Error)
    expect(restored.name).toBe('TypeError')
    expect(restored.message).toBe('拒绝访问')
  })
})
