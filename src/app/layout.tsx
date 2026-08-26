import { Suspense } from 'react'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'

import Analytics from '@/components/Analytics'
import { appEnv, IS_VERCEL } from '@/envs/app'
import {
  SITE_DEFAULT_URL,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_REPOSITORY_URL,
  SITE_TITLE,
} from '@/const/site'

import '@/styles/globals.css'
import '@/styles/scrollbar.css'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  applicationName: SITE_NAME,
  authors: [{ name: 'Hyk260', url: 'https://github.com/Hyk260' }],
  category: 'technology',
  creator: 'Hyk260',
  description: SITE_DESCRIPTION,
  icons: {
    apple: '/favicon.png',
    icon: '/favicon.png',
  },
  keywords: SITE_KEYWORDS,
  manifest: '/manifest.webmanifest',
  metadataBase: new URL(appEnv.APP_URL ?? SITE_DEFAULT_URL),
  openGraph: {
    description: SITE_DESCRIPTION,
    images: [{ alt: SITE_TITLE, height: 630, url: '/opengraph-image', width: 1200 }],
    locale: 'zh_CN',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    type: 'website',
    url: '/',
  },
  publisher: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  twitter: {
    card: 'summary_large_image',
    description: SITE_DESCRIPTION,
    images: ['/opengraph-image'],
    title: SITE_TITLE,
  },
  verification: {},
  other: {
    'code-repository': SITE_REPOSITORY_URL,
  },
}

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang='zh-CN' suppressHydrationWarning style={{ height: '100%' }}>
      <body style={{ height: '100%', margin: 0 }}>
        {children}
        <Suspense fallback={null}>
          <Analytics />
          {IS_VERCEL && <SpeedInsights />}
        </Suspense>
      </body>
    </html>
  )
}

export default RootLayout
