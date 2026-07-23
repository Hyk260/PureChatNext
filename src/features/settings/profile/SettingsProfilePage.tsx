'use client'

import { Flex, Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'

import { type ProfileUser } from '@/features/settings/profile/ProfileContent'
import { ProfileSettingsContent } from '@/features/settings/profile/ProfileSettingsContent'
import { useSession } from '@/libs/better-auth/client'
import { apiFetch } from '@/utils/apiFetch'

type ProfilePayload = {
  hasCredentialAccount: boolean
  s3Configured: boolean
  user: ProfileUser
}

/**
 * Client settings profile — fetches `/api/webapi/user/profile` after session is ready.
 * Replaces Next SSR prefetch for SPA (and can be reused by App Router later).
 */
export default function SettingsProfilePage() {
  const { data: session, isPending } = useSession()
  const [payload, setPayload] = useState<ProfilePayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (isPending || !session?.user) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await apiFetch('/api/webapi/user/profile', { credentials: 'include' })
        if (!res.ok) {
          if (!cancelled) {
            setLoadError(res.status === 401 ? 'unauthorized' : 'failed')
          }
          return
        }
        const data = (await res.json()) as ProfilePayload
        if (!cancelled) {
          setPayload(data)
          setLoadError(null)
        }
      } catch {
        if (!cancelled) setLoadError('failed')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isPending, session?.user])

  if (isPending) {
    return (
      <Flex vertical style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Flex>
    )
  }

  if (!session?.user || loadError === 'unauthorized') {
    return <Navigate replace to="/signin?callbackUrl=/settings/profile" />
  }

  if (loadError === 'failed') {
    return (
      <Flex vertical style={{ padding: 24 }}>
        加载个人资料失败，请刷新重试。
      </Flex>
    )
  }

  if (!payload) {
    return (
      <Flex vertical style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Flex>
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
