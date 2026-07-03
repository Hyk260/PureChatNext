import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import type { ProfileUser } from '@/app/profile/ProfileContent'
import { auth } from '@/auth'
import { UserModel } from '@/database/models/user'
import { fileEnv } from '@/envs/file'

import type { UserItem } from '@/database/schemas'

import { ProfileSettingsContent } from './ProfileSettingsContent'

function serializeUser(user: UserItem): ProfileUser {
  const { password: _password, ...rest } = user

  return {
    ...rest,
    accessedAt: rest.accessedAt.toISOString(),
    banExpires: rest.banExpires?.toISOString() ?? null,
    createdAt: rest.createdAt.toISOString(),
    emailVerifiedAt: rest.emailVerifiedAt?.toISOString() ?? null,
    lastActiveAt: rest.lastActiveAt.toISOString(),
    updatedAt: rest.updatedAt.toISOString(),
  }
}

function isS3Configured() {
  return Boolean(
    fileEnv.S3_ACCESS_KEY_ID &&
      fileEnv.S3_SECRET_ACCESS_KEY &&
      fileEnv.S3_ENDPOINT &&
      fileEnv.S3_BUCKET,
  )
}

export default async function SettingsProfilePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/signin?callbackUrl=/settings/profile')
  }

  const user = await UserModel.findById(session.user.id)

  if (!user) {
    redirect('/signin?callbackUrl=/settings/profile')
  }

  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  })

  const hasCredentialAccount = accounts.some((account) => account.providerId === 'credential')

  return (
    <ProfileSettingsContent
      hasCredentialAccount={hasCredentialAccount}
      s3Configured={isS3Configured()}
      user={serializeUser(user)}
    />
  )
}
