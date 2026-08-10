// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assertPureChatCanChat: vi.fn(),
  chargePureChatGenerateUsage: vi.fn(),
  createProviderLanguageModel: vi.fn(() => ({ modelId: 'test-model' })),
  createPureChatLanguageModel: vi.fn(() => ({ modelId: 'purechat-model' })),
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
vi.mock('@/server/purechat', () => ({
  assertPureChatCanChat: mocks.assertPureChatCanChat,
  chargePureChatGenerateUsage: mocks.chargePureChatGenerateUsage,
  createPureChatLanguageModel: mocks.createPureChatLanguageModel,
}))
vi.mock('@/server/purechat/gatewayError', () => ({
  isPureChatRestrictedModelError: () => false,
  PURECHAT_MODEL_UNAVAILABLE_MESSAGE: '该模型在 PureChat 免费套餐中暂不可用，请切换到其他模型。',
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
    mocks.generateText.mockResolvedValue({
      finishReason: 'stop',
      steps: [{ finishReason: 'stop' }],
      text: '基于联网结果的回答',
      usage: {
        inputTokenDetails: { cacheReadTokens: undefined },
        inputTokens: 10,
        outputTokens: 5,
      },
    })
    mocks.assertPureChatCanChat.mockResolvedValue({
      settlementId: 'settlement-1',
      settlementPeriod: '2026-08',
    })
  })

  it('enables bounded web search by default', async () => {
    const abortController = new AbortController()
    const reply = await generateWechatAgentReply({
      abortSignal: abortController.signal,
      agentId: 'agent-1',
      history: [{ content: '上一问', responseText: '上一答' }],
      model: 'gpt-channel',
      provider: 'openai',
      userId: 'user-1',
      userText: '今天有什么新闻？',
    })

    expect(reply).toMatchObject({
      model: 'gpt-channel',
      provider: 'openai',
      text: '基于联网结果的回答',
    })
    expect(reply.durationMs).toBeGreaterThanOrEqual(0)
    expect(mocks.isStepCount).toHaveBeenCalledWith(5)
    expect(mocks.assertPureChatCanChat).not.toHaveBeenCalled()
    expect(mocks.createProviderLanguageModel).toHaveBeenCalledWith('openai', 'gpt-channel', 'test-api-key', undefined)
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

  it('uses PureChat gateway model and charges usage', async () => {
    mocks.findVisibleById.mockResolvedValue({
      id: 'agent-pure',
      model: 'gpt-5.4-mini',
      provider: 'purechat',
      systemRole: '简洁回答',
    })

    const reply = await generateWechatAgentReply({
      agentId: 'agent-pure',
      model: 'gpt-5.4-mini',
      provider: 'purechat',
      userId: 'user-1',
      userText: '你好',
    })

    expect(reply).toMatchObject({
      model: 'gpt-5.4-mini',
      provider: 'purechat',
      text: '基于联网结果的回答',
    })
    expect(mocks.assertPureChatCanChat).toHaveBeenCalledWith('user-1', 'gpt-5.4-mini')
    expect(mocks.createPureChatLanguageModel).toHaveBeenCalledWith('gpt-5.4-mini')
    expect(mocks.createProviderLanguageModel).not.toHaveBeenCalled()
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ model: { modelId: 'purechat-model' } })
    )
    expect(mocks.chargePureChatGenerateUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        settlementId: 'settlement-1',
        settlementPeriod: '2026-08',
        userId: 'user-1',
      })
    )
  })

  it('uses the channel model instead of the Agent model', async () => {
    mocks.findVisibleById.mockResolvedValue({
      id: 'agent-pure',
      model: null,
      provider: 'purechat',
      systemRole: null,
    })

    await generateWechatAgentReply({
      agentId: 'agent-pure',
      model: 'gpt-5.4-mini',
      provider: 'purechat',
      userId: 'user-1',
      userText: '你好',
    })

    expect(mocks.assertPureChatCanChat).toHaveBeenCalledWith('user-1', 'gpt-5.4-mini')
    expect(mocks.createPureChatLanguageModel).toHaveBeenCalledWith('gpt-5.4-mini')
  })

  it('surfaces PureChat precheck failures', async () => {
    mocks.findVisibleById.mockResolvedValue({
      id: 'agent-pure',
      model: 'unknown-model',
      provider: 'purechat',
      systemRole: null,
    })
    mocks.assertPureChatCanChat.mockRejectedValueOnce(new Error('该模型在 PureChat 免费套餐中暂不可用，请切换到其他模型。'))

    await expect(
      generateWechatAgentReply({
        agentId: 'agent-pure',
        model: 'unknown-model',
        provider: 'purechat',
        userId: 'user-1',
        userText: '你好',
      })
    ).rejects.toThrow('该模型在 PureChat 免费套餐中暂不可用，请切换到其他模型。')

    expect(mocks.generateText).not.toHaveBeenCalled()
    expect(mocks.chargePureChatGenerateUsage).not.toHaveBeenCalled()
  })

  it('injects an explicit Shanghai date for relative-time questions', () => {
    const instructions = buildWechatRuntimeInstructions(new Date('2026-08-06T04:30:00.000Z'))

    expect(instructions).toContain('2026年8月6日星期四')
    expect(instructions).toContain('Asia/Shanghai')
  })
})
