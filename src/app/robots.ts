import type { MetadataRoute } from 'next'

import { appEnv } from '@/envs/app'
import { SITE_DEFAULT_URL } from '@/const/site'

/** Revalidate robots.txt every 24 hours. */
export const revalidate = 86_400
export const dynamic = 'force-static'

const robots = (): MetadataRoute.Robots => {
  const siteUrl = new URL(appEnv.APP_URL ?? SITE_DEFAULT_URL)

  return {
    host: siteUrl.origin,
    rules: [
      // Social crawlers: allow community pages for link previews
      {
        allow: ['/community/*'],
        userAgent: ['Facebot', 'facebookexternalhit'],
      },
      {
        allow: ['/community/*'],
        userAgent: 'LinkedInBot',
      },
      {
        allow: ['/community/*'],
        userAgent: 'Twitterbot',
      },
      {
        allow: '/',
        disallow: [
          '/api/',
          '/signin',
          '/signup',
          '/login',
          '/verify-email',
          '/reset-password',
          '/auth-error',
          '/settings/',
          '/chat',
          '/resources/',
          '/profile',
          '/protected',
          '/dev/',
        ],
        userAgent: '*',
      },
    ],
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
  }
}

export default robots
