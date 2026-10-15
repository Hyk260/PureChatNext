'use client'

import type { ReactNode } from 'react'

import RequireAuth from '@/spa/auth/RequireAuth'

/** 聊天布局：在挂载 ChatPage 前校验会话。 */
export default function ChatRouteLayout({ children }: { children?: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
