'use client'

import { Block, Flexbox } from '@pure/ui'
import { Divider } from 'antd'
import { Fragment, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { ProfileUser } from '@/features/settings/profile/ProfileContent'

import { AvatarSetting } from './components/AvatarSetting'
import { EmailSetting } from './components/EmailSetting'
import { FullNameSetting } from './components/FullNameSetting'
import { InterestsSetting } from './components/InterestsSetting'
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
  const [user, setUser] = useState(initialUser)

  const displayName = user.fullName || user.username || user.userId
  const initials = useMemo(
    () =>
      user.fullName?.[0]?.toUpperCase() ||
      user.username?.[0]?.toUpperCase() ||
      user.email?.[0]?.toUpperCase() ||
      user.userId[0]?.toUpperCase() ||
      '?',
    [user.email, user.fullName, user.userId, user.username]
  )

  const showPasswordSetting = hasCredentialAccount && Boolean(user.email)

  const handleAvatarUploaded = (avatar: string) => {
    setUser((current) => ({ ...current, avatar }))
  }

  const handleFullNameUpdated = (fullName: string | null) => {
    setUser((current) => ({ ...current, fullName }))
  }

  const handleUsernameUpdated = (username: string) => {
    setUser((current) => ({ ...current, username }))
  }

  const handleInterestsUpdated = (interests: string[]) => {
    setUser((current) => ({ ...current, interests }))
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
      node: <FullNameSetting fullName={user.fullName ?? null} onUpdated={handleFullNameUpdated} />,
    },
    {
      key: 'username',
      node: <UsernameSetting onUpdated={handleUsernameUpdated} username={user.username ?? null} />,
    },
    {
      key: 'interests',
      node: <InterestsSetting interests={user.interests ?? []} onUpdated={handleInterestsUpdated} />,
    },
    ...(showPasswordSetting
      ? [
          {
            key: 'password',
            node: <PasswordSetting email={user.email ?? null} hasCredentialAccount={hasCredentialAccount} />,
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
    <Flexbox gap={24} style={{ paddingBlock: '24px 64px', paddingInline: 24, width: '100%' }}>
      <Block gap={16} title='账户' variant='filled'>
        <Flexbox style={{ padding: 16 }}>
          {accountRows.map((row, index) => (
            <Fragment key={row.key}>
              {index > 0 ? <Divider style={{ margin: 0 }} /> : null}
              {row.node}
            </Fragment>
          ))}
        </Flexbox>
      </Block>

      {!s3Configured ? <p className='text-xs text-muted-foreground'>头像上传需配置 S3 环境变量</p> : null}
    </Flexbox>
  )
}
