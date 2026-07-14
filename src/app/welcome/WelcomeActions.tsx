'use client'

import Link from 'next/link'

import { useSession } from '@/libs/better-auth/client'

export function WelcomeActions() {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return (
      <div className="mb-20 flex h-14 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (session?.user) {
    return (
      <div className="mb-20 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
        <Link
          className="inline-flex items-center justify-center h-14 px-7 rounded-full bg-primary text-primary-foreground font-semibold text-base shadow-sm hover:brightness-95 transition-[filter] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-w-40"
          href="/settings/profile"
        >
          个人信息
        </Link>
        <Link
          className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm shadow-sm hover:brightness-95 transition-[filter] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-w-40"
          href="/chat"
        >
          开始聊天
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-20 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
      <Link
        className="inline-flex items-center justify-center h-14 px-7 rounded-full bg-primary text-primary-foreground font-semibold text-base shadow-sm hover:brightness-95 transition-[filter] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-w-40"
        href="/signin"
      >
        登录
      </Link>
      <Link
        className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-secondary text-secondary-foreground font-semibold text-sm shadow-sm hover:brightness-95 transition-[filter] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-w-40"
        href="/signup"
      >
        注册
      </Link>
      <Link
        className="inline-flex items-center justify-center h-12 px-1 rounded-full font-semibold text-sm shadow-none hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring min-w-40"
        href="/"
      >
        返回首页
      </Link>
    </div>
  )
}
