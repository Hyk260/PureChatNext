import { describe, expect, it } from 'vitest'

import { mergeProviderConfig, useProviderConfigStore } from './useProviderConfigStore'
import type { ProviderConfigs } from '../types'

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

  it('does not restore an interrupted health check as active', () => {
    const config = mergeProviderConfig('purechat', {
      models: [
        {
          displayName: 'GPT 5.4 Mini',
          enabled: true,
          health: { status: 'checking' },
          id: 'gpt-5.4-mini',
          source: 'builtin',
        },
      ],
    })

    expect(config.models[0]?.health).toEqual({ status: 'idle' })
  })

  it('persists model health state without changing model configuration shape', () => {
    useProviderConfigStore.getState().setModelHealth('purechat', 'gpt-5.4-mini', {
      durationMs: 120,
      message: '检查成功',
      status: 'success',
    })

    expect(useProviderConfigStore.getState().configs.purechat.models[0]?.health).toMatchObject({
      durationMs: 120,
      status: 'success',
    })
    expect(useProviderConfigStore.persist.getOptions().version).toBe(9)
  })

  it('does not persist an active health check state', () => {
    useProviderConfigStore.getState().setModelHealth('purechat', 'gpt-5.4-mini', { status: 'checking' })

    const partialized = useProviderConfigStore.persist.getOptions().partialize?.(useProviderConfigStore.getState()) as {
      configs: ProviderConfigs
    }

    expect(partialized.configs.purechat.models[0]?.health).toEqual({ status: 'idle' })
  })
})
