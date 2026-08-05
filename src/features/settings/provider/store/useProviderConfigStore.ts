'use client'

import { getAiModel } from '@pure/model-bank'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  createDefaultProviderConfig,
  DEFAULT_PROVIDER_CONFIGS,
  isServerManagedProvider,
  LEGACY_PROVIDER_DEFAULT_BASE_URLS,
} from '../const'
import type { ProviderConfig, ProviderConfigs, ProviderId, ProviderModelItem } from '../types'

interface ProviderConfigState {
  configs: ProviderConfigs
  getConfig: (id: ProviderId) => ProviderConfig
  getEnabledModels: () => Array<{ displayName: string; model: string; provider: ProviderId }>
  mergeRemoteModels: (id: ProviderId, remote: Array<{ displayName?: string; id: string }>) => void
  patchConfig: (id: ProviderId, patch: Partial<ProviderConfig>) => void
  setCheckModel: (id: ProviderId, checkModel: string) => void
  setEnabled: (id: ProviderId, enabled: boolean) => void
  setModels: (id: ProviderId, models: ProviderModelItem[]) => void
  toggleModelEnabled: (id: ProviderId, modelId: string, enabled: boolean) => void
}

export const mergeProviderConfig = (
  id: ProviderId,
  partial?: Partial<ProviderConfig> & { baseURL?: string }
): ProviderConfig => {
  const defaults = createDefaultProviderConfig(id)
  if (!partial) return defaults

  const legacyDefault = LEGACY_PROVIDER_DEFAULT_BASE_URLS[id]
  const rawBaseURL = typeof partial.baseURL === 'string' ? partial.baseURL : defaults.baseURL
  const baseURL = rawBaseURL.trim() === legacyDefault ? '' : rawBaseURL

  const catalogById = new Map(defaults.models.map((model) => [model.id, model]))
  const persistedModels = Array.isArray(partial.models) && partial.models.length > 0 ? partial.models : defaults.models

  // Reconcile with model-bank: catalog `enabled: false` stays off after persist hydrate.
  const models = persistedModels.map((model) => {
    const catalog = catalogById.get(model.id)
    if (catalog && !catalog.enabled) {
      return { ...model, displayName: catalog.displayName, enabled: false }
    }
    return model
  })

  const knownIds = new Set(models.map((model) => model.id))
  for (const builtin of defaults.models) {
    if (!knownIds.has(builtin.id)) models.push(builtin)
  }

  return {
    ...defaults,
    ...partial,
    baseURL,
    checkModel:
      typeof partial.checkModel === 'string' && partial.checkModel.trim() ? partial.checkModel : defaults.checkModel,
    // PureChat 等官方托管服务商默认启用且不可关闭。
    enabled: isServerManagedProvider(id) ? true : (partial.enabled ?? defaults.enabled),
    models,
  }
}

export const useProviderConfigStore = create<ProviderConfigState>()(
  persist(
    (set, get) => ({
      configs: DEFAULT_PROVIDER_CONFIGS,
      getConfig: (id) => get().configs[id] ?? createDefaultProviderConfig(id),
      getEnabledModels: () => {
        const { configs } = get()
        const result: Array<{ displayName: string; model: string; provider: ProviderId }> = []

        for (const providerId of Object.keys(configs) as ProviderId[]) {
          const config = configs[providerId]
          if (!config?.enabled) continue

          for (const model of config.models) {
            if (!model.enabled) continue
            if (getAiModel(providerId, model.id)?.enabled === false) continue
            result.push({
              displayName: model.displayName,
              model: model.id,
              provider: providerId,
            })
          }
        }

        return result
      },
      mergeRemoteModels: (id, remote) =>
        set((state) => {
          const current = state.configs[id] ?? createDefaultProviderConfig(id)
          const byId = new Map(current.models.map((model) => [model.id, model]))

          const merged: ProviderModelItem[] = remote.map((item) => {
            const existing = byId.get(item.id)
            if (existing) {
              return {
                ...existing,
                displayName: item.displayName?.trim() || existing.displayName,
                source: 'remote',
              }
            }

            return {
              displayName: item.displayName?.trim() || item.id,
              enabled: true,
              id: item.id,
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
        }),
      patchConfig: (id, patch) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...(state.configs[id] ?? createDefaultProviderConfig(id)),
              ...patch,
              ...(isServerManagedProvider(id) ? { enabled: true } : null),
            },
          },
        })),
      setCheckModel: (id, checkModel) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...(state.configs[id] ?? createDefaultProviderConfig(id)),
              checkModel,
            },
          },
        })),
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
      setModels: (id, models) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...(state.configs[id] ?? createDefaultProviderConfig(id)),
              models,
            },
          },
        })),
      toggleModelEnabled: (id, modelId, enabled) =>
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
        }),
    }),
    {
      migrate: (persisted, version) => {
        const state = persisted as {
          configs?: Partial<ProviderConfigs> & { purehub?: ProviderConfig }
        } | undefined
        const configs = state?.configs

        if (!configs) {
          return { configs: DEFAULT_PROVIDER_CONFIGS }
        }

        // v7: rename provider id purehub → purechat
        const legacyPureHub = (configs as { purehub?: ProviderConfig }).purehub
        const purechatPartial = configs.purechat ?? legacyPureHub

        const next: ProviderConfigs = {
          deepseek: mergeProviderConfig('deepseek', configs.deepseek),
          openai: mergeProviderConfig('openai', configs.openai),
          purechat: mergeProviderConfig('purechat', purechatPartial),
        }

        // version < 2 also needs empty baseURL migration (handled in mergeProviderConfig).
        void version
        return { configs: next }
      },
      name: 'purechat:provider:v1',
      partialize: (state) => ({ configs: state.configs }),
      version: 7,
    }
  )
)
