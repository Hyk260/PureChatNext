'use client'

import { apiFetch, jsonInit } from '@/utils/apiFetch'
import { useSession } from '@/libs/better-auth/client'
import useSWR from 'swr'

import type { CustomProviderDefinition } from './types'

export type CustomProviderInput = Omit<CustomProviderDefinition, 'enabled'> & {
  apiKey?: string
  enabled?: boolean
}

export const CUSTOM_PROVIDERS_SWR_KEY = 'custom-providers'

const readError = async (response: Response, fallback: string) => {
  const body = (await response.json().catch(() => ({}))) as { error?: string }
  return body.error || `${fallback}: ${response.status}`
}

export async function fetchCustomProviders(): Promise<CustomProviderDefinition[]> {
  const response = await apiFetch('/api/providers/custom')
  if (response.status === 401) throw new Error('请先登录后再管理自定义服务商')
  if (!response.ok) throw new Error(await readError(response, '加载自定义服务商失败'))
  const json = (await response.json()) as { items?: CustomProviderDefinition[] }
  return Array.isArray(json.items) ? json.items : []
}

export async function createCustomProvider(input: CustomProviderInput) {
  const response = await apiFetch('/api/providers/custom', jsonInit(input, { method: 'POST' }))
  if (!response.ok) throw new Error(await readError(response, '创建服务商失败'))
  const json = (await response.json()) as { item?: CustomProviderDefinition }
  if (!json.item) throw new Error('创建服务商失败')
  return json.item
}

export async function updateCustomProvider(id: string, patch: Partial<CustomProviderInput>) {
  const response = await apiFetch(`/api/providers/custom/${encodeURIComponent(id)}`, jsonInit(patch, { method: 'PUT' }))
  if (!response.ok) throw new Error(await readError(response, '更新服务商失败'))
  const json = (await response.json()) as { item?: CustomProviderDefinition }
  if (!json.item) throw new Error('更新服务商失败')
  return json.item
}

export async function deleteCustomProvider(id: string) {
  const response = await apiFetch(`/api/providers/custom/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await readError(response, '删除服务商失败'))
}

export function useCustomProviders() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  return useSWR(userId ? [CUSTOM_PROVIDERS_SWR_KEY, userId] : null, fetchCustomProviders, {
    revalidateOnFocus: false,
  })
}
