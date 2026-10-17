import { describe, expect, it } from 'vitest'

import { syncSpaPageMetadata } from './spaPageMetadata'

describe('syncSpaPageMetadata', () => {
  it('updates canonical, robots, and social metadata for client navigation', () => {
    document.head.innerHTML = '<link rel="canonical" href="https://self-hosted.example/chat">'

    syncSpaPageMetadata(document, '/community/provider')

    expect(document.title).toBe('AI 服务商目录 | PureChat')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index,follow')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      '查看 PureChat 支持的 AI 服务商，了解多模型接入入口。'
    )
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://self-hosted.example/community/provider'
    )
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(
      'https://self-hosted.example/community/provider'
    )
    expect(document.querySelector('meta[name="twitter:image"]')?.getAttribute('content')).toBe(
      'https://self-hosted.example/opengraph-image'
    )
  })

  it('keeps private routes noindex and marks filtered community URLs noindex', () => {
    document.head.innerHTML = '<link rel="canonical" href="https://purechat.example/community/provider">'

    syncSpaPageMetadata(document, '/chat')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,follow')

    syncSpaPageMetadata(document, '/community/provider', true)
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex,follow')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://purechat.example/community/provider'
    )
  })
})
