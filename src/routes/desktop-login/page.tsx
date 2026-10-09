'use client'

import { useLocation, useNavigate } from 'react-router'

import DesktopLoginPage from '@/features/desktop/DesktopLoginPage'
import InsetContentFrame from '@/layout/InsetContentFrame'
import { resolveDesktopCallbackUrl } from '@/utils/desktopAuth'

export default function DesktopLoginRoute() {
  const location = useLocation()
  const navigate = useNavigate()
  const callbackUrl = resolveDesktopCallbackUrl(new URLSearchParams(location.search).get('callbackUrl'))

  return (
    <InsetContentFrame sidebarCollapsed>
      <DesktopLoginPage onSuccess={() => navigate(callbackUrl, { replace: true })} />
    </InsetContentFrame>
  )
}
