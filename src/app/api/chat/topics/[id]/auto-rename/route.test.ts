// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assertPureChatCanChat: vi.fn(),
  chargePureChatGenerateUsage: vi.fn(),
  createProviderLanguageModel: vi.fn(() => ({ modelId: 'test-model' })),
  createPureChatLanguageModel: vi.fn(() => ({ modelId: 'purechat-model' })),
  findById: vi.fn(),
  generateText: vi.fn(),
  getAuthenticatedUserId: vi.fn(),
  listByTopic: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/libs/auth/get-session-user', () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
  jsonError: (message: string, status = 400) => Response.json({ error: message }, { status }),
  withAuth:
    (handler: (request: NextRequest, context: { params: Promise<{ id: string }>; userId: string }) => unknown) =>
    async (request: NextRequest, context?: { params?: Promise<{ id: string }> }) => {
      const userId = await mocks.getAuthenticatedUserId()
      if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })
      return handler(request, {
        params: context?.params ?? Promise.resolve({ id: '' }),
        userId,
      })
    },
}))

vi.mock('@pure/database/models/chatTopic', () => ({
  ChatTopicModel: vi.fn(() => ({ findById: mocks.findById, update: mocks.update })),
}))
vi.mock('@pure/database/models/chatMessage', () => ({
  ChatMessageModel: vi.fn(() => ({ listByTopic: mocks.listByTopic })),
}))
vi.mock('@pure/database/models/credits', () => ({
  FreePlanLimitError: class FreePlanLimitError extends Error {},
}))
vi.mock('ai', () => ({ generateText: mocks.generateText }))
vi.mock('@pure/const', () => ({
  PURECHAT_PROVIDER_ID: 'purechat',
}))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  createProviderLanguageModel: mocks.createProviderLanguageModel,
  isSupportedProviderId: (provider: string) => provider === 'openai' || provider === 'deepseek',
  resolveApiKeyFromHeader: (request: Request) => request.headers.get('authorization')?.replace('Bearer ', ''),
  resolveOptionalBaseURL: (baseURL?: string) => baseURL,
  resolveProviderApiKey: (_provider: string, headerKey?: string) => headerKey,
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

import { normalizeGeneratedTitle, POST } from './route'

const context = { params: Promise.resolve({ id: 'topic-1' }) }
const message = {
  id: 'message-1',
  parts: [{ text: '如何设计标题菜单？', type: 'text' as const }],
  role: 'user' as const,
}

const request = (body: Record<string, unknown>, headers?: Record<string, string>) =>
  new NextRequest('http://localhost/api/chat/topics/topic-1/auto-rename', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json', ...headers },
    method: 'POST',
  })

describe('POST /api/chat/topics/[id]/auto-rename', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAuthenticatedUserId.mockResolvedValue('user-1')
    mocks.findById.mockResolvedValue({ id: 'topic-1', title: '旧标题' })
    mocks.listByTopic.mockResolvedValue([message])
    mocks.generateText.mockResolvedValue({
      text: '“设计会话标题菜单”',
      usage: {
        inputTokenDetails: { cacheReadTokens: undefined, cacheWriteTokens: undefined, noCacheTokens: undefined },
        inputTokens: 10,
        outputTokenDetails: { reasoningTokens: undefined, textTokens: undefined },
        outputTokens: 5,
        totalTokens: 15,
      },
    })
    mocks.update.mockResolvedValue({ id: 'topic-1', title: '设计会话标题菜单' })
    mocks.assertPureChatCanChat.mockResolvedValue({
      settlementId: 'settlement-1',
      settlementPeriod: '2026-07',
    })
  })

  it('requires authentication and topic ownership', async () => {
    mocks.getAuthenticatedUserId.mockResolvedValueOnce(null)
    const unauthorized = await POST(request({ model: 'test', provider: 'deepseek' }), context)
    expect(unauthorized.status).toBe(401)

    mocks.findById.mockResolvedValueOnce(undefined)
    const missing = await POST(request({ model: 'test', provider: 'deepseek' }), context)
    expect(missing.status).toBe(404)
  })

  it('rejects topics without text messages', async () => {
    mocks.listByTopic.mockResolvedValueOnce([])
    const response = await POST(
      request({ model: 'deepseek-chat', provider: 'deepseek' }, { Authorization: 'Bearer test-key' }),
      context
    )

    expect(response.status).toBe(400)
    expect(mocks.generateText).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('generates, normalizes, and saves a BYOK title', async () => {
    const response = await POST(
      request(
        { baseURL: 'https://models.example/v1', model: 'deepseek-chat', provider: 'deepseek' },
        { Authorization: 'Bearer test-key' }
      ),
      context
    )

    expect(response.status).toBe(200)
    expect(mocks.createProviderLanguageModel).toHaveBeenCalledWith(
      'deepseek',
      'deepseek-chat',
      'test-key',
      'https://models.example/v1'
    )
    expect(mocks.update).toHaveBeenCalledWith('topic-1', { title: '设计会话标题菜单' })
  })

  it('checks and charges PureChat usage', async () => {
    const response = await POST(request({ model: 'model-1', provider: 'purechat' }), context)

    expect(response.status).toBe(200)
    expect(mocks.assertPureChatCanChat).toHaveBeenCalledWith('user-1', 'model-1')
    expect(mocks.createPureChatLanguageModel).toHaveBeenCalledWith('model-1')
    expect(mocks.chargePureChatGenerateUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'model-1',
        settlementId: 'settlement-1',
        settlementPeriod: '2026-07',
        userId: 'user-1',
      })
    )
  })
})

describe('normalizeGeneratedTitle', () => {
  it('removes wrappers, keeps one line, and truncates to 30 characters', () => {
    expect(normalizeGeneratedTitle('标题： “简短标题”\n解释')).toBe('简短标题')
    expect(normalizeGeneratedTitle(`“${'长'.repeat(35)}”`)).toBe(`${'长'.repeat(29)}…`)
    expect(normalizeGeneratedTitle('```text\n```')).toBe('')
  })
})
