import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import type { ProfileUser } from '@/features/settings/profile/ProfileContent'
import { auth } from '@/auth'
import { UserModel } from '@/database/models/user'
import type { UserItem } from '@/database/schemas'
import { fileEnv } from '@/envs/file'
import { normalizeInterestsForStorage } from '@/features/settings/const/interests'
import { withAuth } from '@/libs/auth/get-session-user'

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

/** GET /api/webapi/user/profile — SPA / client settings profile bootstrap */
export const GET = withAuth(async (_request, { userId }) => {
  const user = await UserModel.findById(userId)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const accounts = await auth.api.listUserAccounts({
    headers: await headers(),
  })

  return NextResponse.json({
    hasCredentialAccount: accounts.some((account) => account.providerId === 'credential'),
    s3Configured: isS3Configured(),
    user: serializeUser(user),
  })
})

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().max(128).nullable().optional(),
    interests: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
  })
  .refine((value) => value.fullName !== undefined || value.interests !== undefined, {
    message: 'At least one field is required',
  })

export const PATCH = withAuth(async (request, { userId }) => {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = updateProfileSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const patch: { fullName?: string | null; interests?: string[] } = {}

  if (parsed.data.fullName !== undefined) {
    patch.fullName = parsed.data.fullName === '' ? null : parsed.data.fullName
  }

  if (parsed.data.interests !== undefined) {
    patch.interests = normalizeInterestsForStorage(parsed.data.interests)
  }

  try {
    const [updated] = await UserModel.updateProfileById(userId, patch)

    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      fullName: updated.fullName ?? null,
      interests: updated.interests ?? [],
    })
  } catch (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
})
