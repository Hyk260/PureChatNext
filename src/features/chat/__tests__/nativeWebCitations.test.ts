import { describe, expect, it } from 'vitest'

import { formatNativeWebCitations } from '../nativeWebCitations'

describe('native inline citations', () => {
  it('turns provider annotations into clickable citations without modifying raw text', () => {
    const part = {
      type: 'text' as const,
      text: '事实[来源]。',
      providerMetadata: {
        openai: {
          annotations: [{ type: 'url_citation', start_index: 2, end_index: 6, url: 'https://example.com/a(b)' }],
        },
      },
    }
    expect(formatNativeWebCitations(part)).toBe('事实[[1]](https://example.com/a%28b%29)。')
    expect(part.text).toBe('事实[来源]。')
  })
  it('ignores unsafe URLs, invalid offsets, and incomplete streaming annotations', () => {
    const text = '正文'
    expect(
      formatNativeWebCitations({
        type: 'text',
        text,
        providerMetadata: {
          openai: {
            annotations: [
              { type: 'url_citation', start_index: 0, end_index: 2, url: 'javascript:alert(1)' },
              { type: 'url_citation', start_index: 0, end_index: 99, url: 'https://example.com' },
            ],
          },
        },
      })
    ).toBe(text)
  })
})
