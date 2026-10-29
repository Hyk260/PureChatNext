import { getProviderChatModels } from '@pure/model-bank'
import type { AiModelCard, ModelProviderId } from '@pure/model-bank'

import type { ProviderId, ProviderModelItem } from '../../types'

export interface ModelCatalogItem {
  abilities?: AiModelCard['abilities']
  contextWindowTokens?: number
  displayName: string
  family?: string
  id: string
}

export type ModelCatalogTab = 'all' | 'chat' | 'audio'

export const isAudioCatalogModel = (model: ModelCatalogItem) =>
  Boolean(model.abilities?.audioInput || model.abilities?.audioOutput)

export const buildModelCatalog = (
  provider: ProviderId,
  remoteModels: Array<{ displayName?: string; id: string }>
): ModelCatalogItem[] => {
  const cards = getProviderChatModels(provider as ModelProviderId).filter((card) => card.enabled !== false)
  const cardById = new Map(cards.map((card) => [card.id, card]))
  const cardByGatewayId = new Map<string, AiModelCard>()
  const entries = new Map<string, ModelCatalogItem>()

  for (const card of cards) {
    if (card.gatewayId) cardByGatewayId.set(card.gatewayId, card)
    entries.set(card.id, toCatalogItem(card))
  }

  for (const model of remoteModels) {
    const card = cardById.get(model.id) ?? cardByGatewayId.get(model.id)

    // PureChat requests use catalog display IDs. Unknown Gateway IDs cannot be routed by the chat API.
    if (provider === 'purechat' && !card) continue

    const id = card?.id ?? model.id
    const existing = entries.get(id)
    entries.set(id, {
      ...existing,
      ...(card ? toCatalogItem(card) : {}),
      displayName: card?.displayName ?? model.displayName?.trim() ?? existing?.displayName ?? id,
      id,
    })
  }

  return [...entries.values()]
}

export const groupModelCatalog = (models: ModelCatalogItem[], fallbackGroup: string) => {
  const groups = new Map<string, ModelCatalogItem[]>()

  for (const model of models) {
    const group = model.family?.trim() || getModelGroupFromId(model.id) || fallbackGroup
    const items = groups.get(group) ?? []
    items.push(model)
    groups.set(group, items)
  }

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
}

export const filterModelCatalog = (models: ModelCatalogItem[], keyword: string, tab: ModelCatalogTab) => {
  const query = keyword.trim().toLowerCase()

  return models.filter((model) => {
    const matchesSearch =
      !query ||
      model.displayName.toLowerCase().includes(query) ||
      model.id.toLowerCase().includes(query) ||
      model.family?.toLowerCase().includes(query)
    const isAudioModel = isAudioCatalogModel(model)
    const matchesTab = tab === 'all' || (tab === 'audio' ? isAudioModel : !isAudioModel)

    return matchesSearch && matchesTab
  })
}

export const applyModelCatalogSelection = (
  currentModels: ProviderModelItem[],
  catalogModels: ModelCatalogItem[],
  selectedModelIds: ReadonlySet<string>
): ProviderModelItem[] => {
  const nextModels = new Map(currentModels.map((model) => [model.id, model]))

  for (const catalogModel of catalogModels) {
    const existing = nextModels.get(catalogModel.id)
    const selected = selectedModelIds.has(catalogModel.id)
    if (!existing && !selected) continue

    nextModels.set(
      catalogModel.id,
      existing
        ? {
            ...existing,
            abilities: catalogModel.abilities ?? existing.abilities,
            contextWindowTokens: catalogModel.contextWindowTokens ?? existing.contextWindowTokens,
            displayName: existing.source === 'custom' ? existing.displayName : catalogModel.displayName,
            enabled: selected,
          }
        : {
            abilities: catalogModel.abilities,
            contextWindowTokens: catalogModel.contextWindowTokens,
            displayName: catalogModel.displayName,
            enabled: true,
            id: catalogModel.id,
            source: 'remote',
          }
    )
  }

  return [...nextModels.values()]
}

const getModelGroupFromId = (id: string) => {
  const separator = id.indexOf('/')
  return separator > 0 ? id.slice(0, separator) : undefined
}

const toCatalogItem = (card: AiModelCard): ModelCatalogItem => ({
  abilities: card.abilities,
  contextWindowTokens: card.contextWindowTokens,
  displayName: card.displayName,
  family: card.family,
  id: card.id,
})
