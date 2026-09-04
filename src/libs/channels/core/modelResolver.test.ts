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
  it('uses the explicit channel provider and model', () => {
    expect(
      resolveChannelModelConfig({
        model: 'channel-model',
        provider: 'deepseek',
      })
    ).toEqual({ model: 'channel-model', provider: 'deepseek' })
  })

  it('falls back to the provider default when the channel has no model', () => {
    expect(resolveChannelModelConfig({ provider: 'deepseek' })).toEqual({
      model: defaultChannelModel('deepseek'),
      provider: 'deepseek',
    })
  })

  it('defaults QQ and WeChat to DeepSeek when no provider is set', () => {
    expect(resolveChannelModelConfig({ channelName: 'qq', fallbackProvider: 'deepseek' })).toEqual({
      model: defaultChannelModel('deepseek'),
      provider: 'deepseek',
    })
    expect(resolveChannelModelConfig({ channelName: 'wechat' })).toEqual({
      model: defaultChannelModel('deepseek'),
      provider: 'deepseek',
    })
  })

  it('falls back when the channel provider is unknown', () => {
    expect(resolveChannelModelConfig({ provider: 'unsupported' })).toEqual({
      model: defaultChannelModel('deepseek'),
      provider: 'deepseek',
    })
  })

  it('recognizes only providers supported by the channel runtime', () => {
    expect(isChannelProviderId('purechat')).toBe(true)
    expect(isChannelProviderId('openai')).toBe(true)
    expect(isChannelProviderId('anthropic')).toBe(false)
  })
})
