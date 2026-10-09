'use client'

import { Flex, Skeleton } from '@pure/ui'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useSession } from '@/libs/better-auth/client'
import { trackAcquisitionEvent } from '@/libs/analytics/acquisition'
import { resolveCallbackUrl } from '@/utils/safeCallbackUrl'
import { isDesktopRenderer, resolveDesktopCallbackUrl } from '@/utils/desktopAuth'

type RequireAuthProps = {
  children: ReactNode
  /** Shown while session is loading */
  fallback?: ReactNode
}

/**
 * SPA client auth gate — redirects unauthenticated Web users to `/signin` and Electron users to `/desktop-login`.
 * Replaces Next SSR `headers()` + `redirect()` for routes mounted under Vite.
 */
export default function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { data: session, isPending } = useSession()
  const location = useLocation()
  const trackedPathRef = useRef<string | undefined>(undefined)
  const rawPath = `${location.pathname}${location.search}`

  useEffect(() => {
    if (isPending || session?.user || trackedPathRef.current === rawPath) return
    trackedPathRef.current = rawPath
    trackAcquisitionEvent('auth_gate_viewed', { destination: location.pathname })
  }, [isPending, location.pathname, rawPath, session?.user])

  if (isPending) {
    return (
      fallback ?? (
        <Flex className='flex-col h-full p-6'>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Flex>
      )
    )
  }

  if (!session?.user) {
    const callbackUrl = isDesktopRenderer() ? resolveDesktopCallbackUrl(rawPath) : resolveCallbackUrl(rawPath, '/chat')
    const loginPath = isDesktopRenderer() ? '/desktop-login' : '/signin'
    return <Navigate replace to={`${loginPath}?callbackUrl=${encodeURIComponent(callbackUrl)}`} />
  }

  return children
}
