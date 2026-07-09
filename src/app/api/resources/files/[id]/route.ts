import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { FileModel } from '@/database/models/file'
import {
  getAuthenticatedUserId,
  jsonError,
  unauthorizedResponse,
} from '@/libs/auth/get-session-user'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const file = await new FileModel(userId).findById(id)
  if (!file) return jsonError('File not found', 404)

  return NextResponse.json(file)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const body = await request.json()
  const file = await new FileModel(userId).update(id, body)
  if (!file) return jsonError('File not found', 404)

  return NextResponse.json(file)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await params
  const file = await new FileModel(userId).delete(id)
  if (!file) return jsonError('File not found', 404)

  return NextResponse.json({ success: true })
}
