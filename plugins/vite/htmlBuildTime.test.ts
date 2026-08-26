import { describe, expect, it } from 'vitest'

import { createHtmlBuildTimePlugin } from './htmlBuildTime'

describe('createHtmlBuildTimePlugin', () => {
  const plugin = createHtmlBuildTimePlugin('2026-01-01T00:00:00.000Z')
  const transform = plugin.transformIndexHtml as (html: string) => string

  it('injects a buildTime meta tag into <head>', () => {
    const html = transform('<!doctype html><html><head><title>x</title></head><body></body></html>')
    expect(html).toContain('<meta name="buildTime" content="2026-01-01T00:00:00.000Z" />')
  })

  it('does not duplicate an existing buildTime meta tag', () => {
    const source = '<head><meta name="buildTime" content="existing" /></head>'
    expect(transform(source)).toBe(source)
  })
})
