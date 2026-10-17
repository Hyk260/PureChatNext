import type { MetadataRoute } from 'next'

import { appEnv } from '@/envs/app'
import { PUBLIC_SPA_PATHS } from '@/const/publicSpaMetadata'
import { SITE_DEFAULT_URL } from '@/const/site'

/** Resolve the canonical origin from the serving deployment at request time. */
export const dynamic = 'force-dynamic'

const sitemap = (): MetadataRoute.Sitemap => {
  const siteUrl = new URL(appEnv.SITE_CANONICAL_URL ?? appEnv.APP_URL ?? SITE_DEFAULT_URL)

  return PUBLIC_SPA_PATHS.map((pathname) => ({
    changeFrequency: pathname.startsWith('/community/') ? 'weekly' : 'monthly',
    priority: pathname.startsWith('/community/') ? 0.8 : pathname === '/help' ? 0.7 : 0.4,
    url: new URL(pathname, siteUrl).toString(),
  }))
}

export default sitemap
