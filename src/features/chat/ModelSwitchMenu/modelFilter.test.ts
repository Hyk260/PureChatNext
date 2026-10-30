import { describe, expect, it } from 'vitest'

import { hasExcludedModelAbilities, hasRequiredModelAbility, withNativeTTSAbility } from './modelFilter'

describe('model capability filtering', () => {
  it('requires an explicit TTS marker instead of treating generic audio output as speech synthesis', () => {
    expect(
      hasRequiredModelAbility(
        { abilities: { audioOutput: true }, displayName: 'Audio output', model: 'audio', provider: 'local' },
        'textToSpeech'
      )
    ).toBe(false)
    expect(
      hasRequiredModelAbility(
        { abilities: { textToSpeech: true }, displayName: 'Speech', model: 'speech', provider: 'local' },
        'textToSpeech'
      )
    ).toBe(true)
  })

  it('can hide TTS-only models from text-generation model pickers', () => {
    expect(
      hasExcludedModelAbilities(
        { displayName: 'Breeze TTS', model: 'breeze-tts-2', provider: 'custom', abilities: { textToSpeech: true } },
        ['textToSpeech']
      )
    ).toBe(false)
    expect(
      hasExcludedModelAbilities(
        { displayName: 'Chat model', model: 'chat-model', provider: 'openai', abilities: { functionCall: true } },
        ['textToSpeech']
      )
    ).toBe(true)
  })

  it('marks supported native TTS models without adding unconfigured or disabled models', () => {
    expect(withNativeTTSAbility('bailian', 'qwen-audio-3.1-tts-flash')).toEqual({ textToSpeech: true })
    expect(withNativeTTSAbility('bailian', 'qwen-audio-3.0-tts-flash')).toEqual({ textToSpeech: true })
    expect(
      hasExcludedModelAbilities(
        {
          abilities: withNativeTTSAbility('bailian', 'qwen-audio-3.0-tts-flash'),
          displayName: 'Qwen Audio TTS',
          model: 'qwen-audio-3.0-tts-flash',
          provider: 'bailian',
        },
        ['textToSpeech']
      )
    ).toBe(false)
    const configuredModels = [
      { enabled: false, id: 'qwen-audio-3.0-tts-flash' },
      { enabled: true, id: 'qwen-audio-3.1-tts-flash' },
    ]
    const listedModels = configuredModels
      .filter(({ enabled }) => enabled)
      .filter(({ id }) =>
        hasRequiredModelAbility(
          {
            abilities: withNativeTTSAbility('bailian', id),
            displayName: id,
            model: id,
            provider: 'bailian',
          },
          'textToSpeech'
        )
      )
    expect(listedModels.map(({ id }) => id)).toEqual(['qwen-audio-3.1-tts-flash'])
  })
})
