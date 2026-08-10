// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAiModel: vi.fn(),
  isPureChatRuntimeAvailable: vi.fn(),
  resolveProviderApiKey: vi.fn(),
}))

vi.mock('@pure/model-bank', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@pure/model-bank')>()
  return {
    ...actual,
    getAiModel: mocks.getAiModel,
  }
})
vi.mock('@/server/purechat', () => ({
  isPureChatRuntimeAvailable: mocks.isPureChatRuntimeAvailable,
}))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  isSupportedProviderId: (provider: string) => provider === 'openai' || provider === 'deepseek',
  resolveProviderApiKey: mocks.resolveProviderApiKey,
}))

import {
  isWechatAgentUsable,
  normalizeWechatAgentProvider,
  resolveWechatAgentModelId,
  wechatAgentUnavailableReason,
  wechatModelSupportsVision,
} from '../agentSupport'

describe('wechat agentSupport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isPureChatRuntimeAvailable.mockReturnValue(true)
    mocks.resolveProviderApiKey.mockImplementation((provider: string) =>
      provider === 'openai' || provider === 'deepseek' ? `${provider}-key` : undefined
    )
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

  it('marks purechat usable only when runtime is available', () => {
    expect(isWechatAgentUsable('purechat')).toBe(true)
    mocks.isPureChatRuntimeAvailable.mockReturnValue(false)
    expect(isWechatAgentUsable('purechat')).toBe(false)
    expect(wechatAgentUnavailableReason('purechat')).toBe('服务器未启用 PureChat 或未配置 AI Gateway 密钥')
  })

  it('rejects unsupported providers on bind', () => {
    expect(wechatAgentUnavailableReason('anthropic')).toBe('该 Agent 的 Provider 不支持微信渠道')
    expect(wechatAgentUnavailableReason('purechat')).toBeNull()
    expect(wechatAgentUnavailableReason('openai')).toBeNull()
  })

  it('checks vision ability by model card', () => {
    expect(wechatModelSupportsVision('purechat', 'gpt-5.4-mini')).toBe(true)
    mocks.getAiModel.mockReturnValueOnce({ abilities: { vision: false } })
    expect(wechatModelSupportsVision('deepseek', 'deepseek-v4-flash')).toBe(false)
    mocks.getAiModel.mockReturnValueOnce(undefined)
    expect(wechatModelSupportsVision('openai', 'custom-no-card')).toBe(false)
  })
})
