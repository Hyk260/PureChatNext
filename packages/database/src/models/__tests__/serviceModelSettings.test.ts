import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('../../core/db-adaptor', () => ({ getServerDB: vi.fn() }))

import { mergeServiceModelSettings } from '../serviceModelSettings'

describe('service model settings', () => {
  it('saves fields sparsely and clears only the selected override', () => {
    expect(
      mergeServiceModelSettings(
        {
          topicNaming: { model: 'model-a', provider: 'deepseek' },
          historyCompression: { model: 'model-b', provider: 'openai' },
          qqSpeech: { model: 'speech-model', provider: 'lmstudio' },
        },
        { topicNaming: null }
      )
    ).toEqual({
      historyCompression: { model: 'model-b', provider: 'openai' },
      qqSpeech: { model: 'speech-model', provider: 'lmstudio' },
    })
  })

  it('keeps unrelated model selections when a single field changes', () => {
    expect(
      mergeServiceModelSettings(
        { topicNaming: { model: 'model-a', provider: 'deepseek' } },
        { historyCompression: { model: 'model-b', provider: 'openai', contextWindowTokens: 32_000 } }
      )
    ).toEqual({
      topicNaming: { model: 'model-a', provider: 'deepseek' },
      historyCompression: { model: 'model-b', provider: 'openai', contextWindowTokens: 32_000 },
    })
  })
})
