import { describe, expect, it } from 'vitest'

import { buildListItems } from './useBuildListItems'
import type { EnabledProviderGroup } from './types'

const providers: EnabledProviderGroup[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    models: [
      { displayName: 'GPT 5.4 Mini', model: 'gpt-5.4-mini', provider: 'openai' },
      { displayName: 'GPT 5.5', model: 'gpt-5.5', provider: 'openai' },
    ],
  },
  {
    id: 'purehub',
    name: 'PureHub',
    models: [
      { displayName: 'GPT 5.4 Mini', model: 'gpt-5.4-mini', provider: 'purehub' },
      { displayName: 'DeepSeek V4 Flash', model: 'deepseek-v4-flash', provider: 'purehub' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [{ displayName: 'DeepSeek V4 Flash', model: 'deepseek-v4-flash', provider: 'deepseek' }],
  },
]

describe('buildListItems', () => {
  it('returns no-provider when empty', () => {
    expect(buildListItems([], 'byModel')).toEqual([{ type: 'no-provider' }])
  })

  it('aggregates by model id and prefers purehub', () => {
    const items = buildListItems(providers, 'byModel')
    const mini = items.find(
      (item) =>
        (item.type === 'model-item-multiple' || item.type === 'model-item-single') && item.data.model === 'gpt-5.4-mini'
    )

    expect(mini?.type).toBe('model-item-multiple')
    if (mini?.type !== 'model-item-multiple') return
    expect(mini.data.providers.map((p) => p.id)).toEqual(['purehub', 'openai'])
  })

  it('groups by provider with headers', () => {
    const items = buildListItems(providers, 'byProvider')
    expect(
      items
        .filter((item) => item.type === 'group-header')
        .map((item) => {
          if (item.type !== 'group-header') return ''
          return item.provider.id
        })
    ).toEqual(['purehub', 'openai', 'deepseek'])
  })

  it('filters by search keyword', () => {
    const items = buildListItems(providers, 'byModel', 'deepseek')
    expect(
      items
        .filter((item) => item.type === 'model-item-multiple' || item.type === 'model-item-single')
        .map((item) =>
          item.type === 'model-item-multiple' || item.type === 'model-item-single' ? item.data.model : ''
        )
    ).toEqual(['deepseek-v4-flash'])
  })
})
