'use client'

import { ConfigProvider, ThemeProvider } from '@lobehub/ui'
import { StyleProvider, extractStaticStyle } from 'antd-style'
import { LazyMotion, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import { useServerInsertedHTML } from 'next/navigation'
import { type PropsWithChildren, useRef } from 'react'

import AntdStaticMethods from '@/components/AntdStaticMethods'
import { useSystemAppearance } from '@/hooks/useSystemAppearance'
import { ModalHost } from '@/libs/modal'

const AppThemeProvider = ({ children }: PropsWithChildren) => {
  const appearance = useSystemAppearance()
  const isStyleInserted = useRef(false)

  useServerInsertedHTML(() => {
    if (isStyleInserted.current) return
    isStyleInserted.current = true

    const extractedStyles = extractStaticStyle().map((item) => item.style)

    return (
      <>
        <style
          dangerouslySetInnerHTML={{
            __html: 'html, body { height: 100%; margin: 0; }',
          }}
        />
        {extractedStyles}
      </>
    )
  })

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
        {/* base-ui Modal uses motion/react-m + AnimatePresence; features must be loaded */}
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

export default AppThemeProvider
