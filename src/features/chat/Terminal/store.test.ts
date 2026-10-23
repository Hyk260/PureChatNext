import { describe, expect, it } from 'vitest'

import { clampTerminalHeight, terminalHeightBounds, useTerminalPanelStore } from './store'

describe('terminal panel sizing', () => {
  it('reserves space for chat and clamps dragging in small windows', () => {
    expect(terminalHeightBounds(1000)).toEqual({ min: 160, max: 700 })
    expect(clampTerminalHeight(900, 600)).toBe(360)
    expect(clampTerminalHeight(-10, 600)).toBe(160)
    expect(clampTerminalHeight(280, 320)).toBe(80)
    expect(clampTerminalHeight(280, 200)).toBe(0)
    expect(clampTerminalHeight(Number.NaN, 800)).toBe(280)
  })

  it('persists only height, leaving availability and opening state transient', () => {
    useTerminalPanelStore.getState().setAvailable(true)
    useTerminalPanelStore.getState().toggle()
    useTerminalPanelStore.getState().setHeight(340)
    const stored = JSON.parse(localStorage.getItem('purechat:layout:terminal')!)
    expect(stored.state).toEqual({ height: 340 })
    useTerminalPanelStore.getState().setHeight(Number.NaN)
    expect(useTerminalPanelStore.getState().height).toBe(340)
    useTerminalPanelStore.getState().hide()
  })
})
