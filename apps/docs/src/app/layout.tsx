import type { Metadata, Viewport } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { AskAI } from '@/components/ask-ai'
import { CategorySwitcher } from '@/components/category-switcher'
import { SidebarFooter } from '@/components/sidebar-footer'
import { docsEnv } from '@pure/env/docs'
import { baseOptions } from '@/lib/layout'
import {
  REPOSITORY_OWNER,
  REPOSITORY_URL,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SOCIAL_IMAGE_URL,
} from '@/lib/site'
import { getSiteUrl } from '@/lib/site-url'
import { source } from '@/lib/source'
import { docsI18n } from '@/lib/translations'
import './global.css'

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
  applicationName: SITE_NAME,
  authors: [{ name: REPOSITORY_OWNER, url: `https://github.com/${REPOSITORY_OWNER}` }],
  category: 'technology',
  creator: REPOSITORY_OWNER,
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  metadataBase: siteUrl,
  openGraph: {
    description: SITE_DESCRIPTION,
    images: [{ alt: SITE_NAME, height: 630, url: SOCIAL_IMAGE_URL, width: 1200 }],
    locale: 'zh_CN',
    siteName: SITE_NAME,
    title: SITE_NAME,
    type: 'website',
    url: siteUrl.toString(),
  },
  publisher: REPOSITORY_OWNER,
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
    index: true,
  },
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  twitter: {
    card: 'summary_large_image',
    description: SITE_DESCRIPTION,
    images: [SOCIAL_IMAGE_URL],
    title: SITE_NAME,
  },
  verification: {
    google: docsEnv.DOCS_GOOGLE_VERIFICATION,
    other: {
      ...(docsEnv.DOCS_BAIDU_VERIFICATION ? { 'baidu-site-verification': docsEnv.DOCS_BAIDU_VERIFICATION } : {}),
      ...(docsEnv.DOCS_BING_VERIFICATION ? { 'msvalidate.01': docsEnv.DOCS_BING_VERIFICATION } : {}),
    },
  },
  other: {
    'code-repository': REPOSITORY_URL,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { color: '#ffffff', media: '(prefers-color-scheme: light)' },
    { color: '#151310', media: '(prefers-color-scheme: dark)' },
  ],
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html data-scroll-behavior='smooth' lang='zh-CN' suppressHydrationWarning>
      <body id='top'>
        <RootProvider i18n={docsI18n} search={{ options: { type: 'static' } }}>
          <DocsLayout
            {...baseOptions()}
            sidebar={{
              banner: <CategorySwitcher key='category-switcher' />,
              collapsible: true,
              footer: <SidebarFooter key='sidebar-footer' />,
            }}
            tabs={false}
            tree={source.getPageTree()}
          >
            {children}
            <AskAI />
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}
