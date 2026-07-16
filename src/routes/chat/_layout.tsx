'use client'

import { type ReactNode } from 'react'

import RequireAuth from '@/spa/auth/RequireAuth'

/** Chat layout: session gate before mounting ChatPage. */
export default function ChatRouteLayout({ children }: { children?: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
