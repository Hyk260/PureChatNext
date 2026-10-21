'use client'

import { ModalHost } from '@pure/ui/ModalHost'
import { ConfigProvider, createLobeToken, setLobeTheme, ToastHost } from '@lobehub/ui'
import { zhCn as lobeZhCn } from '@lobehub/ui/i18n'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { LazyMotion, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { localStg } from '@pure/utils/storage'

import { useSystemAppearance } from '@/hooks/useSystemAppearance'
import {
  parseStoredThemeMode,
  resolveThemeAppearance,
  serializeThemeMode,
  THEME_STORAGE_KEY,
  ThemeModeContext,
} from '@/layout/themeMode'
import type { ThemeMode } from '@/layout/themeMode'
import {
  DEFAULT_THEME_COLOR,
  getThemeColorForeground,
  parseStoredThemeColor,
  ThemeColorContext,
  THEME_COLOR_STORAGE_KEY,
} from '@/layout/themeColor'

dayjs.locale('zh-cn')

/**
 * Client theme stack shared by Vite SPA AppLayer (and legacy Next root if needed).
 * No Next-specific APIs — safe for Vite bundling.
 */
const ThemeProviders = ({ children }: PropsWithChildren) => {
  const systemAppearance = useSystemAppearance()
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return parseStoredThemeMode(localStg.getString(THEME_STORAGE_KEY))
  })
  const [themeColor, setThemeColor] = useState(() => {
    return parseStoredThemeColor(localStg.getString(THEME_COLOR_STORAGE_KEY))
  })
  const appearance = resolveThemeAppearance(themeMode, systemAppearance)
  const isDefaultThemeColor = themeColor === DEFAULT_THEME_COLOR
  const resolvedThemeColor = isDefaultThemeColor ? createLobeToken({ appearance }).colorPrimary : themeColor

  const handleThemeModeChange = useCallback((nextThemeMode: ThemeMode) => {
    setThemeMode(nextThemeMode)

    localStg.setString(THEME_STORAGE_KEY, serializeThemeMode(nextThemeMode))
  }, [])

  const handleThemeColorChange = useCallback((nextThemeColor: string) => {
    const color = parseStoredThemeColor(nextThemeColor)
    setThemeColor(color)
    if (color === DEFAULT_THEME_COLOR) {
      localStg.remove(THEME_COLOR_STORAGE_KEY)
    } else {
      localStg.setString(THEME_COLOR_STORAGE_KEY, color)
    }
  }, [])

  useLayoutEffect(() => {
    setLobeTheme({ appearance, primaryColor: isDefaultThemeColor ? undefined : themeColor })
  }, [appearance, isDefaultThemeColor, themeColor])

  useEffect(() => {
    if (isDefaultThemeColor) {
      document.documentElement.style.removeProperty('--theme-primary')
      document.documentElement.style.removeProperty('--theme-primary-foreground')
      return
    }
    document.documentElement.style.setProperty('--theme-primary', themeColor)
    document.documentElement.style.setProperty('--theme-primary-foreground', getThemeColorForeground(themeColor))
  }, [isDefaultThemeColor, themeColor])

  return (
    <LazyMotion features={domAnimation}>
      <ConfigProvider locale='zh-CN' resources={lobeZhCn} motion={m}>
        <ThemeModeContext value={{ themeMode, setThemeMode: handleThemeModeChange }}>
          <ModalHost />
          <ToastHost />
          <ThemeColorContext.Provider value={{ themeColor, resolvedThemeColor, setThemeColor: handleThemeColorChange }}>
            {children}
          </ThemeColorContext.Provider>
        </ThemeModeContext>
      </ConfigProvider>
    </LazyMotion>
  )
}

export default ThemeProviders
