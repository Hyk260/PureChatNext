import { describe, expect, it } from 'vitest'

import { BUILTIN_PROVIDER_ID_LIST, isBuiltinProviderId, isValidProviderId, ModelProvider } from '@pure/const'

import { ModelProvider as CompatibleModelProvider } from './const/modelProvider'
import { PURECHAT_DEFAULT_MODEL } from './aiModels/purechat'
import { PROVIDER_DEFAULT_MODELS } from './providerDefaults'

describe('provider definitions', () => {
  it('preserves enum identity, provider order and default models', () => {
    expect(CompatibleModelProvider).toBe(ModelProvider)
    expect(BUILTIN_PROVIDER_ID_LIST).toEqual(['purechat', 'openai', 'deepseek', 'bailian', 'openrouter', 'lmstudio'])
    expect(PROVIDER_DEFAULT_MODELS).toEqual({
      bailian: 'qwen3.8-max',
      deepseek: 'deepseek-v4-flash',
      lmstudio: '',
      openai: 'gpt-5.4-nano',
      openrouter: '',
      purechat: PURECHAT_DEFAULT_MODEL,
    })
  })

  it('distinguishes builtin IDs from valid custom IDs', () => {
    expect(isBuiltinProviderId('openai')).toBe(true)
    expect(isBuiltinProviderId('custom')).toBe(false)
    expect(isValidProviderId('custom-provider_1')).toBe(true)
    expect(isValidProviderId('a'.repeat(32))).toBe(true)
    for (const id of ['__proto__', 'prototype', 'constructor', 'UPPER', '-start', '', 'a'.repeat(33)]) {
      expect(isValidProviderId(id)).toBe(false)
    }
  })
})
