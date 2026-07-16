'use client'

import { Block, Flexbox } from '@lobehub/ui'
import { Divider } from 'antd'
import { useRouter } from '@/utils/navigation'
import { Fragment, useMemo, useState, type ReactNode } from 'react'

import type { ProfileUser } from '@/app/profile/ProfileContent'

import { AvatarSetting } from './components/AvatarSetting'
import { EmailSetting } from './components/EmailSetting'
import { FullNameSetting } from './components/FullNameSetting'
import { InterestsSetting } from './components/InterestsSetting'
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

  const displayName = user.fullName || user.username || user.userId
  const initials = useMemo(
    () =>
      user.fullName?.[0]?.toUpperCase() ||
      user.username?.[0]?.toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      user.userId[0]?.toUpperCase() ||
      '?',
    [user.email, user.fullName, user.userId, user.username],
  )

  const showPasswordSetting = hasCredentialAccount && Boolean(user.email)

  const handleAvatarUploaded = (avatar: string) => {
    setUser((current) => ({ ...current, avatar }))
    router.refresh()
  }

  const handleFullNameUpdated = (fullName: string | null) => {
    setUser((current) => ({ ...current, fullName }))
    router.refresh()
  }

  const handleUsernameUpdated = (username: string) => {
    setUser((current) => ({ ...current, username }))
    router.refresh()
  }

  const handleInterestsUpdated = (interests: string[]) => {
    setUser((current) => ({ ...current, interests }))
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
      key: 'fullName',
      node: (
        <FullNameSetting fullName={user.fullName ?? null} onUpdated={handleFullNameUpdated} />
      ),
    },
    {
      key: 'username',
      node: (
        <UsernameSetting onUpdated={handleUsernameUpdated} username={user.username ?? null} />
      ),
    },
    {
      key: 'interests',
      node: (
        <InterestsSetting
          interests={user.interests ?? []}
          onUpdated={handleInterestsUpdated}
        />
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
    <Flexbox gap={24} style={{ paddingBlock: '24px 64px', paddingInline: 24 }} width="100%">
      <SettingHeader title="个人资料" />

      <Block gap={16} title="账户" variant="filled">
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
  )
}
