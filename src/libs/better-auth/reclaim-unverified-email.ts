import type { ReclaimUnverifiedEmailResponse } from '@/app/api/auth/reclaim-unverified-email/route'

export async function reclaimUnverifiedEmail(
  email: string
): Promise<ReclaimUnverifiedEmailResponse> {
  const response = await fetch('/api/auth/reclaim-unverified-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = (await response.json()) as ReclaimUnverifiedEmailResponse

  // 404：邮箱已空闲（并发下可能已被清理），可继续注册
  if (response.status === 404) {
    return { reclaimed: true }
  }

  if (!response.ok) {
    throw new Error(data.error ?? '释放未验证邮箱失败')
  }

  return data
}
