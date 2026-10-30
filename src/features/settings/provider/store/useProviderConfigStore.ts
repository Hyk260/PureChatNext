'use client'

import { isBuiltinProviderId, isValidProviderId } from '@pure/const'

import { getAiModel } from '@pure/model-bank'
import type { ModelProviderId } from '@pure/model-bank'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  createDefaultProviderConfig,
  DEFAULT_PROVIDER_CONFIGS,
  isServerManagedProvider,
  LEGACY_PROVIDER_DEFAULT_BASE_URLS,
} from '../const'
import type {
  CustomProviderDefinition,
  ProviderConfig,
  ProviderConfigs,
  ProviderId,
  ProviderModelHealth,
  ProviderModelItem,
} from '../types'

interface ProviderConfigState {
  configs: ProviderConfigs
  customProviders: CustomProviderDefinition[]
  addCustomModel: (id: ProviderId, model: CustomModelPatch & { id: string }) => void
  clearRemoteModels: (id: ProviderId) => void
  getConfig: (id: ProviderId) => ProviderConfig
  getEnabledModels: () => Array<{ displayName: string; model: string; provider: ProviderId }>
  mergeRemoteModels: (
    id: ProviderId,
    remote: Array<Partial<ProviderModelItem> & { id: string }>
  ) => void
  patchConfig: (id: ProviderId, patch: Partial<ProviderConfig>) => void
  removeCustomModel: (id: ProviderId, modelId: string) => void
  setCheckModel: (id: ProviderId, checkModel: string) => void
  setEnabled: (id: ProviderId, enabled: boolean) => void
  syncBuiltinProviderEnabled: (enabled: Partial<Record<ProviderId, boolean>>) => void
  setCustomProviders: (providers: CustomProviderDefinition[]) => void
  removeCustomProvider: (id: ProviderId) => void
  setModelHealth: (id: ProviderId, modelId: string, health: ProviderModelHealth) => void
  setModels: (id: ProviderId, models: ProviderModelItem[]) => void
  setAllModelsEnabled: (id: ProviderId, enabled: boolean) => void
  resetModels: (id: ProviderId) => void
  reorderModels: (id: ProviderId, orderedModelIds: string[]) => void
  updateCustomModel: (id: ProviderId, modelId: string, patch: CustomModelPatch) => void
  toggleModelEnabled: (id: ProviderId, modelId: string, enabled: boolean) => void
}

export type CustomModelPatch = {
  abilities?: ProviderModelItem['abilities']
  contextWindowTokens?: number
  displayName: string
}

export const mergeProviderConfig = (
  id: ProviderId,
  partial?: Partial<ProviderConfig> & { baseURL?: string }
): ProviderConfig => {
  const defaults = createDefaultProviderConfig(id)
  if (!partial) return defaults

  const legacyDefault = isBuiltinProviderId(id) ? LEGACY_PROVIDER_DEFAULT_BASE_URLS[id] : undefined
  const rawBaseURL = typeof partial.baseURL === 'string' ? partial.baseURL : defaults.baseURL
  const baseURL = rawBaseURL.trim() === legacyDefault ? '' : rawBaseURL

  const catalogById = new Map(defaults.models.map((model) => [model.id, model]))
  const storedModels = Array.isArray(partial.models) && partial.models.length > 0 ? partial.models : defaults.models
  const persistedModels = isServerManagedProvider(id)
    ? storedModels.filter((model) => model.source !== 'builtin' || catalogById.has(model.id))
    : storedModels

  // Reconcile built-in metadata with model-bank after persist hydrate.
  const models: ProviderModelItem[] = persistedModels.map((model) => {
    const catalog = catalogById.get(model.id)
    const health = model.health?.status === 'checking' ? { status: 'idle' as const } : model.health
    if (!catalog) return { ...model, health }

    return {
      ...model,
      abilities: catalog.abilities,
      contextWindowTokens: catalog.contextWindowTokens,
      displayName: catalog.displayName,
      enabled: catalog.enabled === false ? false : model.enabled,
      health,
    }
  })

  const knownIds = new Set(models.map((model) => model.id))
  for (const builtin of defaults.models) {
    if (!knownIds.has(builtin.id)) models.push(builtin)
  }

  const requestedCheckModel =
    typeof partial.checkModel === 'string' && partial.checkModel.trim() ? partial.checkModel.trim() : ''
  const requestedCheckModelCard = catalogById.get(requestedCheckModel)
  const checkModelEnabled = requestedCheckModel
    ? isServerManagedProvider(id)
      ? requestedCheckModelCard !== undefined && requestedCheckModelCard.enabled !== false
      : requestedCheckModelCard?.enabled !== false
    : false

  return {
    ...defaults,
    ...partial,
    baseURL,
    checkModel: checkModelEnabled ? requestedCheckModel : defaults.checkModel,
    // PureChat 等官方托管服务商默认启用且不可关闭。
    enabled: isServerManagedProvider(id) ? true : (partial.enabled ?? defaults.enabled),
    models,
  }
}

const normalizePersistedConfigs = (configs?: Partial<ProviderConfigs>): ProviderConfigs => {
  const next: ProviderConfigs = {
    bailian: mergeProviderConfig('bailian', configs?.bailian),
    deepseek: mergeProviderConfig('deepseek', configs?.deepseek),
    lmstudio: mergeProviderConfig('lmstudio', configs?.lmstudio),
    openai: mergeProviderConfig('openai', configs?.openai),
    openrouter: mergeProviderConfig('openrouter', configs?.openrouter),
    purechat: mergeProviderConfig('purechat', configs?.purechat),
  }

  for (const [id, config] of Object.entries(configs ?? {})) {
    if (!isValidProviderId(id) || isBuiltinProviderId(id)) continue
    next[id] = mergeProviderConfig(id, config)
  }

  return next
}

const normalizePersistedHealth = (configs: ProviderConfigs): ProviderConfigs => {
  const next = { ...configs }

  for (const providerId of Object.keys(next) as ProviderId[]) {
    const config = next[providerId]
    next[providerId] = {
      ...config,
      models: config.models.map((model) =>
        model.health?.status === 'checking' ? { ...model, health: { status: 'idle' } } : model
      ),
    }
  }

  return next
}

const stripSecretFields = (configs: ProviderConfigs): ProviderConfigs =>
  Object.fromEntries(
    Object.entries(configs).map(([id, config]) => [
      id,
      {
        ...config,
        apiKey: '',
        ...(isBuiltinProviderId(id) ? { baseURL: '' } : {}),
      },
    ])
  )

const stripEnabledFields = (configs: ProviderConfigs) =>
  Object.fromEntries(
    Object.entries(configs).map(([id, config]) => {
      const { enabled: _enabled, ...persistedConfig } = config
      return [id, persistedConfig]
    })
  )

const withDefaultProviderEnabled = (configs: ProviderConfigs): ProviderConfigs => {
  const next = { ...configs }
  for (const [id, config] of Object.entries(next) as [ProviderId, ProviderConfig][]) {
    next[id] = { ...config, enabled: createDefaultProviderConfig(id).enabled }
  }
  return next
}

export const useProviderConfigStore = create<ProviderConfigState>()(
  persist(
    (set, get) => ({
      configs: DEFAULT_PROVIDER_CONFIGS,
      customProviders: [],
      addCustomModel: (id, model) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          const modelId = model.id.trim()
          if (!modelId || current.models.some((item) => item.id === modelId)) return state

          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: [
                  ...current.models,
                  {
                    abilities: model.abilities,
                    contextWindowTokens: model.contextWindowTokens,
                    displayName: model.displayName?.trim() || modelId,
                    enabled: true,
                    id: modelId,
                    source: 'custom',
                  },
                ],
              },
            },
          }
        })
      },
      clearRemoteModels: (id) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: current.models.filter((model) => model.source !== 'remote'),
              },
            },
          }
        })
      },
      getConfig: (id) => get().configs[id] ?? createDefaultProviderConfig(id),
      getEnabledModels: () => {
        const { configs } = get()
        const result: Array<{ displayName: string; model: string; provider: ProviderId }> = []

        for (const providerId of Object.keys(configs) as ProviderId[]) {
          const config = configs[providerId]
          if (!config?.enabled) continue

          for (const model of config.models) {
            if (!model.enabled) continue
            if (getAiModel(providerId as ModelProviderId, model.id)?.enabled === false) continue
            result.push({
              displayName: model.displayName,
              model: model.id,
              provider: providerId,
            })
          }
        }

        return result
      },
      mergeRemoteModels: (id, remote) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          const byId = new Map(current.models.map((model) => [model.id, model]))

          const merged: ProviderModelItem[] = remote.map((item) => {
            const existing = byId.get(item.id)
            if (existing) {
              return {
                ...existing,
                displayName:
                  existing.source === 'custom'
                    ? existing.displayName
                    : item.displayName?.trim() || existing.displayName,
                abilities: item.abilities
                  ? { ...existing.abilities, ...item.abilities, textToSpeech: existing.abilities?.textToSpeech }
                  : existing.abilities,
                contextWindowTokens: item.contextWindowTokens ?? existing.contextWindowTokens,
                family: item.family ?? existing.family,
                group: item.group ?? existing.group,
                inputModalities: item.inputModalities ?? existing.inputModalities,
                outputModalities: item.outputModalities ?? existing.outputModalities,
                pricing: item.pricing ?? existing.pricing,
              }
            }

            return {
              displayName: item.displayName?.trim() || item.id,
              enabled: true,
              id: item.id,
              abilities: item.abilities,
              contextWindowTokens: item.contextWindowTokens,
              family: item.family,
              group: item.group,
              inputModalities: item.inputModalities,
              outputModalities: item.outputModalities,
              pricing: item.pricing,
              source: 'remote',
            }
          })

          // Keep local models that the remote list did not return.
          const knownIds = new Set(merged.map((item) => item.id))
          for (const model of current.models) {
            if (!knownIds.has(model.id)) {
              merged.push(model)
            }
          }

          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: merged,
              },
            },
          }
        })
      },
      patchConfig: (id, patch) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...(state.configs[id] ?? createDefaultProviderConfig(id)),
              ...patch,
              ...(isServerManagedProvider(id) ? { enabled: true } : null),
            },
          },
        }))
      },
      removeCustomModel: (id, modelId) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: current.models.filter((model) => !(model.id === modelId && model.source === 'custom')),
              },
            },
          }
        })
      },
      setCheckModel: (id, checkModel) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...(state.configs[id] ?? createDefaultProviderConfig(id)),
              checkModel,
            },
          },
        }))
      },
      setEnabled: (id, enabled) => {
        if (isServerManagedProvider(id)) return
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...(state.configs[id] ?? createDefaultProviderConfig(id)),
              enabled,
            },
          },
        }))
      },
      syncBuiltinProviderEnabled: (enabled) => {
        set((state) => {
          const configs = { ...state.configs }
          for (const [id, value] of Object.entries(enabled) as [ProviderId, boolean][]) {
            if (!isBuiltinProviderId(id) || isServerManagedProvider(id) || typeof value !== 'boolean') continue
            const current = configs[id] ?? createDefaultProviderConfig(id)
            configs[id] = { ...current, enabled: value }
          }
          return { configs }
        })
      },
      setCustomProviders: (providers) => {
        set((state) => {
          const validIds = new Set(providers.map((provider) => provider.id))
          const configs: ProviderConfigs = { ...DEFAULT_PROVIDER_CONFIGS }

          for (const [id, config] of Object.entries(state.configs)) {
            if (isBuiltinProviderId(id) || validIds.has(id)) configs[id] = config
          }

          for (const provider of providers) {
            const current = configs[provider.id]
            configs[provider.id] = {
              ...mergeProviderConfig(provider.id, current),
              baseURL: provider.baseURL,
              enabled: provider.enabled,
            }
          }

          return { configs, customProviders: providers }
        })
      },
      removeCustomProvider: (id) => {
        set((state) => {
          const configs = { ...state.configs }
          delete configs[id]
          return {
            configs,
            customProviders: state.customProviders.filter((provider) => provider.id !== id),
          }
        })
      },
      setModelHealth: (id, modelId, health) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: current.models.map((model) => (model.id === modelId ? { ...model, health } : model)),
              },
            },
          }
        })
      },
      setModels: (id, models) => {
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...(state.configs[id] ?? createDefaultProviderConfig(id)),
              models,
            },
          },
        }))
      },
      setAllModelsEnabled: (id, enabled) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: current.models.map((model) => ({
                  ...model,
                  enabled: getAiModel(id as ModelProviderId, model.id)?.enabled === false ? false : enabled,
                })),
              },
            },
          }
        })
      },
      resetModels: (id) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: createDefaultProviderConfig(id).models,
              },
            },
          }
        })
      },
      reorderModels: (id, orderedModelIds) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          const modelById = new Map(current.models.map((model) => [model.id, model]))
          let nextIndex = 0

          const models = current.models.map((model) => {
            if (!orderedModelIds.includes(model.id)) return model
            const nextModelId = orderedModelIds[nextIndex++]
            return modelById.get(nextModelId) ?? model
          })

          return {
            configs: {
              ...state.configs,
              [id]: { ...current, models },
            },
          }
        })
      },
      updateCustomModel: (id, modelId, patch) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: current.models.map((model) =>
                  model.id === modelId && model.source === 'custom'
                    ? {
                        ...model,
                        abilities: patch.abilities,
                        contextWindowTokens: patch.contextWindowTokens,
                        displayName: patch.displayName.trim() || model.displayName,
                      }
                    : model
                ),
              },
            },
          }
        })
      },
      toggleModelEnabled: (id, modelId, enabled) => {
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          return {
            configs: {
              ...state.configs,
              [id]: {
                ...current,
                models: current.models.map((model) => (model.id === modelId ? { ...model, enabled } : model)),
              },
            },
          }
        })
      },
    }),
    {
      migrate: (persisted) => {
        const state = persisted as { configs?: Partial<ProviderConfigs> } | undefined
        const configs = state?.configs

        if (!configs) {
          return { configs: DEFAULT_PROVIDER_CONFIGS }
        }

        const next = stripSecretFields(withDefaultProviderEnabled(normalizePersistedConfigs(configs)))

        return { configs: next }
      },
      merge: (persisted, current) => {
        const state = persisted as { configs?: Partial<ProviderConfigs> } | undefined
        return {
          ...current,
          configs: stripSecretFields(
            withDefaultProviderEnabled(normalizePersistedHealth(normalizePersistedConfigs(state?.configs)))
          ),
        }
      },
      name: 'purechat:provider:v1',
      partialize: (state) => ({
        configs: stripEnabledFields(stripSecretFields(normalizePersistedHealth(state.configs))),
      }),
      version: 11,
    }
  )
)
