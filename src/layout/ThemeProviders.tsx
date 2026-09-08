'use client'

import { ConfigProvider, ThemeProvider } from '@pure/ui/ThemeProvider'
import { ModalHost } from '@pure/ui/ModalHost'
import { ConfigProvider as AntdConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { StyleProvider } from 'antd-style'
import type { ThemeMode } from 'antd-style'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { LazyMotion, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import { useCallback, useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { localStg } from '@pure/utils/storage'

import AntdStaticMethods from '@/components/AntdStaticMethods'
import { useSystemAppearance } from '@/hooks/useSystemAppearance'
import {
  DEFAULT_THEME_MODE,
  parseStoredThemeMode,
  resolveThemeAppearance,
  serializeThemeMode,
  THEME_STORAGE_KEY,
} from '@/layout/themeMode'

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
  const appearance = resolveThemeAppearance(themeMode, systemAppearance)

  const handleThemeModeChange = useCallback((nextThemeMode: ThemeMode) => {
    setThemeMode(nextThemeMode)

    localStg.setString(THEME_STORAGE_KEY, serializeThemeMode(nextThemeMode))
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = appearance
  }, [appearance])

  return (
    <StyleProvider ssrInline={false} speedy>
      <AntdConfigProvider locale={zhCN}>
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
      </AntdConfigProvider>
    </StyleProvider>
  )
}

export default ThemeProviders
