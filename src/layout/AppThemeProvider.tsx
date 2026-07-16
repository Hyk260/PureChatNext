'use client'

import { extractStaticStyle } from 'antd-style'
import { useServerInsertedHTML } from 'next/navigation'
import { type PropsWithChildren, useRef } from 'react'

import ThemeProviders from './ThemeProviders'

const AppThemeProvider = ({ children }: PropsWithChildren) => {
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

  return <ThemeProviders>{children}</ThemeProviders>
}

export default AppThemeProvider
