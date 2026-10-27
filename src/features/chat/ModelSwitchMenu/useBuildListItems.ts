import { useMemo } from 'react'

import { ModelProvider } from '@pure/model-bank'

import type { EnabledProviderGroup, GroupMode, ListItem, ModelWithProviders } from './types'

const providerPriority = (id: string) => (id === ModelProvider.PureChat ? 0 : 1)

export const buildListItems = (
  enabledProviders: EnabledProviderGroup[],
  groupMode: GroupMode,
  searchKeyword: string = ''
): ListItem[] => {
  if (enabledProviders.length === 0) {
    return [{ type: 'no-provider' }]
  }

  const keyword = searchKeyword.trim().toLowerCase()
  const matchesSearch = (text: string) => !keyword || text.toLowerCase().includes(keyword)
  const matchesProviderModel = (provider: EnabledProviderGroup, model: EnabledProviderGroup['models'][number]) =>
    [model.displayName, model.model, provider.name, provider.id].some(matchesSearch)

  const sortedProviders = [...enabledProviders].sort((a, b) => providerPriority(a.id) - providerPriority(b.id))

  if (groupMode === 'byModel') {
    const modelMap = new Map<string, ModelWithProviders>()

    for (const provider of sortedProviders) {
      for (const model of provider.models) {
        if (!matchesProviderModel(provider, model)) continue

        const existing = modelMap.get(model.model)
        if (!existing) {
          modelMap.set(model.model, {
            abilities: model.abilities,
            contextWindowTokens: model.contextWindowTokens,
            displayName: model.displayName,
            model: model.model,
            providers: [{ id: provider.id, logo: provider.logo, name: provider.name }],
          })
          continue
        }

        if (!existing.abilities && model.abilities) existing.abilities = model.abilities
        if (existing.contextWindowTokens == null && model.contextWindowTokens != null) {
          existing.contextWindowTokens = model.contextWindowTokens
        }

        existing.providers.push({ id: provider.id, logo: provider.logo, name: provider.name })
      }
    }

    const models = Array.from(modelMap.values())
    for (const entry of models) {
      entry.providers.sort((a, b) => providerPriority(a.id) - providerPriority(b.id))
    }

    return models.map((data) => ({
      data,
      type: data.providers.length === 1 ? ('model-item-single' as const) : ('model-item-multiple' as const),
    }))
  }

  const items: ListItem[] = []

  for (const provider of sortedProviders) {
    const filteredModels = provider.models.filter((model) => matchesProviderModel(provider, model))

    if (filteredModels.length === 0 && keyword) continue

    items.push({ provider, type: 'group-header' })

    if (filteredModels.length === 0) {
      items.push({ provider, type: 'empty-model' })
      continue
    }

    for (const model of filteredModels) {
      items.push({ model, provider, type: 'provider-model-item' })
    }
  }

  return items
}

export const useBuildListItems = (
  enabledProviders: EnabledProviderGroup[],
  groupMode: GroupMode,
  searchKeyword: string = ''
) =>
  useMemo(
    () => buildListItems(enabledProviders, groupMode, searchKeyword),
    [enabledProviders, groupMode, searchKeyword]
  )
