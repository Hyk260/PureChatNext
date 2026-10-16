import { describe, expect, it } from 'vitest'
import { estimateTokenCount } from '@pure/utils'

import { invalidBlacklistRules, processWebResults } from '../resultProcessing'
import { webSearchSettingsPatchSchema } from '../settingsSchema'

const result = (url: string, content = '正文') => ({ url, content, title: url })

describe('web result processing', () => {
  it('filters wildcard hosts, paths, regexes, unsafe URLs and duplicates before limiting', () => {
    const output = processWebResults(
      [
        result('https://example.com/private/a'),
        result('https://sub.example.com/private/b'),
        result('https://example.net/a'),
        result('javascript:alert(1)'),
        result('https://keep.example/a#one'),
        result('https://keep.example/a#two'),
        result('https://keep.example/b'),
      ],
      { blacklist: ['*://*.example.com/private/*', '/example\\.net/'], maxResults: 1 }
    )
    expect(output.map((item) => item.url)).toEqual(['https://keep.example/a'])
  })

  it('keeps full content in none mode and divides the token budget across Chinese results', () => {
    const content = '这是一段很长的网页正文。'.repeat(300)
    const input = [result('https://a.example', content), result('https://b.example', content)]
    expect(processWebResults(input, { compression: 'none' })[0].content).toBe(content)
    const compressed = processWebResults(input, { cutoffLimit: 100 })
    expect(compressed).toHaveLength(2)
    expect(estimateTokenCount(compressed[0].content)).toBeLessThanOrEqual(52)
    expect(compressed[0].content.endsWith('…')).toBe(true)
  })

  it('reports invalid rules and rejects invalid boundaries instead of saving them', () => {
    expect(invalidBlacklistRules(['*://*.example.com/*', '/example\\.(net|org)/', '/[/', 'example.com'])).toEqual([
      '/[/',
      'example.com',
    ])
    expect(webSearchSettingsPatchSchema.safeParse({ blacklist: ['/[/', 'example.com'] }).success).toBe(false)
    expect(webSearchSettingsPatchSchema.safeParse({ maxResults: 101 }).success).toBe(false)
    expect(webSearchSettingsPatchSchema.safeParse({ cutoffLimit: 0 }).success).toBe(false)
    expect(
      webSearchSettingsPatchSchema.safeParse({ providers: { exa: { searchBaseURL: 'https://user:pass@api.example' } } })
        .success
    ).toBe(false)
    expect(
      webSearchSettingsPatchSchema.parse({ providers: { exa: { apiKeys: [' a ', 'a', 'b'] } } }).providers?.exa?.apiKeys
    ).toEqual(['a', 'b'])
  })
})
