import { act, render } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  themeProviderProps: null as Record<string, unknown> | null,
}))

vi.mock('@pure/ui/ThemeProvider', () => ({
  ConfigProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  ThemeProvider: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => {
    mocks.themeProviderProps = props
    return <>{children}</>
  },
}))

vi.mock('@pure/ui/ModalHost', () => ({
  ModalHost: () => null,
}))

vi.mock('antd-style', () => ({
  StyleProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}))

vi.mock('motion/react', () => ({
  LazyMotion: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  domAnimation: {},
}))

vi.mock('motion/react-m', () => ({}))
vi.mock('@/components/AntdStaticMethods', () => ({ default: () => null }))

import ThemeProviders from './ThemeProviders'

describe('ThemeProviders', () => {
  let isDark = false
  let media: MediaQueryList
  const listeners = new Set<EventListener>()

  beforeEach(() => {
    isDark = false
    listeners.clear()
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
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

  it('reads the stored mode and updates data-theme and storage when changed', () => {
    localStorage.setItem('theme', 'dark')
    render(<ThemeProviders>content</ThemeProviders>)

    expect(mocks.themeProviderProps?.themeMode).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => {
      ;(mocks.themeProviderProps?.onThemeModeChange as (themeMode: 'auto' | 'light' | 'dark') => void)('light')
    })

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('updates auto mode when the system appearance changes', () => {
    render(<ThemeProviders>content</ThemeProviders>)
    expect(document.documentElement.dataset.theme).toBe('light')

    isDark = true
    act(() => {
      for (const listener of listeners) listener(new Event('change'))
    })

    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
