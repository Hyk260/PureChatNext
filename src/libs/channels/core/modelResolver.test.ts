// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/server/purechat', () => ({ isPureChatRuntimeAvailable: () => true }))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  isSupportedProviderId: (provider: string) => provider === 'openai' || provider === 'deepseek',
  resolveProviderApiKey: () => 'test-key',
}))

import {
  defaultChannelModel,
  isChannelProviderId,
  resolveChannelModelConfig,
} from './modelResolver'

describe('channel model resolver', () => {
  it('uses the explicit provider and model before Agent defaults', () => {
    expect(
      resolveChannelModelConfig({
        agentModel: 'agent-model',
        agentProvider: 'openai',
        model: 'channel-model',
        provider: 'deepseek',
      })
    ).toEqual({ model: 'channel-model', provider: 'deepseek' })
  })

  it('falls back to the Agent configuration and then the provider default', () => {
    expect(resolveChannelModelConfig({ agentModel: 'agent-model', agentProvider: 'openai' })).toEqual({
      model: 'agent-model',
      provider: 'openai',
    })
    expect(resolveChannelModelConfig({ provider: 'deepseek' })).toEqual({
      model: defaultChannelModel('deepseek'),
      provider: 'deepseek',
    })
  })

  it('supports a PureChat fallback for QQ without changing the general default', () => {
    expect(resolveChannelModelConfig({ channelName: 'qq', fallbackProvider: 'purechat' })).toEqual({
      model: defaultChannelModel('purechat'),
      provider: 'purechat',
    })
    expect(resolveChannelModelConfig({ channelName: 'wechat' })).toEqual({
      model: defaultChannelModel('deepseek'),
      provider: 'deepseek',
    })
  })

  it('preserves QQ fallback behavior and supports strict validation for other channels', () => {
    expect(resolveChannelModelConfig({ provider: 'unsupported' })).toEqual({
      model: defaultChannelModel('deepseek'),
      provider: 'deepseek',
    })
    expect(() =>
      resolveChannelModelConfig({
        channelName: 'wechat',
        provider: 'unsupported',
        providerPolicy: 'strict',
      })
    ).toThrow('wechat')
  })

  it('recognizes only providers supported by the channel runtime', () => {
    expect(isChannelProviderId('purechat')).toBe(true)
    expect(isChannelProviderId('openai')).toBe(true)
    expect(isChannelProviderId('anthropic')).toBe(false)
  })
})
