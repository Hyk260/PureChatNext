import type { MetadataRoute } from 'next'

import { appEnv } from '@/envs/app'

/** Revalidate robots.txt every 24 hours. */
export const revalidate = 86_400
export const dynamic = 'force-static'

const robots = (): MetadataRoute.Robots => {
  return {
    ...(appEnv.APP_URL ? { host: appEnv.APP_URL } : {}),
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
  }
}

export default robots
