'use client'

import { Flexbox } from '@pure/ui'
import { Skeleton } from 'antd'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useSession } from '@/libs/better-auth/client'
import { resolveCallbackUrl } from '@/utils/safeCallbackUrl'

type RequireAuthProps = {
  children: ReactNode
  /** Shown while session is loading */
  fallback?: ReactNode
}

/**
 * SPA client auth gate — redirects unauthenticated users to `/signin` with callbackUrl.
 * Replaces Next SSR `headers()` + `redirect()` for routes mounted under Vite.
 */
export default function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { data: session, isPending } = useSession()
  const location = useLocation()

  if (isPending) {
    return (
      fallback ?? (
        <Flexbox style={{ height: '100%', padding: 24 }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Flexbox>
      )
    )
  }

  if (!session?.user) {
    const raw = `${location.pathname}${location.search}`
    const callbackUrl = resolveCallbackUrl(raw, '/chat')
    return <Navigate replace to={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} />
  }

  return children
}
