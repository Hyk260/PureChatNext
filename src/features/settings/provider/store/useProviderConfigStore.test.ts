import { describe, expect, it } from 'vitest'

import { mergeProviderConfig, useProviderConfigStore } from './useProviderConfigStore'

describe('PureHub provider config migration', () => {
  it('reconciles a v4-style model list with the current catalog', () => {
    const config = mergeProviderConfig('purehub', {
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

  it('bumps persisted provider settings to version 5', () => {
    expect(useProviderConfigStore.persist.getOptions().version).toBe(5)
  })
})
