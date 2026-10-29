import { describe, expect, it } from 'vitest'

import type { ProviderModelItem } from '../../../types'
import { applyModelCatalogSelection } from '../modelCatalog'

describe('applyModelCatalogSelection', () => {
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
