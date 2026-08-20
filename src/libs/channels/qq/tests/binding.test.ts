// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/purechat', () => ({
  isPureChatRuntimeAvailable: () => true,
}))

vi.mock('@/libs/ai-providers/resolveClient', () => ({
  isSupportedProviderId: (provider: string) => provider === 'openai' || provider === 'deepseek',
  resolveProviderApiKey: (provider: string) => (provider === 'deepseek' ? undefined : 'test-key'),
}))

vi.mock('@pure/chat-adapter/qq', () => ({ QQApiClient: class {} }))
vi.mock('@pure/database/models/agent', () => ({ AgentModel: class {} }))
vi.mock('@pure/database/models/channelBinding', () => ({ ChannelBindingModel: class {}, QQ_PLATFORM: 'qq' }))
vi.mock('../chatBot', () => ({ invalidateQQChat: vi.fn() }))
vi.mock('../encrypt', () => ({}))

import { resolveQQChannelModel } from '../binding'

describe('QQ channel model binding', () => {
  it('defaults a new binding to PureChat instead of the Agent provider', () => {
    expect(resolveQQChannelModel({})).toEqual({
      model: 'gpt-5.4-mini',
      provider: 'purechat',
    })
  })

  it('preserves the existing provider when reconnecting', () => {
    expect(resolveQQChannelModel({ previousModel: 'gpt-5.4-mini', previousProvider: 'openai' })).toEqual({
      model: 'gpt-5.4-mini',
      provider: 'openai',
    })
  })

  it('keeps explicit DeepSeek selection strict', () => {
    expect(() => resolveQQChannelModel({ model: 'deepseek-v4-flash', provider: 'deepseek' })).toThrow(
      '服务器未配置 deepseek 渠道密钥'
    )
  })
})
