import type { UniformSearchResult } from '@pure/types'
import { describe, expect, it } from 'vitest'

import { filterRelevantSearchResults } from './searchQuality'

const result = (title: string, content = ''): UniformSearchResult => ({
  content,
  engines: ['test'],
  parsedUrl: 'example.com',
  score: 1,
  title,
  url: 'https://example.com',
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

  it('does not reorder or filter unrelated query intents', () => {
    const results = [result('TypeScript 文档'), result('其他结果')]
    expect(filterRelevantSearchResults('TypeScript 7 新特性', results)).toBe(results)
  })
})
