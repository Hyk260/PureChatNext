import type { CheckUserResponseData } from '@/app/api/auth/check-user/route'
import { apiFetch, jsonInit } from '@/utils/apiFetch'

export async function checkUserByEmail(email: string): Promise<CheckUserResponseData & { error?: string }> {
  const response = await apiFetch('/api/auth/check-user', jsonInit({ email }, { method: 'POST' }))

  const data = (await response.json()) as CheckUserResponseData & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? '检查用户失败')
  }

  return data
}
