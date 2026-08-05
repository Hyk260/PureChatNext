import { describe, expect, it } from 'vitest'

import { mergeProviderConfig, useProviderConfigStore } from './useProviderConfigStore'

describe('PureChat provider config migration', () => {
  it('reconciles a v4-style model list with the current catalog', () => {
    const config = mergeProviderConfig('purechat', {
      models: [
        {
          displayName: 'GPT 5.5',
          enabled: true,
          id: 'gpt-5.5',
          source: 'builtin',
        },
        {
          displayName: 'GPT-5 nano',
          enabled: false,
          id: 'gpt-5-nano',
          source: 'builtin',
        },
      ],
    })

    expect(config.models.find((model) => model.id === 'gpt-5.5')?.enabled).toBe(false)
    expect(config.models.find((model) => model.id === 'gpt-5.2')?.enabled).toBe(true)
    expect(config.models.find((model) => model.id === 'gpt-5-nano')?.enabled).toBe(false)
  })

  it('keeps PureChat enabled even when persisted as disabled', () => {
    const config = mergeProviderConfig('purechat', { enabled: false })
    expect(config.enabled).toBe(true)
  })

  it('bumps persisted provider settings to version 7', () => {
    expect(useProviderConfigStore.persist.getOptions().version).toBe(7)
  })
})
