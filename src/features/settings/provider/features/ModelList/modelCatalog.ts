import { getProviderChatModels } from '@pure/model-bank'
import type { AiModelCard, ModelProviderId } from '@pure/model-bank'

import type { ProviderId, ProviderModelItem } from '../../types'

export interface ModelCatalogItem {
  abilities?: AiModelCard['abilities']
  contextWindowTokens?: number
  displayName: string
  family?: string
  group?: string
  id: string
  inputModalities?: string[]
  outputModalities?: string[]
  pricing?: ProviderModelItem['pricing']
}

export type ModelCatalogTab = 'all' | 'chat' | 'audio' | 'free' | 'reasoning' | 'image'

export const isAudioCatalogModel = (model: ModelCatalogItem) => {
  // Match Cherry Studio's audio type: audio-generating models belong in this
  // category even when they also accept and return text (for example GPT Audio).
  const hasAudioOutput = Boolean(model.abilities?.audioOutput || model.outputModalities?.includes('audio'))
  if (hasAudioOutput) return true

  // Keep input-only models here only when the metadata identifies them as
  // audio-specific; multimodal chat models remain in the chat category.
  const hasAudioInput = Boolean(model.abilities?.audioInput || model.inputModalities?.includes('audio'))
  const modalitiesKnown = Array.isArray(model.inputModalities) && Array.isArray(model.outputModalities)
  const supportsTextConversation =
    model.inputModalities?.includes('text') === true && model.outputModalities?.includes('text') === true
  return hasAudioInput && modalitiesKnown && !supportsTextConversation
}

export const isFreeCatalogModel = (model: ModelCatalogItem) =>
  model.pricing?.inputPerMillion === 0 && model.pricing.outputPerMillion === 0

export const isReasoningCatalogModel = (model: ModelCatalogItem) => Boolean(model.abilities?.reasoning)

export const isImageCatalogModel = (model: ModelCatalogItem) =>
  Boolean(model.abilities?.vision || model.abilities?.imageGeneration)

const matchesModelCatalogTab = (model: ModelCatalogItem, tab: ModelCatalogTab) => {
  switch (tab) {
    case 'all': {
      return true
    }
    case 'audio': {
      return isAudioCatalogModel(model)
    }
    case 'free': {
      return isFreeCatalogModel(model)
    }
    case 'reasoning': {
      return isReasoningCatalogModel(model)
    }
    case 'image': {
      return isImageCatalogModel(model)
    }
    case 'chat': {
      return !isAudioCatalogModel(model)
    }
  }
}

export const buildModelCatalog = (
  provider: ProviderId,
  remoteModels: ModelCatalogItem[]
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
      abilities: model.abilities ?? card?.abilities ?? existing?.abilities,
      contextWindowTokens: model.contextWindowTokens ?? card?.contextWindowTokens ?? existing?.contextWindowTokens,
      displayName: card?.displayName ?? model.displayName?.trim() ?? existing?.displayName ?? id,
      family: model.family ?? card?.family ?? existing?.family,
      group: model.group ?? existing?.group,
      id,
      inputModalities: model.inputModalities ?? existing?.inputModalities,
      outputModalities: model.outputModalities ?? existing?.outputModalities,
      pricing:
        model.pricing ??
        (card
          ? {
              inputPerMillion: card.pricing.textInput,
              outputPerMillion: card.pricing.textOutput,
            }
          : existing?.pricing),
    })
  }

  return [...entries.values()]
}

export const groupModelCatalog = (models: ModelCatalogItem[], fallbackGroup: string) => {
  const groups = new Map<string, ModelCatalogItem[]>()

  for (const model of models) {
    const group = model.family?.trim() || model.group?.trim() || getModelGroupFromId(model.id) || fallbackGroup
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
      model.family?.toLowerCase().includes(query) ||
      model.group?.toLowerCase().includes(query)
    return matchesSearch && matchesModelCatalogTab(model, tab)
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

    let abilities = existing?.abilities ?? catalogModel.abilities
    if (existing && catalogModel.abilities) {
      abilities = {
        ...existing.abilities,
        ...catalogModel.abilities,
        textToSpeech: existing.abilities?.textToSpeech ?? catalogModel.abilities.textToSpeech,
      }
    }
    const displayName = existing?.source === 'custom' ? existing.displayName : catalogModel.displayName
    const nextModel: ProviderModelItem = existing
      ? {
          ...existing,
          abilities,
          contextWindowTokens: catalogModel.contextWindowTokens ?? existing.contextWindowTokens,
          displayName,
          family: catalogModel.family ?? existing.family,
          group: catalogModel.group ?? existing.group,
          inputModalities: catalogModel.inputModalities ?? existing.inputModalities,
          outputModalities: catalogModel.outputModalities ?? existing.outputModalities,
          pricing: catalogModel.pricing ?? existing.pricing,
          enabled: selected,
        }
      : {
          abilities: catalogModel.abilities,
          contextWindowTokens: catalogModel.contextWindowTokens,
          displayName: catalogModel.displayName,
          enabled: true,
          id: catalogModel.id,
          family: catalogModel.family,
          group: catalogModel.group,
          inputModalities: catalogModel.inputModalities,
          outputModalities: catalogModel.outputModalities,
          pricing: catalogModel.pricing,
          source: 'remote',
        }
    nextModels.set(catalogModel.id, nextModel)
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
  pricing: {
    inputPerMillion: card.pricing.textInput,
    outputPerMillion: card.pricing.textOutput,
  },
})
