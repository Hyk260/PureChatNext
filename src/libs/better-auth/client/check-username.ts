import type { CheckUsernameResponseData } from '@/app/api/auth/check-username/route'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

export async function checkUsernameTaken(username: string): Promise<boolean> {
  const response = await apiFetch('/api/auth/check-username', jsonInit({ username }, { method: 'POST' }))

  const data = (await response.json()) as CheckUsernameResponseData & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? '检查用户名失败')
  }

  return data.taken
}
