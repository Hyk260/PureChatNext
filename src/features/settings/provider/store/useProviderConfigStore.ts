'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { DEFAULT_PROVIDER_CONFIGS } from '../const'
import type { ProviderConfig, ProviderConfigs, ProviderId } from '../types'

interface ProviderConfigState {
  configs: ProviderConfigs
  getConfig: (id: ProviderId) => ProviderConfig
  patchConfig: (id: ProviderId, patch: Partial<ProviderConfig>) => void
  setEnabled: (id: ProviderId, enabled: boolean) => void
}

export const useProviderConfigStore = create<ProviderConfigState>()(
  persist(
    (set, get) => ({
      configs: DEFAULT_PROVIDER_CONFIGS,
      getConfig: (id) => get().configs[id] ?? DEFAULT_PROVIDER_CONFIGS[id],
      patchConfig: (id, patch) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...state.configs[id],
              ...patch,
            },
          },
        })),
      setEnabled: (id, enabled) =>
        set((state) => ({
          configs: {
            ...state.configs,
            [id]: {
              ...state.configs[id],
              enabled,
            },
          },
        })),
    }),
    {
      name: 'purechat:provider:v1',
      version: 1,
    },
  ),
)
