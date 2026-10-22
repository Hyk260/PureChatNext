import { describe, expect, it } from 'vitest'

import { getHorizontalWheelOffset } from './useHorizontalWheel'

describe('horizontal wheel scrolling', () => {
  it('maps vertical mouse-wheel movement to the horizontal axis in both directions', () => {
    expect(getHorizontalWheelOffset({ deltaX: 0, deltaY: 80, deltaMode: 0 }, 20, 400, 200)).toBe(100)
    expect(getHorizontalWheelOffset({ deltaX: 0, deltaY: -80, deltaMode: 0 }, 100, 400, 200)).toBe(20)
  })

  it('preserves native horizontal trackpad scrolling', () => {
    expect(getHorizontalWheelOffset({ deltaX: 100, deltaY: 5, deltaMode: 0 }, 20, 400, 200)).toBe(20)
  })

  it('handles line/page deltas and bounds the result at either edge', () => {
    expect(getHorizontalWheelOffset({ deltaX: 0, deltaY: 3, deltaMode: 1 }, 0, 400, 200)).toBe(48)
    expect(getHorizontalWheelOffset({ deltaX: 0, deltaY: 1, deltaMode: 2 }, 0, 400, 200)).toBe(200)
    expect(getHorizontalWheelOffset({ deltaX: 0, deltaY: 100, deltaMode: 0 }, 380, 400, 200)).toBe(400)
    expect(getHorizontalWheelOffset({ deltaX: 0, deltaY: -100, deltaMode: 0 }, 20, 400, 200)).toBe(0)
  })
})
