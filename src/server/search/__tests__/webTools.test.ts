// @vitest-environment node
import type { UIMessage } from 'ai'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../userSettings', () => ({ loadWebSearchSettings: vi.fn(), createUserSearchService: vi.fn() }))

import { prepareWebSearchHistory, supportsNativeWeb } from '../webTools'
import { createFetchUrlsTool } from '../fetchTool'

describe('web tool routing', () => {
  const official = { provider: 'openai', model: 'gpt-5.6-sol' }
  it('enables only supported official models when preference and permissions allow', () => {
    expect(supportsNativeWeb(official, {})).toBe(true)
    expect(supportsNativeWeb(official, { modelToolsPreferred: false })).toBe(false)
    expect(supportsNativeWeb(official, { blacklist: ['*://*.example.com/*'] })).toBe(false)
    expect(supportsNativeWeb({ ...official, desktop: true, permissionMode: 'auto' }, {})).toBe(false)
    expect(supportsNativeWeb({ ...official, desktop: true, permissionMode: 'full' }, {})).toBe(true)
    expect(supportsNativeWeb({ ...official, baseURL: 'https://proxy.example/v1' }, {})).toBe(false)
    expect(supportsNativeWeb({ ...official, provider: 'purechat' }, {})).toBe(false)
    expect(supportsNativeWeb({ ...official, model: 'unknown' }, {})).toBe(false)
  })

  it('adapts incompatible outbound history without modifying persisted native parts', () => {
    const messages: UIMessage[] = [
      {
        id: 'a',
        role: 'assistant',
        parts: [
          {
            type: 'tool-web_search',
            toolCallId: 'native',
            state: 'output-available',
            input: {},
            output: { sources: [{ type: 'url', url: 'https://example.com' }] },
            providerExecuted: true,
          },
        ],
      },
    ]
    const original = JSON.stringify(messages)
    expect(prepareWebSearchHistory(messages, false)[0].parts[0].type).toBe('text')
    expect(prepareWebSearchHistory(messages, true)).toEqual(messages)
    expect(JSON.stringify(messages)).toBe(original)
  })

  it('blocks URLs before crawling and reports per-URL errors for partial failures', async () => {
    const crawlPages = vi.fn().mockResolvedValue({
      results: [
        {
          originalUrl: 'https://ok.example/',
          data: { contentType: 'text', content: '正文', title: '标题', url: 'https://ok.example/' },
        },
        { originalUrl: 'https://bad.example/', data: { errorType: 'TimeoutError' } },
      ],
    })
    const tool = createFetchUrlsTool({ crawlPages }, { blacklist: ['*://blocked.example/*'] })
    const output = await tool.execute!(
      { urls: ['https://blocked.example/', 'https://ok.example/', 'https://bad.example/'] },
      { toolCallId: 'call', messages: [], context: {} }
    )
    expect(crawlPages).toHaveBeenCalledWith({ urls: ['https://ok.example/', 'https://bad.example/'] })
    expect(output).toMatchObject({
      success: true,
      results: [{ title: '标题' }],
      errors: [{ error: 'URL 命中黑名单' }, { error: '网页读取失败，请检查抓取服务或目标网页' }],
    })
  })
})
