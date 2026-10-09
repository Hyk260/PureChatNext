import { apiFetch, jsonInit } from '@/utils/apiFetch'

export class ReferralApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message)
  }
}

export async function referralRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await apiFetch(
    `/api/webapi/referrals${path}`,
    body === undefined ? undefined : jsonInit(body, { method: 'POST' })
  )
  const data = await response.json()
  if (!response.ok)
    throw new ReferralApiError(typeof data.error === 'string' ? data.error : '邀请请求失败，请稍后重试', data.code)
  return data as T
}
