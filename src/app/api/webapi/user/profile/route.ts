import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'

import { auth } from '@/auth'
import { UserModel } from '@/database/models/user'
import { normalizeInterestsForStorage } from '@/features/settings/const/interests'

const updateProfileSchema = z
  .object({
    fullName: z.string().trim().max(128).nullable().optional(),
    interests: z.array(z.string().trim().min(1).max(64)).max(32).optional(),
  })
  .refine((value) => value.fullName !== undefined || value.interests !== undefined, {
    message: 'At least one field is required',
  })

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    const [updated] = await UserModel.updateProfileById(session.user.id, patch)

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
}
