import type { UniformSearchResult } from '@pure/types'
import { describe, expect, it } from 'vitest'

import { filterRelevantSearchResults } from '../searchQuality'

const NOW = Date.parse('2026-09-07T12:00:00+08:00')

const result = (
  title: string,
  content = '',
  overrides: Partial<UniformSearchResult> = {}
): UniformSearchResult => ({
  content,
  engines: ['test'],
  parsedUrl: 'example.com',
  score: 1,
  title,
  url: 'https://example.com',
  ...overrides,
})

describe('filterRelevantSearchResults', () => {
  it('removes off-topic weather results', () => {
    expect(
      filterRelevantSearchResults('2026年8月6日武汉洪山区天气', [
        result('2026年大事一览'),
        result('洪山区天气预报', '今日气温与降雨概率'),
      ])
    ).toEqual([result('洪山区天气预报', '今日气温与降雨概率')])
  })

  it('drops encyclopedia year pages, calendars, and stale items from news queries', () => {
    const usable = result('国内要闻', '今日头条', {
      parsedUrl: 'news.cctv.com',
      publishedDate: '2026-09-07T01:00:00.000Z',
      url: 'https://news.cctv.com/china/',
    })

    expect(
      filterRelevantSearchResults(
        '今日新闻',
        [
          result('2026 - Wikipedia', '', {
            parsedUrl: 'en.wikipedia.org',
            url: 'https://en.wikipedia.org/wiki/2026',
          }),
          result('Year 2026 Calendar', '', {
            parsedUrl: 'www.timeanddate.com',
            url: 'https://www.timeanddate.com/calendar/?year=2026&country=1',
          }),
          result('iPhone 7 hits China', '', {
            parsedUrl: 'weixin.sogou.com',
            publishedDate: '2016-09-17T10:09:51',
            url: 'https://weixin.sogou.com/link?url=old',
          }),
          usable,
        ],
        NOW
      )
    ).toEqual([usable])
  })

  it('keeps undated news results that are not encyclopedias or calendars', () => {
    const undated = result('新华社新闻', '要闻摘要', {
      parsedUrl: 'www.xinhuanet.com',
      url: 'https://www.xinhuanet.com/politics/',
    })

    expect(filterRelevantSearchResults('中国新闻', [undated], NOW)).toEqual([undated])
  })

  it('does not reorder or filter unrelated query intents', () => {
    const results = [result('TypeScript 文档'), result('其他结果')]
    expect(filterRelevantSearchResults('TypeScript 7 新特性', results)).toBe(results)
  })
})
