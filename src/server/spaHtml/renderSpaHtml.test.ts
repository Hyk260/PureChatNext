import { describe, expect, it } from 'vitest'

import { renderSpaHtml, serializeForHtml } from '@/server/spaHtml'

describe('serializeForHtml', () => {
  it('escapes HTML-sensitive characters in JSON', () => {
    const raw = serializeForHtml({ note: '</script><img src=x onerror=alert(1)>' })
    expect(raw).not.toContain('</script>')
    expect(raw).toContain('\\u003c')
    expect(raw).toContain('\\u003e')
  })
})

describe('renderSpaHtml', () => {
  it('replaces the SPA_SERVER_CONFIG placeholder', async () => {
    const template =
      '<!doctype html><html><head><!--SPA_PUBLIC_METADATA--><!--SPA_SERVER_CONFIG--></head><body></body></html>'
    const res = renderSpaHtml(template, {
      publicMetadata: { baseUrl: 'https://purechat.example', pathname: '/community/agent' },
      serverConfig: { renderedAt: '2026-01-01T00:00:00.000Z' },
    })

    expect(res.headers.get('Content-Type')).toContain('text/html')
    expect(res.headers.get('Cache-Control')).toBe('no-cache')

    const html = await res.text()
    expect(html).toContain('window.__SERVER_CONFIG__=')
    expect(html).toContain('2026-01-01T00:00:00.000Z')
    expect(html).toContain('<link rel="canonical" href="https://purechat.example/community/agent"')
    expect(html).toContain('<meta name="robots" content="index,follow"')
    expect(html).toContain('https://purechat.example/opengraph-image')
    expect(html).not.toContain('<!--SPA_SERVER_CONFIG-->')
    expect(html).not.toContain('<!--SPA_PUBLIC_METADATA-->')
  })

  it('injects before </head> when placeholder is missing', async () => {
    const template = '<!doctype html><html><head><title>x</title></head><body></body></html>'
    const res = renderSpaHtml(template, {
      serverConfig: { renderedAt: '2026-01-01T00:00:00.000Z' },
    })
    const html = await res.text()
    expect(html).toMatch(/window\.__SERVER_CONFIG__=[\s\S]*<\/head>/)
  })

  it('marks authenticated SPA routes as noindex', async () => {
    const template = '<!doctype html><html><head><!--SPA_PUBLIC_METADATA--></head><body></body></html>'
    const res = renderSpaHtml(template, {
      publicMetadata: { baseUrl: 'https://purechat.example', pathname: '/chat' },
      serverConfig: { renderedAt: '2026-01-01T00:00:00.000Z' },
    })

    expect(await res.text()).toContain('<meta name="robots" content="noindex,nofollow"')
  })
})
