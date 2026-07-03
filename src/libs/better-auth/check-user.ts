import type { CheckUserResponseData } from '@/app/api/auth/check-user/route'

export async function checkUserByEmail(email: string): Promise<CheckUserResponseData & { error?: string }> {
  const response = await fetch('/api/auth/check-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = (await response.json()) as CheckUserResponseData & { error?: string }

  if (!response.ok) {
    throw new Error(data.error ?? '检查用户失败')
  }

  return data
}
