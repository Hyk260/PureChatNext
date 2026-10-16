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
  /** 会话加载期间显示的内容 */
  fallback?: ReactNode
}

/**
 * SPA 客户端认证门禁：未认证的 Web 用户跳转到 `/signin`，Electron 用户跳转到 `/desktop-login`。
 * 用于替代 Vite 路由中的 Next SSR `headers()` 和 `redirect()`。
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
