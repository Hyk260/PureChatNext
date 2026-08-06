// @vitest-environment node
import type { ChatWebSearchToolResult, UniformSearchResponse } from '@pure/types'
import { describe, expect, it, vi } from 'vitest'

import { createWebSearchTool } from './chatTool'

const createResponse = (overrides: Partial<UniformSearchResponse> = {}): UniformSearchResponse => ({
  costTime: 10,
  query: 'test',
  resultNumbers: 0,
  results: [],
  ...overrides,
})

const executeTool = async (
  webSearch: (input: { query: string }) => Promise<UniformSearchResponse>,
  query = 'test query'
) => {
  const searchTool = createWebSearchTool({ webSearch })
  if (!searchTool.execute) throw new Error('Expected executable web search tool')

  return (await searchTool.execute(
    { query },
    { abortSignal: undefined, context: {}, messages: [], toolCallId: 'call-1' }
  )) as ChatWebSearchToolResult
}

describe('webSearchTool', () => {
  it('limits results, trims content, and excludes unsafe URLs', async () => {
    const longContent = `  ${'content '.repeat(100)}  `
    const results = Array.from({ length: 7 }, (_, index) => ({
      content: longContent,
      engines: ['test'],
      parsedUrl: `https://example.com/${index}`,
      score: 1,
      title: ` Result ${index} `,
      url: index === 0 ? 'javascript:alert(1)' : index === 2 ? 'https://example.com/1' : `https://example.com/${index}`,
    }))
    const webSearch = vi.fn().mockResolvedValue(createResponse({ resultNumbers: results.length, results }))

    const output = await executeTool(webSearch)

    expect(webSearch).toHaveBeenCalledWith({ query: 'test query' }, { filterIrrelevant: true })
    expect(output.success).toBe(true)
    if (!output.success) return
    expect(output.results).toHaveLength(5)
    expect(output.results[0].url).toBe('https://example.com/1')
    expect(new Set(output.results.map((result) => result.url)).size).toBe(5)
    expect(output.results[0].content.length).toBeLessThanOrEqual(600)
    expect(output.results[0].content).not.toMatch(/\s{2,}/)
  })

  it('returns an empty successful result when no source matches', async () => {
    const output = await executeTool(vi.fn().mockResolvedValue(createResponse()))

    expect(output).toEqual({ query: 'test query', results: [], success: true })
  })

  it('converts provider errors into a safe tool result', async () => {
    const output = await executeTool(
      vi.fn().mockResolvedValue(createResponse({ errorDetail: 'secret upstream configuration error' }))
    )

    expect(output).toEqual({
      error: '联网搜索暂不可用，请检查搜索服务配置后重试。',
      query: 'test query',
      results: [],
      success: false,
    })
    expect(JSON.stringify(output)).not.toContain('secret upstream')
  })

  it('converts thrown errors into a safe tool result', async () => {
    const output = await executeTool(vi.fn().mockRejectedValue(new Error('API key abc123')))

    expect(output.success).toBe(false)
    expect(JSON.stringify(output)).not.toContain('abc123')
  })
})
