import { describe, expect, it } from 'vitest'

import type { ProviderModelItem } from '../../../types'
import {
  applyModelCatalogSelection,
  filterModelCatalog,
  isAudioCatalogModel,
  isFreeCatalogModel,
  isImageCatalogModel,
  isReasoningCatalogModel,
} from '../modelCatalog'

describe('model catalog categories', () => {
  it('keeps audio capable text conversation models in the chat category', () => {
    const model = {
      abilities: { audioInput: true },
      displayName: 'Audio capable chat',
      id: 'audio-chat',
      inputModalities: ['text', 'audio'],
      outputModalities: ['text'],
    }

    expect(isAudioCatalogModel(model)).toBe(false)
    expect(filterModelCatalog([model], '', 'chat')).toEqual([model])
  })

  it('classifies explicitly audio only models separately and keeps unknown modality models in chat', () => {
    const audioOnly = {
      abilities: { audioInput: true },
      displayName: 'Audio only',
      id: 'audio-only',
      inputModalities: ['audio'],
      outputModalities: ['text'],
    }
    const unknown = { abilities: { audioInput: true }, displayName: 'Unknown', id: 'unknown' }

    expect(filterModelCatalog([audioOnly, unknown], '', 'audio')).toEqual([audioOnly])
    expect(filterModelCatalog([audioOnly, unknown], '', 'chat')).toEqual([unknown])
  })

  it('filters free, reasoning, and image models by explicit metadata', () => {
    const freeReasoning = {
      abilities: { reasoning: true },
      displayName: 'Free reasoning',
      id: 'free-reasoning',
      pricing: { inputPerMillion: 0, outputPerMillion: 0 },
    }
    const image = {
      abilities: { imageGeneration: true },
      displayName: 'Image generation',
      id: 'image-generation',
      pricing: { inputPerMillion: 1, outputPerMillion: 2 },
    }
    const unknownPrice = { displayName: 'Unknown price', id: 'unknown-price' }
    const models = [freeReasoning, image, unknownPrice]

    expect(isFreeCatalogModel(freeReasoning)).toBe(true)
    expect(isFreeCatalogModel(unknownPrice)).toBe(false)
    expect(isReasoningCatalogModel(freeReasoning)).toBe(true)
    expect(isImageCatalogModel(image)).toBe(true)
    expect(filterModelCatalog(models, '', 'free')).toEqual([freeReasoning])
    expect(filterModelCatalog(models, '', 'reasoning')).toEqual([freeReasoning])
    expect(filterModelCatalog(models, '', 'image')).toEqual([image])
  })
})

describe('applyModelCatalogSelection', () => {
  it('preserves the explicit TTS marker when generic catalog metadata refreshes', () => {
    const saved = applyModelCatalogSelection(
      [{ abilities: { textToSpeech: true }, displayName: 'Speech', enabled: true, id: 'speech', source: 'remote' }],
      [{ abilities: { audioOutput: true }, displayName: 'Speech', id: 'speech' }],
      new Set(['speech'])
    )

    expect(saved[0]?.abilities).toEqual({ audioOutput: true, textToSpeech: true })
  })

  it('applies selected and deselected states without mutating the current configuration', () => {
    const current: ProviderModelItem[] = [
      { displayName: 'First', enabled: true, id: 'first', source: 'builtin' },
      { displayName: 'Second', enabled: false, id: 'second', source: 'builtin' },
    ]
    const original = structuredClone(current)

    const saved = applyModelCatalogSelection(
      current,
      [
        { displayName: 'First', id: 'first' },
        { displayName: 'Second', id: 'second' },
      ],
      new Set(['second'])
    )

    expect(saved.map(({ id, enabled }) => ({ id, enabled }))).toEqual([
      { enabled: false, id: 'first' },
      { enabled: true, id: 'second' },
    ])
    expect(current).toEqual(original)
  })

  it('adds only selected new models and carries their capability metadata', () => {
    const saved = applyModelCatalogSelection(
      [],
      [
        { abilities: { vision: true }, contextWindowTokens: 128_000, displayName: 'Selected', id: 'selected' },
        { displayName: 'Unselected', id: 'unselected' },
      ],
      new Set(['selected'])
    )

    expect(saved).toEqual([
      {
        abilities: { vision: true },
        contextWindowTokens: 128_000,
        displayName: 'Selected',
        enabled: true,
        id: 'selected',
        source: 'remote',
      },
    ])
  })

  it('preserves models outside the catalog and existing custom names and health results', () => {
    const custom: ProviderModelItem = {
      displayName: 'My custom name',
      enabled: true,
      health: { durationMs: 120, status: 'success' },
      id: 'custom',
      source: 'custom',
    }
    const outside: ProviderModelItem = {
      displayName: 'Outside',
      enabled: true,
      id: 'outside',
      source: 'remote',
    }

    const saved = applyModelCatalogSelection(
      [custom, outside],
      [{ displayName: 'Provider name', id: 'custom' }],
      new Set()
    )

    expect(saved[0]).toMatchObject({ ...custom, enabled: false })
    expect(saved[1]).toBe(outside)
  })
})
