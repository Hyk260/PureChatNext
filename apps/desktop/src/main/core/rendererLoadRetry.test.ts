import { describe, expect, it } from 'vitest'

import {
  getRendererReloadDelayMs,
  MAX_RENDERER_RELOAD_ATTEMPTS,
  shouldRetryRendererLoad,
} from './rendererLoadRetry'

describe('rendererLoadRetry', () => {
  it('retries connection refused until the attempt budget is exhausted', () => {
    expect(shouldRetryRendererLoad(-102, 0)).toBe(true)
    expect(shouldRetryRendererLoad(-102, MAX_RENDERER_RELOAD_ATTEMPTS - 1)).toBe(true)
    expect(shouldRetryRendererLoad(-102, MAX_RENDERER_RELOAD_ATTEMPTS)).toBe(false)
  })

  it('does not retry non-transient errors', () => {
    expect(shouldRetryRendererLoad(-3, 0)).toBe(false) // ERR_ABORTED
    expect(shouldRetryRendererLoad(-6, 0)).toBe(false) // ERR_FILE_NOT_FOUND
  })

  it('caps reload delay', () => {
    expect(getRendererReloadDelayMs(1)).toBe(500)
    expect(getRendererReloadDelayMs(4)).toBe(2_000)
    expect(getRendererReloadDelayMs(10)).toBe(2_500)
  })
})
