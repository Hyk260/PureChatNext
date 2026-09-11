// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/purechat', () => ({
  isPureChatRuntimeAvailable: () => true,
}))
vi.mock('@pure/database/models/userProviderSecret', () => ({
  UserProviderSecretModel: class {},
}))

vi.mock('@pure/chat-adapter/qq', () => ({ QQApiClient: class {} }))
vi.mock('@pure/database/models/agent', () => ({ AgentModel: class {} }))
vi.mock('@pure/database/models/channelBinding', () => ({ ChannelBindingModel: class {}, QQ_PLATFORM: 'qq' }))
vi.mock('../chatBot', () => ({ invalidateQQChat: vi.fn() }))
vi.mock('../encrypt', () => ({}))

import { resolveQQChannelModel } from '../binding'

describe('QQ channel model binding', () => {
  it('defaults a new binding to DeepSeek instead of the Agent provider', () => {
    expect(resolveQQChannelModel({})).toEqual({
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    })
  })

  it('preserves the existing provider when reconnecting', () => {
    expect(resolveQQChannelModel({ previousModel: 'gpt-5.4-mini', previousProvider: 'openai' })).toEqual({
      model: 'gpt-5.4-mini',
      provider: 'openai',
    })
  })

  it('keeps an explicit DeepSeek selection without consulting env keys', () => {
    expect(resolveQQChannelModel({ model: 'deepseek-v4-flash', provider: 'deepseek' })).toEqual({
      model: 'deepseek-v4-flash',
      provider: 'deepseek',
    })
  })
})
