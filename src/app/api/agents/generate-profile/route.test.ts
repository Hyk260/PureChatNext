// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assertPureChatCanChat: vi.fn(),
  chargePureChatGenerateUsage: vi.fn(),
  createProviderLanguageModel: vi.fn(() => ({ modelId: 'deepseek-v4-flash' })),
  createPureChatLanguageModel: vi.fn(() => ({ modelId: 'purechat-model' })),
  generateText: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  getEnabledPureChatModel: vi.fn(),
  resolveUserProviderCredentials: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { params: Promise<Record<string, string>>; userId: string }) => unknown) =>
    async (request: NextRequest) => {
      const userId = await mocks.getAuthenticatedUserId()
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      return handler(request, { params: Promise.resolve({}), userId })
    },
}))

vi.mock('ai', () => ({ generateText: mocks.generateText }))
vi.mock('@pure/model-bank', () => ({
  PURECHAT_DEFAULT_MODEL: 'gpt-5.4-mini',
  getEnabledPureChatModel: mocks.getEnabledPureChatModel,
}))
vi.mock('@pure/database/models/credits', () => ({
  FreePlanLimitError: class FreePlanLimitError extends Error {},
}))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  createProviderLanguageModel: mocks.createProviderLanguageModel,
  resolveApiKeyFromHeader: (request: Request) => request.headers.get('authorization')?.replace('Bearer ', ''),
}))
vi.mock('@/libs/ai-providers/userSecrets', () => ({
  MISSING_USER_PROVIDER_SECRET_MESSAGE: '请先在设置中保存该服务商 API Key',
  resolveUserProviderCredentials: mocks.resolveUserProviderCredentials,
}))
vi.mock('@/server/purechat', () => ({
  assertPureChatCanChat: mocks.assertPureChatCanChat,
  chargePureChatGenerateUsage: mocks.chargePureChatGenerateUsage,
  createPureChatLanguageModel: mocks.createPureChatLanguageModel,
}))
vi.mock('@/server/purechat/gatewayError', () => ({
  isPureChatRestrictedModelError: () => false,
  PURECHAT_MODEL_UNAVAILABLE_MESSAGE: '模型不可用',
}))

import { parseGeneratedAgentProfile, POST } from './route'

const request = (body: Record<string, unknown>, headers?: Record<string, string>) =>
  new NextRequest('http://localhost/api/agents/generate-profile', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
    method: 'POST',
  })

describe('parseGeneratedAgentProfile', () => {
  it('reads fenced JSON and drops empty questions', () => {
    expect(
      parseGeneratedAgentProfile(`
\`\`\`json
{"openingMessage":" 你好 ","openingQuestions":["问什么","","再问","第四"]}
\`\`\`
`)
    ).toEqual({
      openingMessage: '你好',
      openingQuestions: ['问什么', '再问', '第四'],
    })
  })

  it('returns null when message or questions are missing', () => {
    expect(parseGeneratedAgentProfile('not json')).toBeNull()
    expect(parseGeneratedAgentProfile('{"openingMessage":"","openingQuestions":["hi"]}')).toBeNull()
    expect(parseGeneratedAgentProfile('{"openingMessage":"hi","openingQuestions":[]}')).toBeNull()
  })

  it('skips earlier braces in thinking text', () => {
    expect(
      parseGeneratedAgentProfile('先想 {草稿} 再输出 {"openingMessage":"你好","openingQuestions":["开始"]}')
    ).toEqual({
      openingMessage: '你好',
      openingQuestions: ['开始'],
    })
  })
})

describe('POST /api/agents/generate-profile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthenticatedUserId.mockResolvedValue('user-1')
    mocks.resolveUserProviderCredentials.mockResolvedValue({ apiKey: 'sk-test' })
    mocks.getEnabledPureChatModel.mockReturnValue(undefined)
    mocks.assertPureChatCanChat.mockResolvedValue({
      settlementId: 'settlement-1',
      settlementPeriod: '2026-09',
    })
    mocks.generateText.mockResolvedValue({
      reasoningText: '',
      text: '{"openingMessage":"你好，我是写作助手。","openingQuestions":["帮我列提纲","润色这段"]}',
      usage: { inputTokenDetails: {}, inputTokens: 10, outputTokens: 5 },
    })
  })

  it('requires authentication and a description', async () => {
    mocks.getAuthenticatedUserId.mockResolvedValueOnce(null)
    const unauthorized = await POST(request({ description: '写作助手' }))
    expect(unauthorized.status).toBe(401)

    const missing = await POST(request({ title: '写作助手', description: '  ' }))
    expect(missing.status).toBe(400)
    expect(mocks.generateText).not.toHaveBeenCalled()
  })

  it('falls back to PureChat when DeepSeek is not configured', async () => {
    mocks.resolveUserProviderCredentials.mockResolvedValueOnce(null)
    const response = await POST(request({ description: '本地写作助手' }))

    expect(response.status).toBe(200)
    expect(mocks.assertPureChatCanChat).toHaveBeenCalledWith('user-1', 'gpt-5.4-mini')
    expect(mocks.createPureChatLanguageModel).toHaveBeenCalledWith('gpt-5.4-mini')
    expect(mocks.chargePureChatGenerateUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.4-mini',
        settlementId: 'settlement-1',
        userId: 'user-1',
      })
    )
  })

  it('generates opening fields with deepseek-v4-flash', async () => {
    const response = await POST(request({ description: '本地写作助手', title: '写作助手' }))

    expect(response.status).toBe(200)
    expect(mocks.createProviderLanguageModel).toHaveBeenCalledWith(
      'deepseek',
      'deepseek-v4-flash',
      'sk-test',
      undefined
    )
    expect(mocks.assertPureChatCanChat).not.toHaveBeenCalled()
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { modelId: 'deepseek-v4-flash' },
        prompt: '名称：写作助手\n描述：本地写作助手',
      })
    )
    expect(mocks.generateText.mock.calls[0]?.[0]).not.toHaveProperty('reasoning')
    await expect(response.json()).resolves.toEqual({
      openingMessage: '你好，我是写作助手。',
      openingQuestions: ['帮我列提纲', '润色这段'],
    })
  })

  it('parses JSON from reasoning text when the final answer is empty', async () => {
    mocks.generateText.mockResolvedValueOnce({
      reasoningText: '思考后输出 {"openingMessage":"欢迎","openingQuestions":["先写提纲"]}',
      text: '',
    })

    const response = await POST(request({ description: '本地写作助手' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      openingMessage: '欢迎',
      openingQuestions: ['先写提纲'],
    })
  })
})
