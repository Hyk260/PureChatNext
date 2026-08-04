// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { SearXNGClient } from './client'
import { hetongxue } from './fixtures/searXNG'
import { SearXNGImpl } from './index'

vi.mock('@/envs/tools', () => ({
  toolsEnv: {
    SEARXNG_URL: 'https://demo.com',
  },
}))

describe('SearXNGImpl', () => {
  describe('query', () => {
    it('搜索结果超过10个', async () => {
      vi.spyOn(SearXNGClient.prototype, 'search').mockResolvedValueOnce(hetongxue)

      const searchImpl = new SearXNGImpl()
      const results = await searchImpl.query('何同学')

      // Assert
      expect(results.results.length).toEqual(43)
    })

    it('缺少 number_of_results 时回退为 results.length', async () => {
      const { number_of_results: _, ...withoutCount } = hetongxue
      vi.spyOn(SearXNGClient.prototype, 'search').mockResolvedValueOnce(withoutCount)

      const searchImpl = new SearXNGImpl()
      const results = await searchImpl.query('何同学')

      expect(results.resultNumbers).toBe(results.results.length)
      expect(results.resultNumbers).toBe(43)
    })
  })
})
