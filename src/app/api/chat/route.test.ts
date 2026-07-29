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
  llmEnv: { PUREHUB_ENABLED: true },
  resolveAiGatewayApiKey: () => 'gateway-test-key',
  resolveAiGatewayBaseURL: () => 'https://ai-gateway.vercel.sh/v1',
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

import { PUREHUB_MODEL_UNAVAILABLE_MESSAGE } from '@/server/purehub/gatewayError'

import { POST } from './route'

const createRequest = (model: string) =>
  new Request('http://localhost/api/chat', {
    body: JSON.stringify({ messages: [], model, provider: 'purehub' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('POST /api/chat PureHub model availability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    assertCanChat.mockResolvedValue(undefined)
    streamText.mockReturnValue({ stream: new ReadableStream() })
  })

  it('rejects a disabled free-tier model before creating the Gateway model', async () => {
    const response = await POST(createRequest('claude-haiku-4-5'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.cause).toBe(PUREHUB_MODEL_UNAVAILABLE_MESSAGE)
    expect(createOpenAI).not.toHaveBeenCalled()
    expect(assertCanChat).not.toHaveBeenCalled()
  })

  it('rejects an unknown PureHub model', async () => {
    const response = await POST(createRequest('not-a-model'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.cause).toContain('Unknown PureHub model')
    expect(createOpenAI).not.toHaveBeenCalled()
  })

  it('resolves an enabled display id to its Gateway id', async () => {
    const response = await POST(createRequest('gpt-5.2'))

    expect(response.status).toBe(200)
    expect(createModel).toHaveBeenCalledWith('openai/gpt-5.2')
    expect(streamText).toHaveBeenCalledOnce()
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
    expect(payload.cause).toBe(PUREHUB_MODEL_UNAVAILABLE_MESSAGE)
  })
})
