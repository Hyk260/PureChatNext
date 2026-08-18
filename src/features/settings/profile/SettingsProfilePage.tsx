'use client'

import { Flexbox, Skeleton } from '@pure/ui'
import { Navigate } from 'react-router'
import useSWR from 'swr'

import type { ProfileUser } from '@/features/settings/profile/ProfileContent'
import { ProfileSettingsContent } from '@/features/settings/profile/ProfileSettingsContent'
import { useSession } from '@/libs/better-auth/client'
import { apiFetch } from '@/utils/apiFetch'

type ProfilePayload = {
  hasCredentialAccount: boolean
  s3Configured: boolean
  user: ProfileUser
}

type ProfileKey = readonly ['user-profile', string]

class ProfileApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ProfileApiError'
  }
}

async function fetchProfile(_key: ProfileKey): Promise<ProfilePayload> {
  const res = await apiFetch('/api/webapi/user/profile')
  if (!res.ok) {
    throw new ProfileApiError(res.status, `加载个人资料失败：${res.status}`)
  }

  return res.json() as Promise<ProfilePayload>
}

/**
 * Client settings profile — fetches `/api/webapi/user/profile` after session is ready.
 * Replaces Next SSR prefetch for SPA (and can be reused by App Router later).
 */
export default function SettingsProfilePage() {
  const { data: session, isPending } = useSession()
  const userId = session?.user?.id
  const { data: payload, error: loadError, isLoading } = useSWR<ProfilePayload, ProfileApiError>(
    userId ? ['user-profile', userId] : null,
    fetchProfile,
    {
      dedupingInterval: 5_000,
      revalidateOnFocus: false,
      revalidateOnMount: true,
      shouldRetryOnError: false,
    }
  )

  if (isPending) {
    return (
      <Flexbox style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Flexbox>
    )
  }

  if (!session?.user || loadError?.status === 401) {
    return <Navigate replace to='/signin?callbackUrl=/settings/profile' />
  }

  if (loadError) {
    return <Flexbox style={{ padding: 24 }}>加载个人资料失败，请刷新重试。</Flexbox>
  }

  if (isLoading || !payload) {
    return (
      <Flexbox style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Flexbox>
    )
  }

  return (
    <ProfileSettingsContent
      hasCredentialAccount={payload.hasCredentialAccount}
      s3Configured={payload.s3Configured}
      user={payload.user}
    />
  )
}
