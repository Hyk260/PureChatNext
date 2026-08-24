import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSystemAppearance } from './useSystemAppearance'

describe('useSystemAppearance', () => {
  let isDark = false
  let media: MediaQueryList
  const listeners = new Set<EventListener>()

  beforeEach(() => {
    isDark = false
    listeners.clear()
    media = {
      get matches() {
        return isDark
      },
      addEventListener: vi.fn((_type: string, listener: EventListener) => listeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: EventListener) => listeners.delete(listener)),
    } as unknown as MediaQueryList
    vi.stubGlobal('matchMedia', vi.fn(() => media))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the system appearance and responds to changes', () => {
    const Probe = () => <output data-testid='appearance'>{useSystemAppearance()}</output>

    render(<Probe />)
    expect(screen.getByTestId('appearance').textContent).toBe('light')

    isDark = true
    act(() => {
      for (const listener of listeners) listener(new Event('change'))
    })

    expect(screen.getByTestId('appearance').textContent).toBe('dark')
  })

  it('removes the system listener on unmount', () => {
    const Probe = () => <output>{useSystemAppearance()}</output>
    const { unmount } = render(<Probe />)

    unmount()
    expect(media.removeEventListener).toHaveBeenCalledTimes(1)
  })
})
