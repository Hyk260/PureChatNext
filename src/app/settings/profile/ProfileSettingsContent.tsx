'use client'

import { Block, Flexbox } from '@lobehub/ui'
import { Divider } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useMemo, useState, type ReactNode } from 'react'

import type { ProfileUser } from '@/app/profile/ProfileContent'
import { signOut } from '@/libs/better-auth/auth-client'

import { AvatarSetting } from './components/AvatarSetting'
import { EmailSetting } from './components/EmailSetting'
import { LinkedAccountsSetting } from './components/LinkedAccountsSetting'
import { PasswordSetting } from './components/PasswordSetting'
import { SettingHeader } from './components/SettingHeader'
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

  const showPasswordSetting = hasCredentialAccount && Boolean(user.email)

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

  const accountRows: { key: string; node: ReactNode }[] = [
    {
      key: 'avatar',
      node: (
        <AvatarSetting
          avatar={user.avatar ?? null}
          displayName={displayName}
          initials={initials}
          onUploaded={handleAvatarUploaded}
          s3Configured={s3Configured}
        />
      ),
    },
    {
      key: 'username',
      node: (
        <UsernameSetting onUpdated={handleUsernameUpdated} username={user.username ?? null} />
      ),
    },
    ...(showPasswordSetting
      ? [
          {
            key: 'password',
            node: (
              <PasswordSetting
                email={user.email ?? null}
                hasCredentialAccount={hasCredentialAccount}
              />
            ),
          },
        ]
      : []),
    {
      key: 'email',
      node: <EmailSetting email={user.email ?? null} />,
    },
    {
      key: 'linked',
      node: <LinkedAccountsSetting userEmail={user.email ?? null} />,
    },
  ]

  return (
    <main className="min-h-screen overflow-y-auto bg-background">
      <Flexbox
        className="mx-auto w-full max-w-3xl"
        gap={24}
        style={{ paddingBlock: '24px 64px', paddingInline: 24 }}
      >
        <div className="flex items-center justify-between">
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

        <SettingHeader title="个人资料" />

        <Block title="账户" variant="filled">
          <Flexbox>
            {accountRows.map((row, index) => (
              <Fragment key={row.key}>
                {index > 0 ? <Divider style={{ margin: 0 }} /> : null}
                {row.node}
              </Fragment>
            ))}
          </Flexbox>
        </Block>

        {!s3Configured ? (
          <p className="text-xs text-muted-foreground">头像上传需配置 S3 环境变量</p>
        ) : null}
      </Flexbox>
    </main>
  )
}
