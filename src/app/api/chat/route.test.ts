// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { assertCanChat, chargeChatUsage, createModel, createOpenAI, streamText } = vi.hoisted(() => {
  const modelFactory = vi.fn((modelId: string) => ({ modelId, provider: 'openai.responses' }))
  return {
    assertCanChat: vi.fn(),
    chargeChatUsage: vi.fn(),
    createModel: modelFactory,
    createOpenAI: vi.fn(() => modelFactory),
    streamText: vi.fn(),
  }
})

vi.mock('@ai-sdk/openai', () => ({ createOpenAI }))
vi.mock('@ai-sdk/deepseek', () => ({ createDeepSeek: vi.fn() }))
vi.mock('@pure/database/models/credits', () => ({
  CreditsModel: class {
    assertCanChat = assertCanChat
    chargeChatUsage = chargeChatUsage
  },
  FreePlanLimitError: class extends Error {},
}))
vi.mock('@/libs/auth/get-session-user', () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue('user-1'),
}))
vi.mock('@/envs/llm', () => ({
  llmEnv: { PURECHAT_ENABLED: true },
  resolveAiGatewayApiKey: () => 'gateway-test-key',
  resolveAiGatewayBaseURL: () => 'https://ai-gateway.vercel.sh/v1',
}))
vi.mock('@/server/search/chatTool', () => ({
  webSearchTool: { description: 'search tool' },
}))
vi.mock('@/server/weather/chatTool', () => ({
  weatherTool: { description: 'weather tool' },
}))
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    convertToModelMessages: vi.fn().mockResolvedValue([]),
    createUIMessageStreamResponse: vi.fn(() => new Response(null, { status: 200 })),
    streamText,
    toUIMessageStream: vi.fn(() => new ReadableStream()),
  }
})

import { PURECHAT_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purechat/gatewayError'

import { POST } from './route'

const createRequest = (model: string, searchMode?: unknown) =>
  new Request('http://localhost/api/chat', {
    body: JSON.stringify({
      messages: [],
      model,
      provider: 'purechat',
      ...(searchMode === undefined ? {} : { searchMode }),
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

const createExternalRequest = (searchMode: 'auto' | 'off') =>
  new Request('http://localhost/api/chat', {
    body: JSON.stringify({ messages: [], model: 'gpt-custom', provider: 'openai', searchMode }),
    headers: { Authorization: 'Bearer user-key', 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('POST /api/chat PureChat model availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assertCanChat.mockResolvedValue(undefined)
    chargeChatUsage.mockResolvedValue(undefined)
    streamText.mockReturnValue({ stream: new ReadableStream() })
  })

  it('rejects a disabled free-tier model before creating the Gateway model', async () => {
    const response = await POST(createRequest('claude-haiku-4-5'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.cause).toBe(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)
    expect(createOpenAI).not.toHaveBeenCalled()
    expect(assertCanChat).not.toHaveBeenCalled()
  })

  it('rejects an unknown PureChat model', async () => {
    const response = await POST(createRequest('not-a-model'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.cause).toContain('Unknown PureChat model')
    expect(createOpenAI).not.toHaveBeenCalled()
  })

  it('resolves an enabled display id to its Gateway id', async () => {
    const response = await POST(createRequest('gpt-5.2'))

    expect(response.status).toBe(200)
    expect(createModel).toHaveBeenCalledWith('openai/gpt-5.2')
    expect(streamText).toHaveBeenCalledOnce()
  })

  it('keeps weather available and injects the current time when web search is off', async () => {
    await POST(createRequest('gpt-5.2'))
    await POST(createRequest('gpt-5.2', 'off'))

    expect(streamText).toHaveBeenCalledTimes(2)
    for (const [options] of streamText.mock.calls) {
      expect(options).toEqual(
        expect.objectContaining({
          instructions: expect.stringMatching(/当前日期与时间：[\s\S]*Asia\/Shanghai[\s\S]*getWeather/),
          stopWhen: expect.any(Function),
          tools: { getWeather: { description: 'weather tool' } },
        })
      )
    }
  })

  it('exposes the web search tool with a bounded step count in auto mode', async () => {
    const response = await POST(createRequest('gpt-5.2', 'auto'))

    expect(response.status).toBe(200)
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        stopWhen: expect.any(Function),
        tools: {
          getWeather: { description: 'weather tool' },
          webSearch: { description: 'search tool' },
        },
      })
    )
  })

  it('uses the same web search tool for self-configured providers', async () => {
    const response = await POST(createExternalRequest('auto'))

    expect(response.status).toBe(200)
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        stopWhen: expect.any(Function),
        tools: {
          getWeather: { description: 'weather tool' },
          webSearch: { description: 'search tool' },
        },
      })
    )
  })

  it('settles a multi-step PureChat stream through one onEnd callback', async () => {
    await POST(createRequest('gpt-5.2', 'auto'))

    const options = streamText.mock.calls[0][0]
    await options.onEnd({
      usage: {
        inputTokenDetails: { cacheReadTokens: 10 },
        inputTokens: 100,
        outputTokens: 50,
      },
    })

    expect(chargeChatUsage).toHaveBeenCalledOnce()
  })

  it('rejects an invalid search mode before starting generation', async () => {
    const response = await POST(createRequest('gpt-5.2', 'always'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.cause).toBe('Invalid search mode')
    expect(streamText).not.toHaveBeenCalled()
  })

  it('maps a synchronous Gateway restricted-model error to a friendly response', async () => {
    streamText.mockImplementationOnce(() => {
      throw Object.assign(new Error('Free tier users do not have access to this model.'), {
        responseBody: '{"error":{"type":"no_providers_available"}}',
        statusCode: 403,
      })
    })

    const response = await POST(createRequest('gpt-5.2'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.cause).toBe(PURECHAT_MODEL_UNAVAILABLE_MESSAGE)
  })
})
