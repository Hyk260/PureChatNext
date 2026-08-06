// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createProviderLanguageModel: vi.fn(() => ({ modelId: 'test-model' })),
  findVisibleById: vi.fn(),
  generateText: vi.fn(),
  isStepCount: vi.fn(),
  stopWhen: vi.fn(() => false),
  weatherTool: { description: 'weather tool' },
  webSearchTool: { description: 'search tool' },
}))

vi.mock('ai', () => ({
  generateText: mocks.generateText,
  isStepCount: mocks.isStepCount,
}))
vi.mock('@pure/database/models/agent', () => ({
  AgentModel: vi.fn(() => ({ findVisibleById: mocks.findVisibleById })),
}))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  createProviderLanguageModel: mocks.createProviderLanguageModel,
  isSupportedProviderId: (provider: string) => provider === 'openai' || provider === 'deepseek',
  resolveProviderApiKey: () => 'test-api-key',
}))
vi.mock('@/server/search/chatTool', () => ({ webSearchTool: mocks.webSearchTool }))
vi.mock('@/server/weather/chatTool', () => ({ weatherTool: mocks.weatherTool }))

import { buildWechatRuntimeInstructions, generateWechatAgentReply } from '../agentBridge'

describe('generateWechatAgentReply', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isStepCount.mockReturnValue(mocks.stopWhen)
    mocks.findVisibleById.mockResolvedValue({
      id: 'agent-1',
      model: 'gpt-test',
      provider: 'openai',
      systemRole: '回答要简洁',
    })
    mocks.generateText.mockResolvedValue({ finishReason: 'stop', steps: [{ finishReason: 'stop' }], text: '基于联网结果的回答' })
  })

  it('enables bounded web search by default', async () => {
    const abortController = new AbortController()
    const reply = await generateWechatAgentReply({
      abortSignal: abortController.signal,
      agentId: 'agent-1',
      history: [{ content: '上一问', responseText: '上一答' }],
      userId: 'user-1',
      userText: '今天有什么新闻？',
    })

    expect(reply).toBe('基于联网结果的回答')
    expect(mocks.isStepCount).toHaveBeenCalledWith(5)
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: abortController.signal,
        instructions: expect.stringMatching(/回答要简洁[\s\S]*Asia\/Shanghai[\s\S]*getWeather/),
        messages: [
          { content: '上一问', role: 'user' },
          { content: '上一答', role: 'assistant' },
          { content: '今天有什么新闻？', role: 'user' },
        ],
        model: { modelId: 'test-model' },
        onStepEnd: expect.any(Function),
        prepareStep: expect.any(Function),
        stopWhen: mocks.stopWhen,
        tools: { getWeather: mocks.weatherTool, webSearch: mocks.webSearchTool },
      })
    )

    const options = mocks.generateText.mock.calls[0]![0]
    expect(options.prepareStep({ stepNumber: 2 })).toBeUndefined()
    expect(options.prepareStep({ stepNumber: 3 })).toEqual({ activeTools: [], toolChoice: 'none' })
  })

  it('injects an explicit Shanghai date for relative-time questions', () => {
    const instructions = buildWechatRuntimeInstructions(new Date('2026-08-06T04:30:00.000Z'))

    expect(instructions).toContain('2026年8月6日星期四')
    expect(instructions).toContain('Asia/Shanghai')
  })
})
