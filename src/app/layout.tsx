import { type ReactNode, Suspense } from 'react'
import { SpeedInsights } from '@vercel/speed-insights/next'

import Analytics from '@/components/Analytics'

import type { Metadata } from 'next'

import '@/styles/globals.css'
import '@/styles/scrollbar.css'

export const metadata: Metadata = {
  title: 'PureChat',
  description: 'PureChat is a chat application that allows you to chat with your friends and family.',
}

const inVercel = process.env.VERCEL === '1'

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang='zh-CN' suppressHydrationWarning style={{ height: '100%' }}>
      <body style={{ height: '100%', margin: 0 }}>
        {children}
        <Suspense fallback={null}>
          <Analytics />
          {inVercel && <SpeedInsights />}
        </Suspense>
      </body>
    </html>
  )
}

export default RootLayout
