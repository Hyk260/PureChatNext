'use client'

import { ConfigProvider, ThemeProvider } from '@pure/ui/ThemeProvider'
import { ModalHost } from '@pure/ui/ModalHost'
import { StyleProvider } from 'antd-style'
import type { ThemeMode } from 'antd-style'
import { LazyMotion, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import { useCallback, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'

import AntdStaticMethods from '@/components/AntdStaticMethods'
import { useSystemAppearance } from '@/hooks/useSystemAppearance'
import {
  DEFAULT_THEME_MODE,
  parseStoredThemeMode,
  resolveThemeAppearance,
  serializeThemeMode,
  THEME_STORAGE_KEY,
} from '@/layout/themeMode'

/**
 * Client theme stack shared by Vite SPA AppLayer (and legacy Next root if needed).
 * No Next-specific APIs — safe for Vite bundling.
 */
const ThemeProviders = ({ children }: PropsWithChildren) => {
  const systemAppearance = useSystemAppearance()
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return DEFAULT_THEME_MODE

    try {
      return parseStoredThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY))
    } catch {
      return DEFAULT_THEME_MODE
    }
  })
  const appearance = resolveThemeAppearance(themeMode, systemAppearance)

  const handleThemeModeChange = useCallback((nextThemeMode: ThemeMode) => {
    setThemeMode(nextThemeMode)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, serializeThemeMode(nextThemeMode))
    } catch {
      // Ignore storage failures so theme switching still works in restricted browsers.
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = appearance
  }, [appearance])

  return (
    <StyleProvider ssrInline={false} speedy>
      <ThemeProvider
        appearance={appearance}
        defaultAppearance='light'
        defaultThemeMode='auto'
        onThemeModeChange={handleThemeModeChange}
        themeMode={themeMode}
        style={{ height: '100%' }}
        theme={{ cssVar: { key: 'pure-vars' } }}
      >
        <AntdStaticMethods />
        <LazyMotion features={domAnimation}>
          <ConfigProvider motion={m}>
            <ModalHost />
            {children}
          </ConfigProvider>
        </LazyMotion>
      </ThemeProvider>
    </StyleProvider>
  )
}

export default ThemeProviders
