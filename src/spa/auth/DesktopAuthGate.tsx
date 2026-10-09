'use client'

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { isDesktopAuthBlockedPath, isDesktopRenderer, resolveDesktopCallbackUrl } from '@/utils/desktopAuth'

const DesktopAuthGate = ({ children }: { children: ReactNode }) => {
  const location = useLocation()

  if (!isDesktopRenderer() || !isDesktopAuthBlockedPath(location.pathname)) return children

  const callbackUrl = resolveDesktopCallbackUrl(`${location.pathname}${location.search}`)
  return <Navigate replace to={`/desktop-login?callbackUrl=${encodeURIComponent(callbackUrl)}`} />
}

export default DesktopAuthGate
