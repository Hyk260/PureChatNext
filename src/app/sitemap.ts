import type { MetadataRoute } from 'next'

import { appEnv } from '@/envs/app'
import { PUBLIC_SPA_PATHS, SITE_DEFAULT_URL } from '@/const/site'

export const revalidate = 86_400
export const dynamic = 'force-static'

const sitemap = (): MetadataRoute.Sitemap => {
  const siteUrl = new URL(appEnv.APP_URL ?? SITE_DEFAULT_URL)
  const now = new Date()

  return PUBLIC_SPA_PATHS.map((pathname) => ({
    changeFrequency: pathname === '/' ? 'weekly' : 'monthly',
    lastModified: now,
    priority: pathname === '/' ? 1 : pathname === '/community' ? 0.8 : 0.5,
    url: new URL(pathname, siteUrl).toString(),
  }))
}

export default sitemap
