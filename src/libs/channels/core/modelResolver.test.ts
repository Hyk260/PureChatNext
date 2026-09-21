// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/server/purechat', () => ({ isPureChatRuntimeAvailable: () => true }))
vi.mock('@/libs/ai-providers/resolveClient', () => ({
  isSupportedProviderId: (provider: string) => provider === 'openai' || provider === 'deepseek',
}))
vi.mock('@pure/database/models/userProviderSecret', () => ({
  UserProviderSecretModel: class {
    has = mocks.hasSecret
  },
}))

const mocks = vi.hoisted(() => ({
  hasSecret: vi.fn(),
}))

import {
  channelProviderByokUnavailableReason,
  defaultChannelModel,
  isChannelProviderId,
  resolveChannelModelConfig,
} from './modelResolver'

describe('channel model resolver', () => {
  beforeEach(() => {
    mocks.hasSecret.mockReset()
    mocks.hasSecret.mockResolvedValue(true)
  })

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

  it('remaps catalog-disabled models to the provider default', () => {
    expect(resolveChannelModelConfig({ model: 'gpt-5.4-mini', provider: 'openai' })).toEqual({
      model: defaultChannelModel('openai'),
      provider: 'openai',
    })
    expect(resolveChannelModelConfig({ model: 'minimax-m3', provider: 'purechat' })).toEqual({
      model: defaultChannelModel('purechat'),
      provider: 'purechat',
    })
  })

  it('recognizes only providers supported by the channel runtime', () => {
    expect(isChannelProviderId('purechat')).toBe(true)
    expect(isChannelProviderId('openai')).toBe(true)
    expect(isChannelProviderId('anthropic')).toBe(false)
  })

  it('requires a saved user vault key for BYOK channel providers', async () => {
    mocks.hasSecret.mockResolvedValue(false)
    await expect(channelProviderByokUnavailableReason('user-1', 'deepseek', '微信渠道')).resolves.toBe(
      '请先在设置中保存该服务商 API Key'
    )
  })

  it('allows BYOK when the user vault already has a key', async () => {
    await expect(channelProviderByokUnavailableReason('user-1', 'openai')).resolves.toBeNull()
  })
})
