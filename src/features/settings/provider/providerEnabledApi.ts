'use client'

import { isBuiltinProviderId } from '@pure/const'
import { useSession } from '@/libs/better-auth/client'
import { apiFetch, jsonInit } from '@/utils/apiFetch'
import { useCallback, useEffect } from 'react'
import useSWR from 'swr'

import { DEFAULT_PROVIDER_CONFIGS, isServerManagedProvider } from './const'
import { useProviderConfigStore } from './store/useProviderConfigStore'
import type { ProviderId } from './types'

export const PROVIDER_ENABLED_SETTINGS_SWR_KEY = 'provider-enabled-settings'

type ProviderEnabledSettings = Partial<Record<ProviderId, boolean>>

type ProviderEnabledSettingsResponse = {
  items?: ProviderEnabledSettings
}

const defaultProviderEnabledSettings = Object.fromEntries(
  Object.entries(DEFAULT_PROVIDER_CONFIGS).map(([provider, config]) => [provider, config.enabled])
) as Record<ProviderId, boolean>

const readError = async (response: Response, fallback: string) => {
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  return body.error || `${fallback}: ${response.status}`
}

async function fetchProviderEnabledSettings(): Promise<ProviderEnabledSettings> {
  const response = await apiFetch('/api/providers/enabled')
  if (response.status === 401) throw new Error('请先登录后再管理服务商')
  if (!response.ok) throw new Error(await readError(response, '读取服务商启用状态失败'))
  const json = (await response.json()) as ProviderEnabledSettingsResponse
  return json.items ?? {}
}

async function saveProviderEnabledSetting(provider: ProviderId, enabled: boolean) {
  const response = await apiFetch('/api/providers/enabled', jsonInit({ enabled, provider }, { method: 'PUT' }))
  if (!response.ok) throw new Error(await readError(response, '保存服务商启用状态失败'))
  const json = (await response.json()) as ProviderEnabledSettingsResponse
  return json.items ?? {}
}

export function useProviderEnabledSettings() {
  const { data: session, isPending: sessionPending } = useSession()
  const userId = session?.user?.id
  const syncBuiltinProviderEnabled = useProviderConfigStore((state) => state.syncBuiltinProviderEnabled)
  const setEnabled = useProviderConfigStore((state) => state.setEnabled)
  const { data, isLoading, mutate } = useSWR(
    userId ? [PROVIDER_ENABLED_SETTINGS_SWR_KEY, userId] : null,
    fetchProviderEnabledSettings,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    syncBuiltinProviderEnabled(defaultProviderEnabledSettings)
  }, [syncBuiltinProviderEnabled, userId])

  useEffect(() => {
    if (!userId || !data) return
    syncBuiltinProviderEnabled({ ...defaultProviderEnabledSettings, ...data })
  }, [data, syncBuiltinProviderEnabled, userId])

  const updateEnabled = useCallback(
    async (provider: ProviderId, enabled: boolean) => {
      if (!userId) throw new Error('请先登录后再管理服务商')
      if (!isBuiltinProviderId(provider) || isServerManagedProvider(provider)) {
        throw new Error('该服务商不支持此设置')
      }

      const previous = useProviderConfigStore.getState().configs[provider]?.enabled ?? false
      setEnabled(provider, enabled)
      try {
        const next = await saveProviderEnabledSetting(provider, enabled)
        syncBuiltinProviderEnabled({ ...defaultProviderEnabledSettings, ...next })
        await mutate(next, { revalidate: false })
      } catch (error) {
        setEnabled(provider, previous)
        throw error
      }
    },
    [mutate, setEnabled, syncBuiltinProviderEnabled, userId]
  )

  return { isLoading, isReady: !sessionPending && (!userId || !isLoading), updateEnabled }
}
