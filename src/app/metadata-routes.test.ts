import { describe, expect, it, vi } from 'vitest'

import manifest from './manifest'
import OpenGraphImage, { contentType, size } from './opengraph-image'
import robots from './robots'
import sitemap from './sitemap'

vi.mock('@/envs/app', () => ({ appEnv: { APP_URL: 'https://purechat.test' } }))

describe('public metadata routes', () => {
  it('publishes indexable public URLs and a sitemap reference', () => {
    const sitemapEntries = sitemap()
    const robotsConfig = robots()

    expect(sitemapEntries.map((entry) => new URL(entry.url).pathname)).toEqual([
      '/',
      '/community',
      '/help',
      '/privacy',
      '/terms',
    ])
    expect(robotsConfig.sitemap).toMatch(/\/sitemap\.xml$/)
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
