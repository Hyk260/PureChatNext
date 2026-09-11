// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAiModel: vi.fn(),
}))

vi.mock('@pure/model-bank', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pure/model-bank')>()
  return {
    ...actual,
    getAiModel: mocks.getAiModel,
  }
})
vi.mock('@/server/purechat', () => ({
  isPureChatRuntimeAvailable: vi.fn(() => true),
}))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  isSupportedProviderId: (provider: string) => provider === 'openai' || provider === 'deepseek',
}))
vi.mock('@pure/database/models/userProviderSecret', () => ({
  UserProviderSecretModel: class {},
}))

import {
  normalizeWechatAgentProvider,
  resolveWechatAgentModelId,
  wechatModelSupportsVision,
} from '../agentSupport'

describe('wechat agentSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAiModel.mockReturnValue({ abilities: { vision: true } })
  })

  it('defaults empty provider to deepseek', () => {
    expect(normalizeWechatAgentProvider(null)).toBe('deepseek')
    expect(normalizeWechatAgentProvider('  ')).toBe('deepseek')
    expect(normalizeWechatAgentProvider('openai')).toBe('openai')
  })

  it('resolves default model ids per provider', () => {
    expect(resolveWechatAgentModelId('purechat', null)).toBe('gpt-5.4-mini')
    expect(resolveWechatAgentModelId('openai', undefined)).toBe('gpt-5.4-mini')
    expect(resolveWechatAgentModelId('deepseek', '')).toBe('deepseek-v4-flash')
    expect(resolveWechatAgentModelId('purechat', 'claude-sonnet-4-6')).toBe('claude-sonnet-4-6')
  })

  it('checks vision ability by model card', () => {
    expect(wechatModelSupportsVision('purechat', 'gpt-5.4-mini')).toBe(true)
    mocks.getAiModel.mockReturnValueOnce({ abilities: { vision: false } })
    expect(wechatModelSupportsVision('deepseek', 'deepseek-v4-flash')).toBe(false)
    mocks.getAiModel.mockReturnValueOnce(undefined)
    expect(wechatModelSupportsVision('openai', 'custom-no-card')).toBe(false)
  })
})
