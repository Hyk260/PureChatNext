// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toUIMessageStream } from 'ai'
import { DEFAULT_CHAT_ADVANCED_SETTINGS } from '@pure/types'

vi.mock('server-only', () => ({}))
vi.mock('@/server/purechat', async () => ({
  ...(await import('@pure/model-bank')),
  ...(await import('@/server/purechat/period')),
}))

const { assertCanChat, chargeChatUsage, createModel, createOpenAI, generateText, getAuthenticatedUserId, streamText } =
  vi.hoisted(() => {
    const modelFactory = vi.fn((modelId: string) => ({ modelId, provider: 'openai.responses' }))
    return {
      assertCanChat: vi.fn(),
      chargeChatUsage: vi.fn(),
      createModel: modelFactory,
      createOpenAI: vi.fn(() => modelFactory),
      generateText: vi.fn(),
      getAuthenticatedUserId: vi.fn().mockResolvedValue('user-1'),
      streamText: vi.fn(),
    }
  })

vi.mock('@pure/database/models/webSearchSettings', () => ({
  WebSearchSettingsModel: class {
    get = vi.fn().mockResolvedValue({})
  },
}))
vi.mock('@pure/database/models/customProvider', () => ({ isValidProviderId: (id: string) => /^[a-z0-9_-]+$/.test(id) }))

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
  getAuthenticatedUserId,
}))
vi.mock('@/libs/ai-providers/userSecrets', () => ({
  MISSING_USER_PROVIDER_SECRET_MESSAGE: '请先在设置中保存该服务商 API Key',
  resolveUserProviderCredentials: vi.fn(async () => ({ apiKey: 'user-key' })),
}))
vi.mock('@/envs/llm', () => ({
  llmEnv: { PURECHAT_ENABLED: true },
  resolveAiGatewayApiKey: () => 'gateway-test-key',
  resolveAiGatewayBaseURL: () => 'https://ai-gateway.vercel.sh/v1',
}))
vi.mock('@/server/search/chatTool', () => ({
  webSearchTool: { description: 'search tool' },
  createWebSearchTool: () => ({ description: 'search tool' }),
}))
vi.mock('@/server/search/fetchTool', () => ({ createFetchUrlsTool: () => ({ description: 'fetch tool' }) }))
vi.mock('@/server/weather/chatTool', () => ({
  weatherTool: { description: 'weather tool' },
}))
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    createUIMessageStreamResponse: vi.fn(() => new Response(null, { status: 200 })),
    generateText,
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

const createPermissionRequest = (permissionMode: unknown) =>
  new Request('http://localhost/api/chat', {
    body: JSON.stringify({ messages: [], model: 'gpt-5.2', permissionMode, provider: 'purechat' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

const contextHistory = () =>
  Array.from({ length: 8 }, (_, index) => ({
    id: String(index),
    role: index % 2 === 0 ? 'user' : 'assistant',
    parts: [{ type: 'text', text: `message ${index} `.repeat(250) }],
  }))

const createAdvancedRequest = (advancedSettings: unknown, messages = contextHistory(), provider = 'purechat') =>
  new Request('http://localhost/api/chat', {
    body: JSON.stringify({ advancedSettings, messages, model: 'gpt-5.2', modelContextWindow: 6000, provider }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('POST /api/chat PureChat model availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthenticatedUserId.mockResolvedValue('user-1')
    assertCanChat.mockResolvedValue(undefined)
    chargeChatUsage.mockResolvedValue(undefined)
    generateText.mockReset()
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
          fetchUrls: { description: 'fetch tool' },
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
          fetchUrls: { description: 'fetch tool' },
        },
      })
    )
  })

  it('does not expose server-backed search to anonymous BYOK requests', async () => {
    getAuthenticatedUserId.mockResolvedValueOnce(null)
    const response = await POST(createExternalRequest('auto'))

    expect(response.status).toBe(200)
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.not.stringMatching(/webSearch/),
        tools: { getWeather: { description: 'weather tool' } },
      })
    )
  })

  it('rejects anonymous BYOK document attachments before parsing', async () => {
    getAuthenticatedUserId.mockResolvedValueOnce(null)
    const response = await POST(
      new Request('http://localhost/api/chat', {
        body: JSON.stringify({
          messages: [
            {
              id: 'message-1',
              role: 'user',
              parts: [
                {
                  type: 'file',
                  filename: 'invalid.pptx',
                  mediaType: 'image/png',
                  url: 'data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,AA==',
                },
              ],
            },
          ],
          model: 'gpt-custom',
          provider: 'openai',
        }),
        headers: { Authorization: 'Bearer user-key', 'Content-Type': 'application/json' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(401)
    expect(streamText).not.toHaveBeenCalled()
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
    expect(chargeChatUsage).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'web' }))
  })

  it('rejects an invalid search mode before starting generation', async () => {
    const response = await POST(createRequest('gpt-5.2', 'always'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.cause).toBe('Invalid search mode')
    expect(streamText).not.toHaveBeenCalled()
  })

  it('validates advanced settings before authentication or model calls', async () => {
    for (const settings of [
      null,
      { historyCount: -1 },
      { historyCount: 0.5 },
      { historyCount: 1001 },
      { enableContextCompression: 'yes' },
      { inputTemplate: 'lost user input' },
    ]) {
      const response = await POST(createAdvancedRequest(settings))
      expect(response.status).toBe(400)
    }
    expect(getAuthenticatedUserId).not.toHaveBeenCalled()
    expect(generateText).not.toHaveBeenCalled()
    expect(streamText).not.toHaveBeenCalled()
  })

  it('limits context and templates only the current input without changing its source', async () => {
    const source = [
      ...contextHistory(),
      { id: 'current', role: 'user', parts: [{ type: 'text', text: 'original $&' }] },
    ]
    const snapshot = structuredClone(source)
    const response = await POST(
      createAdvancedRequest(
        {
          ...DEFAULT_CHAT_ADVANCED_SETTINGS,
          enableHistoryCount: true,
          historyCount: 0,
          inputTemplate: '翻译：{{text}}',
        },
        source
      )
    )
    expect(response.status).toBe(200)
    expect(streamText.mock.calls[0][0].messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: '翻译：original $&' }] },
    ])
    expect(generateText).not.toHaveBeenCalled()
    expect(source).toEqual(snapshot)
  })

  it('settles summary usage separately from the reply and returns reusable metadata', async () => {
    const summaryUsage = { inputTokenDetails: { cacheReadTokens: 10 }, inputTokens: 100, outputTokens: 20 }
    generateText.mockImplementationOnce(async (options) => {
      await options.onEnd({ usage: summaryUsage })
      return { text: 'retained task facts' }
    })
    const response = await POST(createAdvancedRequest(DEFAULT_CHAT_ADVANCED_SETTINGS))
    expect(response.status).toBe(200)
    expect(generateText).toHaveBeenCalledOnce()
    expect(chargeChatUsage).toHaveBeenCalledOnce()
    expect(chargeChatUsage).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 100, outputTokens: 20 }))
    const metadata = vi.mocked(toUIMessageStream).mock.calls[0][0].messageMetadata?.({ part: { type: 'start' } })
    expect(metadata).toMatchObject({ contextSummary: { text: 'retained task facts', messageCount: 4 } })
    await streamText.mock.calls[0][0].onEnd({ usage: summaryUsage })
    expect(chargeChatUsage).toHaveBeenCalledTimes(2)
    expect(chargeChatUsage.mock.calls[0][0].messageId).not.toBe(chargeChatUsage.mock.calls[1][0].messageId)
  })

  it('compresses self-configured models without charging PureChat credits', async () => {
    generateText.mockResolvedValueOnce({ text: 'retained BYOK task facts' })
    const response = await POST(createAdvancedRequest(DEFAULT_CHAT_ADVANCED_SETTINGS, contextHistory(), 'openai'))
    expect(response.status).toBe(200)
    expect(generateText).toHaveBeenCalledOnce()
    expect(chargeChatUsage).not.toHaveBeenCalled()
    expect(streamText.mock.calls[0][0].messages[0].content).toContain('retained BYOK task facts')
  })

  it('rejects excessive message cardinality before authentication or attachment parsing', async () => {
    const messages = Array.from({ length: 201 }, () => ({ parts: [] }))
    const response = await POST(
      new Request('http://localhost/api/chat', {
        body: JSON.stringify({ messages, model: 'gpt-5.2', provider: 'purechat' }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(400)
    expect(getAuthenticatedUserId).not.toHaveBeenCalled()
    expect(streamText).not.toHaveBeenCalled()
  })

  it('does not parse attachments for unauthenticated PureChat requests', async () => {
    getAuthenticatedUserId.mockResolvedValueOnce(null)
    const response = await POST(
      new Request('http://localhost/api/chat', {
        body: JSON.stringify({
          messages: [
            {
              id: 'message-1',
              role: 'user',
              parts: [
                {
                  type: 'file',
                  filename: 'invalid.pptx',
                  mediaType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                  url: 'data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,AA==',
                },
              ],
            },
          ],
          model: 'gpt-5.2',
          provider: 'purechat',
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
    )

    expect(response.status).toBe(401)
    expect(assertCanChat).not.toHaveBeenCalled()
    expect(streamText).not.toHaveBeenCalled()
  })

  it('accepts valid permission modes and rejects invalid values', async () => {
    const accepted = await POST(createPermissionRequest('full'))
    expect(accepted.status).toBe(200)

    vi.clearAllMocks()
    const rejected = await POST(createPermissionRequest('unsafe'))
    const payload = await rejected.json()

    expect(rejected.status).toBe(400)
    expect(payload.cause).toBe('Invalid permission mode')
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

  it('redacts synchronous public Gateway error details', async () => {
    streamText.mockImplementationOnce(() => {
      throw new Error('https://gateway.example/v1?api_key=super-secret-provider-key')
    })

    const response = await POST(createRequest('gpt-5.2'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.cause).toBe('模型服务暂不可用，请稍后重试。')
    expect(JSON.stringify(payload)).not.toContain('super-secret-provider-key')
  })
})
