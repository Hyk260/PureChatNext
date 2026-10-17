import { describe, expect, it, vi } from 'vitest'

import manifest from './manifest'
import OpenGraphImage, { contentType, size } from './opengraph-image'
import robots, { dynamic as robotsDynamic } from './robots'
import sitemap, { dynamic as sitemapDynamic } from './sitemap'

vi.mock('@/envs/app', () => ({ appEnv: { APP_URL: 'https://purechat.test' } }))

describe('public metadata routes', () => {
  it('publishes indexable public URLs and a sitemap reference', () => {
    const sitemapEntries = sitemap()
    const robotsConfig = robots()

    expect(robotsDynamic).toBe('force-dynamic')
    expect(sitemapDynamic).toBe('force-dynamic')
    expect(sitemapEntries.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/community/agent',
      '/community/provider',
      '/community/skill',
      '/help',
      '/privacy',
      '/terms',
    ])
    expect(robotsConfig.sitemap).toMatch(/\/sitemap\.xml$/)
    expect(robotsConfig.host).toBe('https://purechat.test')
    expect(sitemapEntries.every((entry) => entry.url.startsWith('https://purechat.test/'))).toBe(true)
    expect(sitemapEntries.every((entry) => entry.lastModified === undefined)).toBe(true)
  })

  it('exposes install metadata and a social image response', () => {
    const manifestConfig = manifest()
    const image = OpenGraphImage()

    expect(manifestConfig.start_url).toBe('/')
    expect(manifestConfig.name).toBe('PureChat')
    expect(size).toEqual({ height: 630, width: 1200 })
    expect(contentType).toBe('image/png')
    expect(image.headers.get('content-type')).toBe('image/png')
  })
})
