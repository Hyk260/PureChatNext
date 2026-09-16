import { apiFetch, jsonInit } from '@/utils/apiFetch'

export async function patchUserProfile(body: { fullName?: string | null; interests?: string[] }) {
  const response = await apiFetch('/api/webapi/user/profile', jsonInit(body, { method: 'PATCH' }))

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(typeof data?.error === 'string' ? data.error : '更新失败')
  }

  return response.json() as Promise<{ fullName: string | null; interests: string[] }>
}
