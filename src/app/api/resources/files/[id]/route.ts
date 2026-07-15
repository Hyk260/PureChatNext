import { NextResponse } from 'next/server'

import { FileModel } from '@/database/models/file'
import { jsonError, withAuth } from '@/libs/auth/get-session-user'
import { resolveFileAccessUrl } from '@/server/modules/S3/url'

export const GET = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const file = await new FileModel(userId).findById(id)
  if (!file) return jsonError('File not found', 404)

  return NextResponse.json({
    ...file,
    url: resolveFileAccessUrl(file.id, file.url),
  })
})

export const PATCH = withAuth(async (request, { params, userId }) => {
  const { id } = await params
  const body = await request.json()
  const file = await new FileModel(userId).update(id, body)
  if (!file) return jsonError('File not found', 404)

  return NextResponse.json({
    ...file,
    url: resolveFileAccessUrl(file.id, file.url),
  })
})

export const DELETE = withAuth(async (_request, { params, userId }) => {
  const { id } = await params
  const file = await new FileModel(userId).delete(id)
  if (!file) return jsonError('File not found', 404)

  return NextResponse.json({ success: true })
})
