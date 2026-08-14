// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  weatherTool: { description: 'weather tool' },
  webSearchTool: { description: 'search tool' },
}))

vi.mock('@/server/search/chatTool', () => ({ webSearchTool: mocks.webSearchTool }))
vi.mock('@/server/weather/chatTool', () => ({ weatherTool: mocks.weatherTool }))

import { resolveChatToolInstructions, resolveChatTools } from './toolRegistry'

describe('chat tool registry', () => {
  it('keeps structured weather available to web chat when search is off', () => {
    expect(resolveChatTools({ channel: 'web', searchMode: 'off' })).toEqual({
      getWeather: mocks.weatherTool,
    })
  })

  it('exposes weather and web search to web chat in auto mode', () => {
    expect(resolveChatTools({ channel: 'web', searchMode: 'auto' })).toEqual({
      getWeather: mocks.weatherTool,
      webSearch: mocks.webSearchTool,
    })
  })

  it('exposes weather and search to WeChat by default', () => {
    expect(resolveChatTools({ channel: 'wechat', searchMode: 'auto' })).toEqual({
      getWeather: mocks.weatherTool,
      webSearch: mocks.webSearchTool,
    })
  })

  it('only emits instructions for enabled tools', () => {
    expect(resolveChatToolInstructions({ channel: 'web', searchMode: 'off' }).join('\n')).toMatch(/getWeather/)
    expect(resolveChatToolInstructions({ channel: 'wechat', searchMode: 'auto' }).join('\n')).toMatch(
      /webSearch[\s\S]*getWeather/
    )
  })
})
