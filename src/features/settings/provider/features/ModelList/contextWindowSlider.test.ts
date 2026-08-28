import { describe, expect, it } from 'vitest'

import {
  CONTEXT_WINDOW_MARKS,
  CONTEXT_WINDOW_STEPS,
  formatContextWindowMark,
  nearestContextWindowStepIndex,
} from './contextWindowSlider'

describe('formatContextWindowMark', () => {
  it('formats binary and decimal token labels', () => {
    expect(formatContextWindowMark(0)).toBe('0')
    expect(formatContextWindowMark(32_768)).toBe('32K')
    expect(formatContextWindowMark(200_000)).toBe('200K')
    expect(formatContextWindowMark(1_000_000)).toBe('1M')
    expect(formatContextWindowMark(2_000_000)).toBe('2M')
  })
})

describe('CONTEXT_WINDOW_MARKS', () => {
  it('labels the common context sizes including 4K–64K', () => {
    expect(CONTEXT_WINDOW_MARKS).toEqual({
      0: '0',
      [CONTEXT_WINDOW_STEPS.indexOf(4_096)]: '4K',
      [CONTEXT_WINDOW_STEPS.indexOf(8_192)]: '8K',
      [CONTEXT_WINDOW_STEPS.indexOf(16_384)]: '16K',
      [CONTEXT_WINDOW_STEPS.indexOf(32_768)]: '32K',
      [CONTEXT_WINDOW_STEPS.indexOf(65_536)]: '64K',
      [CONTEXT_WINDOW_STEPS.indexOf(200_000)]: '200K',
      [CONTEXT_WINDOW_STEPS.indexOf(1_000_000)]: '1M',
      [CONTEXT_WINDOW_STEPS.length - 1]: '2M',
    })
  })
})

describe('nearestContextWindowStepIndex', () => {
  it('maps free-form token values onto the closest step', () => {
    expect(nearestContextWindowStepIndex(0)).toBe(0)
    expect(nearestContextWindowStepIndex(30_000)).toBe(CONTEXT_WINDOW_STEPS.indexOf(32_768))
    expect(nearestContextWindowStepIndex(448_512)).toBe(CONTEXT_WINDOW_STEPS.indexOf(512_000))
    expect(nearestContextWindowStepIndex(2_000_000)).toBe(CONTEXT_WINDOW_STEPS.length - 1)
  })
})
