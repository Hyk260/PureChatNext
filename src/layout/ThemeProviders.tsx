'use client'

import { ConfigProvider, ThemeProvider } from '@lobehub/ui'
import { StyleProvider } from 'antd-style'
import { LazyMotion, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import { type PropsWithChildren } from 'react'

import AntdStaticMethods from '@/components/AntdStaticMethods'
import { useSystemAppearance } from '@/hooks/useSystemAppearance'
import { ModalHost } from '@/libs/modal'

/**
 * Client theme stack shared by Vite SPA AppLayer (and legacy Next root if needed).
 * No Next-specific APIs — safe for Vite bundling.
 */
const ThemeProviders = ({ children }: PropsWithChildren) => {
  const appearance = useSystemAppearance()

  return (
    <StyleProvider ssrInline={false} speedy>
      <ThemeProvider
        appearance={appearance}
        defaultAppearance="light"
        defaultThemeMode="light"
        style={{ height: '100%' }}
        theme={{ cssVar: { key: 'pure-vars' } }}
      >
        <AntdStaticMethods />
        <LazyMotion features={domAnimation}>
          <ConfigProvider motion={m}>
            {children}
            <ModalHost />
          </ConfigProvider>
        </LazyMotion>
      </ThemeProvider>
    </StyleProvider>
  )
}

export default ThemeProviders
