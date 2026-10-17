import type { MetadataRoute } from 'next'

import { appEnv } from '@/envs/app'
import { SITE_DEFAULT_URL } from '@/const/site'

/** Resolve the canonical origin from the serving deployment at request time. */
export const dynamic = 'force-dynamic'

const robots = (): MetadataRoute.Robots => {
  const siteUrl = new URL(appEnv.SITE_CANONICAL_URL ?? appEnv.APP_URL ?? SITE_DEFAULT_URL)

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
          '/verify-email',
          '/reset-password',
          '/auth-error',
          '/settings/',
          '/chat',
          '/resources/',
          '/profile',
          '/dev/',
        ],
        userAgent: '*',
      },
    ],
    sitemap: new URL('/sitemap.xml', siteUrl).toString(),
  }
}

export default robots
