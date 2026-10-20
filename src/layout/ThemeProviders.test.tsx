import { act, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  antdConfigProviderProps: null as Record<string, unknown> | null,
  dayjsLocale: null as string | null,
  configProviderProps: null as Record<string, unknown> | null,
  zhCN: { locale: 'zh-cn' },
}))

vi.mock('@pure/ui/ThemeProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pure/ui/ThemeProvider')>()
  return {
    ...actual,
    ConfigProvider: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => {
      mocks.configProviderProps = props
      return <>{children}</>
    },
  }
})

vi.mock('antd', () => ({
  App: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  ConfigProvider: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => {
    mocks.antdConfigProviderProps = props
    return <>{children}</>
  },
  theme: { darkAlgorithm: 'dark', defaultAlgorithm: 'light' },
}))

vi.mock('antd/locale/zh_CN', () => ({ default: mocks.zhCN }))

vi.mock('dayjs', () => ({
  default: {
    locale: (locale: string) => {
      mocks.dayjsLocale = locale
    },
  },
}))

vi.mock('dayjs/locale/zh-cn', () => ({}))

vi.mock('@pure/ui/ModalHost', () => ({
  ModalHost: () => null,
}))

vi.mock('motion/react', () => ({
  LazyMotion: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  domAnimation: {},
}))

vi.mock('motion/react-m', () => ({}))
vi.mock('@/components/AntdStaticMethods', () => ({ default: () => null }))

import ThemeProviders from './ThemeProviders'
import { useAppThemeMode } from './themeMode'
import { DEFAULT_THEME_COLOR, useThemeColor } from './themeColor'

function ThemeControls() {
  const { setThemeMode, themeMode } = useAppThemeMode()
  return <button onClick={() => setThemeMode('light')}>{themeMode}</button>
}

function ThemeColorControl() {
  const { setThemeColor } = useThemeColor()
  return (
    <>
      <button onClick={() => setThemeColor('#3B82F6')}>蓝色</button>
      <button onClick={() => setThemeColor(DEFAULT_THEME_COLOR)}>默认颜色</button>
    </>
  )
}

describe('ThemeProviders', () => {
  let isDark = false
  let media: MediaQueryList
  const listeners = new Set<EventListener>()

  beforeEach(() => {
    isDark = false
    listeners.clear()
    localStorage.clear()
    mocks.antdConfigProviderProps = null
    mocks.configProviderProps = null
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-primary-color')
    document.documentElement.style.removeProperty('--theme-primary')
    document.documentElement.style.removeProperty('--theme-primary-foreground')
    media = {
      get matches() {
        return isDark
      },
      addEventListener: vi.fn((_type: string, listener: EventListener) => listeners.add(listener)),
      removeEventListener: vi.fn((_type: string, listener: EventListener) => listeners.delete(listener)),
    } as unknown as MediaQueryList
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media)
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('applies the Chinese antd locale globally', () => {
    render(<ThemeProviders>content</ThemeProviders>)

    expect(mocks.dayjsLocale).toBe('zh-cn')
    expect(mocks.antdConfigProviderProps?.locale).toBe(mocks.zhCN)
    expect(mocks.configProviderProps?.locale).toBe('zh-CN')
  })

  it('reads the stored mode and updates data-theme and storage when changed', () => {
    localStorage.setItem('theme', 'dark')
    render(
      <ThemeProviders>
        <ThemeControls />
      </ThemeProviders>
    )

    expect(screen.getByRole('button', { name: 'dark' })).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: 'dark' }))

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

  it('keeps Lobe and antd on the same persisted custom primary color', () => {
    localStorage.setItem('theme', 'dark')
    localStorage.setItem('theme-color', '#EF4444')
    render(
      <ThemeProviders>
        <ThemeColorControl />
      </ThemeProviders>
    )

    expect(document.documentElement.dataset.primaryColor).toBe('#ef4444')
    expect(mocks.antdConfigProviderProps?.theme).toMatchObject({
      algorithm: 'dark',
      token: { colorPrimary: '#EF4444' },
    })

    fireEvent.click(screen.getByRole('button', { name: '蓝色' }))

    expect(document.documentElement.dataset.primaryColor).toBe('#3b82f6')
    expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#3B82F6')
    expect(localStorage.getItem('theme-color')).toBe('#3B82F6')
    expect(mocks.antdConfigProviderProps?.theme).toMatchObject({ token: { colorPrimary: '#3B82F6' } })
  })

  it('clears custom color overrides and storage when restored to the default theme', () => {
    localStorage.setItem('theme-color', '#EF4444')
    render(
      <ThemeProviders>
        <ThemeColorControl />
      </ThemeProviders>
    )
    expect(document.documentElement.dataset.primaryColor).toBe('#ef4444')

    fireEvent.click(screen.getByRole('button', { name: '默认颜色' }))

    expect(localStorage.getItem('theme-color')).toBeNull()
    expect(document.documentElement.hasAttribute('data-primary-color')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--theme-primary-foreground')).toBe('')
    expect(mocks.antdConfigProviderProps?.theme).toMatchObject({ token: { colorPrimary: '#222222' } })

    isDark = true
    act(() => {
      for (const listener of listeners) listener(new Event('change'))
    })

    expect(document.documentElement.hasAttribute('data-primary-color')).toBe(false)
    expect(mocks.antdConfigProviderProps?.theme).toMatchObject({ token: { colorPrimary: '#eeeeee' } })
  })
})
