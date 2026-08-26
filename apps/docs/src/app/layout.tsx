import type { Metadata, Viewport } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { AskAI } from '@/components/ask-ai'
import { CategorySwitcher } from '@/components/category-switcher'
import { SidebarFooter } from '@/components/sidebar-footer'
import { baseOptions } from '@/lib/layout'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'
import { source } from '@/lib/source'
import { docsI18n } from '@/lib/translations'
import './global.css'

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: SITE_DESCRIPTION,
    locale: 'zh_CN',
    siteName: SITE_NAME,
    title: SITE_NAME,
    type: 'website',
    url: SITE_URL,
  },
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  twitter: {
    card: 'summary_large_image',
    description: SITE_DESCRIPTION,
    title: SITE_NAME,
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
