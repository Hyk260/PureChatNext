import { apiFetch } from '@/utils/apiFetch'
import { useSession } from '@/libs/better-auth/client'
import useSWR from 'swr'

export type ProviderSecretId = 'openai' | 'deepseek'

export type ProviderSecretPublic = {
  apiKey: string
  baseURL: string
  keyHint: string
  providerId: ProviderSecretId
}

export const PROVIDER_SECRETS_SWR_KEY = 'provider-secrets'

export async function fetchProviderSecrets(): Promise<ProviderSecretPublic[]> {
  const res = await apiFetch('/api/providers/secrets')
  if (res.status === 401) throw new Error('请先登录后再保存密钥')
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || `加载密钥失败: ${res.status}`)
  }
  const json = (await res.json()) as { items?: ProviderSecretPublic[] }
  return Array.isArray(json.items) ? json.items : []
}

export async function saveProviderSecret(params: {
  apiKey?: string
  baseURL?: string
  provider: ProviderSecretId
}): Promise<ProviderSecretPublic> {
  const res = await apiFetch('/api/providers/secrets', {
    body: JSON.stringify(params),
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string; item?: ProviderSecretPublic }
  if (res.status === 401) throw new Error('请先登录后再保存密钥')
  if (!res.ok) throw new Error(json.error || `保存密钥失败: ${res.status}`)
  if (!json.item) throw new Error('保存密钥失败')
  return json.item
}

export async function deleteProviderSecret(provider: ProviderSecretId): Promise<void> {
  const res = await apiFetch('/api/providers/secrets', {
    body: JSON.stringify({ provider }),
    headers: { 'Content-Type': 'application/json' },
    method: 'DELETE',
  })
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  if (res.status === 401) throw new Error('请先登录后再删除密钥')
  if (!res.ok) throw new Error(json.error || `删除密钥失败: ${res.status}`)
}

export function secretForProvider(items: ProviderSecretPublic[] | undefined, provider: string) {
  return items?.find((item) => item.providerId === provider)
}

export function useProviderSecrets() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  return useSWR(userId ? [PROVIDER_SECRETS_SWR_KEY, userId] : null, fetchProviderSecrets, {
    revalidateOnFocus: false,
  })
}
