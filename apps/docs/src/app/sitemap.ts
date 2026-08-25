import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { source } from '@/lib/source'

export default function sitemap(): MetadataRoute.Sitemap {
  return source.getPages().map((page) => ({
    changeFrequency: page.url === '/' ? 'weekly' : 'monthly',
    priority: page.url === '/' ? 1 : 0.7,
    url: new URL(page.url, SITE_URL).toString(),
  }))
}
