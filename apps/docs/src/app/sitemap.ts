import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/site-url'
import { source } from '@/lib/source'

const sitemap = (): MetadataRoute.Sitemap => {
  const siteUrl = getSiteUrl()

  return source.getPages().map((page) => ({
    changeFrequency: page.url === '/' ? 'weekly' : 'monthly',
    lastModified: page.data.lastModified,
    priority: page.url === '/' ? 1 : 0.7,
    url: new URL(page.url, siteUrl).toString(),
  }))
}

export default sitemap
