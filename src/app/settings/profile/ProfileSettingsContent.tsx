'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import type { ProfileUser } from '@/app/profile/ProfileContent'
import { signOut } from '@/libs/better-auth/auth-client'

import { AvatarSetting } from './components/AvatarSetting'
import { EmailSetting } from './components/EmailSetting'
import { LinkedAccountsSetting } from './components/LinkedAccountsSetting'
import { PasswordSetting } from './components/PasswordSetting'
import { UsernameSetting } from './components/UsernameSetting'

interface ProfileSettingsContentProps {
  hasCredentialAccount: boolean
  s3Configured: boolean
  user: ProfileUser
}

export function ProfileSettingsContent({
  hasCredentialAccount,
  s3Configured,
  user: initialUser,
}: ProfileSettingsContentProps) {
  const router = useRouter()
  const [user, setUser] = useState(initialUser)
  const [signingOut, setSigningOut] = useState(false)

  const displayName = user.username || user.userId
  const initials = useMemo(
    () =>
      user.username?.[0]?.toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      user.userId[0]?.toUpperCase() ||
      '?',
    [user.email, user.userId, user.username],
  )

  const handleSignOut = async () => {
    setSigningOut(true)

    try {
      await signOut()
      router.push('/')
    } finally {
      setSigningOut(false)
    }
  }

  const handleAvatarUploaded = (avatar: string) => {
    setUser((current) => ({ ...current, avatar }))
    router.refresh()
  }

  const handleUsernameUpdated = (username: string) => {
    setUser((current) => ({ ...current, username }))
    router.refresh()
  }

  return (
    <main className="min-h-screen overflow-y-auto bg-background px-6 py-8 md:px-10 md:py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Link
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/"
          >
            <span aria-hidden>←</span>
            返回首页
          </Link>
          <button
            className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-red-500/40 hover:text-red-500 disabled:opacity-50"
            disabled={signingOut}
            onClick={handleSignOut}
            type="button"
          >
            {signingOut ? '退出中…' : '退出登录'}
          </button>
        </div>

        <h1 className="mb-6 text-2xl font-semibold tracking-tight">个人资料</h1>

        <section className="rounded-2xl border border-border bg-card shadow-xs">
          <h2 className="border-b border-border px-5 py-3 text-sm font-medium text-muted-foreground">
            账户
          </h2>
          <div className="divide-y divide-border">
            <AvatarSetting
              avatar={user.avatar ?? null}
              displayName={displayName}
              initials={initials}
              onUploaded={handleAvatarUploaded}
              s3Configured={s3Configured}
            />
            <UsernameSetting onUpdated={handleUsernameUpdated} username={user.username ?? null} />
            <PasswordSetting email={user.email ?? null} hasCredentialAccount={hasCredentialAccount} />
            <EmailSetting email={user.email ?? null} />
            <LinkedAccountsSetting userEmail={user.email ?? null} />
          </div>
        </section>

        {!s3Configured ? (
          <p className="mt-4 text-xs text-muted-foreground">头像上传需配置 S3 环境变量</p>
        ) : null}
      </div>
    </main>
  )
}
