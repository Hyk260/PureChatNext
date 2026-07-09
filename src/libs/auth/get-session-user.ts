import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { UserModel } from '@/database/models/user'

export async function getAuthenticatedUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) return null

  const user = await UserModel.findById(session.user.id)
  return user?.id ?? null
}

export async function requireAuthUserId() {
  const userId = await getAuthenticatedUserId()
  if (!userId) return null
  return userId
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
