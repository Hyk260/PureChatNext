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
 * SPA 管理员门禁：已登录用户不是管理员时返回 403。
 * 应嵌套在 RequireAuth 中，确保访客先跳转到登录页面。
 */
export default function RequireAdmin({ children }: RequireAdminProps) {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <Flex className='flex-col h-full p-6'>
        <Skeleton.Text rows={7} />
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
