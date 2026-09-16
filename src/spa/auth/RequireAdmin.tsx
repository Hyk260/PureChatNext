'use client'

import { Flex, Skeleton } from '@pure/ui'
import type { ReactNode } from 'react'

import { StatusHomeButton, StatusPage } from '@/components/StatusPage'
import { isAdminRole } from '@/const/auth'
import { useSession } from '@/libs/better-auth/client'

type RequireAdminProps = {
  children: ReactNode
}

/**
 * SPA admin gate — 403 when the signed-in user is not an admin.
 * Nest inside RequireAuth so guests are sent to sign-in first.
 */
export default function RequireAdmin({ children }: RequireAdminProps) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <Flex className='flex-col h-full p-6'>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Flex>
    )
  }

  if (!isAdminRole(session?.user?.role)) {
    return (
      <StatusPage extra={<StatusHomeButton />} status='403' subTitle='该页面仅管理员可访问' title='403' />
    )
  }

  return children
}
